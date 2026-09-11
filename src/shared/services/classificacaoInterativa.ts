/**
 * Serviço de Classificação Interativa e Persistência em Lote de Colaboradores.
 * Gerencia a resolução de pendências de classificação de UOs, verificação de conflitos
 * de matrícula e persistência segura no Firestore em blocos de até 400 documentos.
 */

import { Employee, UnidadeOrganizacional, TipoUnidadeOrganizacional, Branch } from '../types';
import {
  ImportacaoColaborador,
  prepararPayloadImportacao,
  preservarDepartamentoOriginal,
} from './importacaoColaboradores';
import {
  UNIDADES_ORGANIZACIONAIS,
  registrarNovaUOEmMemoria,
  UNIDADES_ORGANIZACIONAIS_COLLECTION,
} from '../constants/unidadesOrganizacionais';

/**
 * Parâmetros para criação de uma nova UO (setor, DECO ou DACO) em tempo de importação.
 */
export interface ParametrosNovoSetor {
  nome: string;
  sigla: string;
  tipo: TipoUnidadeOrganizacional;
  pai?: string; // Obrigatório para 'SETOR', 'COMARA' implícito para 'DECO' / 'DACO' / 'SEDE'
  sedeOuCanteiroPadrao?: string;
  descricao?: string;
}

/**
 * Relatório de verificação prévia de conflitos de matrícula.
 */
export interface ConflitoMatriculasResultado {
  novos: ImportacaoColaborador[];
  atualizacoes: {
    importado: ImportacaoColaborador;
    existente: Employee;
  }[];
  totalNovos: number;
  totalAtualizacoes: number;
}

/**
 * Informações de progresso do envio em lote.
 */
export interface ProgressoImportacaoInfo {
  processados: number;
  total: number;
  percent: number;
  loteAtual: number;
  totalLotes: number;
}

/**
 * Resultado da persistência no Firestore.
 */
export interface PersistenciaResultado {
  sucesso: boolean;
  salvos: number;
  erros: string[];
}

/**
 * Limite seguro por lote no Firestore (máximo permitido é 500; usamos 400 conforme requisito).
 */
export const LIMITE_LOTE_FIRESTORE = 400;

/**
 * Função pura para fatiar qualquer lista em lotes do tamanho especificado.
 */
export function particionarEmLotes<T>(itens: T[], tamanhoLote: number = LIMITE_LOTE_FIRESTORE): T[][] {
  if (tamanhoLote <= 0) return [itens];
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    lotes.push(itens.slice(i, i + tamanhoLote));
  }
  return lotes;
}

/**
 * Normaliza uma string de departamento para comparação robusta.
 */
function normalizarStringDepto(str?: string): string {
  return (str || '').trim().toLowerCase();
}

/**
 * Atualiza um colaborador individual com base em uma UO resolvida.
 */
function atualizarColaboradorComUo(
  item: ImportacaoColaborador,
  uo: UnidadeOrganizacional,
  confianca: 'ALTA' | 'MEDIA' | 'NAO_CLASSIFICADO' = 'ALTA'
): ImportacaoColaborador {
  let branchCompativel: Branch = (item.colaborador.sede as Branch) || 'BE';
  if (uo.sedeOuCanteiroPadrao && ['KO', 'BE', 'MN', 'SP', 'RJ'].includes(uo.sedeOuCanteiroPadrao)) {
    branchCompativel = uo.sedeOuCanteiroPadrao as Branch;
  }

  const colaboradorAtualizado: Partial<Employee> = {
    ...item.colaborador,
    lotacao: uo.codigo,
    lotacaoUoCodigo: uo.codigo,
    uoExecucao: uo.codigo,
    uoExecucaoCodigo: uo.codigo,
    secaoLotacao: uo.siglaExibicao,
    departamento: uo.nome,
    sede: branchCompativel,
    sede_origem: branchCompativel,
    sede_atual: branchCompativel,
    sedeCodigo: uo.sedeOuCanteiroPadrao || item.colaborador.sedeCodigo || branchCompativel,
  };

  return {
    ...item,
    colaborador: colaboradorAtualizado,
    classificacao: {
      unidade: uo,
      confianca,
      codigoOriginal: item.departamentoOriginal,
    },
    pendenteClassificacao: false,
    valido: item.errosValidacao.length === 0,
  };
}

/**
 * Opção A: Associa todos os colaboradores de um departamento original a uma UO existente.
 */
export function aplicarClassificacaoExistente(
  colaboradores: ImportacaoColaborador[],
  departamentoOriginal: string,
  uo: UnidadeOrganizacional
): ImportacaoColaborador[] {
  const alvo = normalizarStringDepto(departamentoOriginal);

  return colaboradores.map(item => {
    if (normalizarStringDepto(item.departamentoOriginal) === alvo) {
      return atualizarColaboradorComUo(item, uo, 'ALTA');
    }
    return item;
  });
}

/**
 * Valida os parâmetros de criação de uma nova UO (Setor, DECO ou DACO).
 * Para SETOR: o campo 'pai' é estritamente obrigatório.
 * Para DECO/DACO: 'pai' não é obrigatório e assume 'COMARA' implicitamente.
 */
export function validarParametrosNovaUO(parametros: ParametrosNovoSetor): { valido: boolean; erro?: string } {
  if (!parametros.nome || !parametros.nome.trim()) {
    return { valido: false, erro: 'O nome da Unidade Organizacional é obrigatório.' };
  }
  if (!parametros.sigla || !parametros.sigla.trim()) {
    return { valido: false, erro: 'A sigla de exibição é obrigatória.' };
  }
  if (parametros.tipo === 'SETOR') {
    if (!parametros.pai || !parametros.pai.trim()) {
      return { valido: false, erro: 'Para criar um novo setor, é obrigatório informar a UO pai.' };
    }
  }
  return { valido: true };
}

/**
 * Opção B: Cria uma nova UO (Setor, DECO ou DACO) dinamicamente e associa aos colaboradores correspondentes.
 */
export function aplicarNovoSetor(
  colaboradores: ImportacaoColaborador[],
  departamentoOriginal: string,
  parametros: ParametrosNovoSetor
): { colaboradoresAtualizados: ImportacaoColaborador[]; novaUo: UnidadeOrganizacional } {
  const validacao = validarParametrosNovaUO(parametros);
  if (!validacao.valido) {
    throw new Error(validacao.erro);
  }

  const tipo = parametros.tipo || 'SETOR';
  const siglaLimpa = (parametros.sigla || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  
  let codigo = '';
  if (tipo === 'DECO') {
    codigo = siglaLimpa.startsWith('DECO_') ? siglaLimpa : `DECO_${siglaLimpa}`;
  } else if (tipo === 'DACO') {
    codigo = siglaLimpa.startsWith('DACO_') ? siglaLimpa : `DACO_${siglaLimpa}`;
  } else if (tipo === 'SEDE') {
    codigo = siglaLimpa.startsWith('SEDE_') ? siglaLimpa : `SEDE_${siglaLimpa}`;
  } else {
    codigo = siglaLimpa.startsWith('SETOR_') ? siglaLimpa : `SETOR_${siglaLimpa}`;
  }

  // Define UO pai: para SETOR exige pai informado; para DECO/DACO/SEDE usa informado ou 'COMARA'
  let uoPai = parametros.pai?.trim();
  if (tipo !== 'SETOR' && !uoPai) {
    uoPai = 'COMARA';
  }

  // Sede ou canteiro padrão: se não informado explicitamente, herda da UO pai se existir
  let sedePadrao = parametros.sedeOuCanteiroPadrao;
  if (!sedePadrao && uoPai && UNIDADES_ORGANIZACIONAIS[uoPai]?.sedeOuCanteiroPadrao) {
    sedePadrao = UNIDADES_ORGANIZACIONAIS[uoPai].sedeOuCanteiroPadrao;
  }
  if (!sedePadrao) {
    sedePadrao = 'BE';
  }

  const novaUo: UnidadeOrganizacional = {
    codigo,
    nome: parametros.nome.trim(),
    siglaExibicao: parametros.sigla.trim().toUpperCase(),
    tipo,
    sedeOuCanteiroPadrao: sedePadrao,
    pai: uoPai,
    ativa: true,
    descricao: parametros.descricao || `${tipo} criado durante importação a partir de "${departamentoOriginal}"`,
  };

  // Registra a nova UO na memória e associa o alias do departamento legado
  registrarNovaUOEmMemoria(novaUo, departamentoOriginal);

  const colaboradoresAtualizados = aplicarClassificacaoExistente(
    colaboradores,
    departamentoOriginal,
    novaUo
  );

  return {
    colaboradoresAtualizados,
    novaUo,
  };
}

/** Cria a UO no catálogo em memória e aguarda sua persistência no Firestore. */
export async function aplicarNovoSetorPersistido(
  colaboradores: ImportacaoColaborador[],
  departamentoOriginal: string,
  parametros: ParametrosNovoSetor
): Promise<{ colaboradoresAtualizados: ImportacaoColaborador[]; novaUo: UnidadeOrganizacional }> {
  const resultado = aplicarNovoSetor(colaboradores, departamentoOriginal, parametros);
  const { doc, setDoc } = await import('./db');
  const { db } = await import('./db');
  await setDoc(
    doc(db, UNIDADES_ORGANIZACIONAIS_COLLECTION, resultado.novaUo.codigo),
    resultado.novaUo,
    { merge: true }
  );
  return resultado;
}

/**
 * Opção C: Marca os colaboradores como NAO_CLASSIFICADO com pendência resolvida (importação permitida).
 */
export function manterNaoClassificado(
  colaboradores: ImportacaoColaborador[],
  departamentoOriginal: string
): ImportacaoColaborador[] {
  const alvo = normalizarStringDepto(departamentoOriginal);

  const uoNaoClassificado: UnidadeOrganizacional = {
    codigo: 'NAO_CLASSIFICADO',
    nome: 'Não Classificado',
    siglaExibicao: 'NÃO CLASSIFICADO',
    tipo: 'NAO_CLASSIFICADO',
    sedeOuCanteiroPadrao: 'BE',
    ativa: false,
    descricao: 'Departamento legado pendente de triagem interna',
  };

  return colaboradores.map(item => {
    if (normalizarStringDepto(item.departamentoOriginal) === alvo) {
      return atualizarColaboradorComUo(item, uoNaoClassificado, 'NAO_CLASSIFICADO');
    }
    return item;
  });
}

/**
 * Analisa a lista de colaboradores a serem importados contra os colaboradores existentes,
 * identificando sem leituras adicionais (usando os dados em memória) quem é novo e quem é atualização.
 */
export function analisarConflitosMatricula(
  colaboradoresParaImportar: ImportacaoColaborador[],
  colaboradoresExistentes: Employee[]
): ConflitoMatriculasResultado {
  const mapaExistentes = new Map<string, Employee>();
  colaboradoresExistentes.forEach(emp => {
    const mat = (emp.matricula || emp.id || '').trim().toUpperCase();
    if (mat) {
      mapaExistentes.set(mat, emp);
    }
  });

  const novos: ImportacaoColaborador[] = [];
  const atualizacoes: { importado: ImportacaoColaborador; existente: Employee }[] = [];

  for (const item of colaboradoresParaImportar) {
    const mat = (item.colaborador.matricula || '').trim().toUpperCase();
    const existente = mapaExistentes.get(mat);

    if (existente) {
      atualizacoes.push({
        importado: item,
        existente,
      });
    } else {
      novos.push(item);
    }
  }

  return {
    novos,
    atualizacoes,
    totalNovos: novos.length,
    totalAtualizacoes: atualizacoes.length,
  };
}

/**
 * Persiste os colaboradores válidos no Firestore usando writeBatch em blocos de até 400 documentos.
 * Respeita a opção de ignorar ou sobrescrever existentes com a mesma matrícula.
 */
export async function persistirColaboradoresFirestore(
  colaboradoresParaGravar: ImportacaoColaborador[],
  opcoes?: {
    sobrescreverExistentes?: boolean;
    colaboradoresExistentes?: Employee[];
    onProgresso?: (info: ProgressoImportacaoInfo) => void;
    batchSize?: number;
  }
): Promise<PersistenciaResultado> {
  const batchSize = opcoes?.batchSize || LIMITE_LOTE_FIRESTORE;
  const sobrescrever = opcoes?.sobrescreverExistentes ?? true;
  const existentes = opcoes?.colaboradoresExistentes || [];

  // Filtra apenas registros válidos
  let listaFiltrada = colaboradoresParaGravar.filter(c => c.valido);

  // Se não deve sobrescrever existentes, remove os que já existem
  if (!sobrescrever && existentes.length > 0) {
    const setMatriculas = new Set(existentes.map(e => (e.matricula || e.id || '').trim().toUpperCase()));
    listaFiltrada = listaFiltrada.filter(
      c => !setMatriculas.has((c.colaborador.matricula || '').trim().toUpperCase())
    );
  }

  const total = listaFiltrada.length;
  if (total === 0) {
    return {
      sucesso: true,
      salvos: 0,
      erros: [],
    };
  }

  // Divisão em blocos de até 400 via helper testável
  const chunks = particionarEmLotes(listaFiltrada, batchSize);

  // Lazy import do Firestore SDK e helpers para garantir isolamento em testes unitários puros
  const { doc, writeBatch } = await import('./db');
  const { db } = await import('./db');
  const { COLLECTIONS } = await import('./dbService');

  let salvosTotal = 0;
  const erros: string[] = [];

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const batch = writeBatch(db);

    for (const item of chunk) {
      const matricula = (item.colaborador.matricula || item.colaborador.id || '').trim().toUpperCase();
      const existente = existentes.find((emp) =>
        (emp.matricula || emp.id || '').trim().toUpperCase() === matricula
      );
      const empData = {
        ...preservarDepartamentoOriginal(
          prepararPayloadImportacao(item.colaborador, item.pendenteClassificacao),
          existente
        ),
        atualizadoEm: new Date().toISOString(),
      };
      const docRef = doc(db, COLLECTIONS.COLABORADORES, matricula);
      batch.set(docRef, empData, { merge: true });
    }

    try {
      await batch.commit();
      salvosTotal += chunk.length;
    } catch (err: any) {
      console.error(`Erro ao gravar lote ${cIdx + 1} de colaboradores:`, err);
      erros.push(`Falha no lote ${cIdx + 1}: ${err?.message || 'Erro de gravação'}`);
    }

    if (opcoes?.onProgresso) {
      opcoes.onProgresso({
        processados: salvosTotal,
        total,
        percent: Math.round((salvosTotal / total) * 100),
        loteAtual: cIdx + 1,
        totalLotes: chunks.length,
      });
    }
  }

  return {
    sucesso: erros.length === 0,
    salvos: salvosTotal,
    erros,
  };
}
