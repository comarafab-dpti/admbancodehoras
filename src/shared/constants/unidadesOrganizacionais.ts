import { UnidadeOrganizacional, ResultadoNormalizacaoUO } from '../types';

export const UNIDADES_ORGANIZACIONAIS: Record<string, UnidadeOrganizacional> = {
  SEDE_BE: {
    codigo: 'SEDE_BE',
    nome: 'Sede Belém (Quartel-General COMARA)',
    siglaExibicao: 'SEDE-BE',
    tipo: 'SEDE',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'COMARA',
    ativa: true,
    descricao: 'Sede Administrativa e Quartel-General da COMARA em Belém/PA',
  },
  DACO_MN: {
    codigo: 'DACO_MN',
    nome: 'Destacamento de Apoio de Manaus',
    siglaExibicao: 'DACO-MN',
    tipo: 'DACO',
    sedeOuCanteiroPadrao: 'MN',
    pai: 'COMARA',
    ativa: true,
    descricao: 'Destacamento de Apoio Operacional de Manaus/AM',
  },
  DECO_KO: {
    codigo: 'DECO_KO',
    nome: 'Destacamento de Engenharia de Coari',
    siglaExibicao: 'DECO-KO',
    tipo: 'DECO',
    sedeOuCanteiroPadrao: 'KO',
    pai: 'COMARA',
    ativa: true,
    descricao: 'Canteiro de Obras e Engenharia em Coari/AM',
  },
  DECO_PFB: {
    codigo: 'DECO_PFB',
    nome: 'Destacamento de Engenharia / Pista de Fonte Boa',
    siglaExibicao: 'DECO-PFB',
    tipo: 'DECO',
    sedeOuCanteiroPadrao: 'FB',
    pai: 'COMARA',
    ativa: true,
    descricao: 'Canteiro Operacional de Pista em Fonte Boa/AM',
  },
  SETOR_SUPRIMENTOS: {
    codigo: 'SETOR_SUPRIMENTOS',
    nome: 'Divisão de Suprimentos (DAPR)',
    siglaExibicao: 'DAPR-SUPRIMENTOS',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Divisão de Apoio e Provisões — Seção de Suprimentos (Sede Belém)',
  },
  SETOR_DAPC: {
    codigo: 'SETOR_DAPC',
    nome: 'Divisão de Administração de Pessoal Civil',
    siglaExibicao: 'DAPC',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Administração de Pessoal Civil e Recursos Humanos (Sede Belém)',
  },
  SETOR_SDSG: {
    codigo: 'SETOR_SDSG',
    nome: 'Subdivisão de Serviços Gerais',
    siglaExibicao: 'SDSG',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Subdivisão de Serviços Gerais e Infraestrutura (Sede Belém)',
  },
  SETOR_SAQ: {
    codigo: 'SETOR_SAQ',
    nome: 'Seção de Aquisições',
    siglaExibicao: 'SAQ',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Seção de Aquisições, Contratos e Almoxarifado (Sede Belém)',
  },
  SETOR_EXPEDIENTE: {
    codigo: 'SETOR_EXPEDIENTE',
    nome: 'Seção de Expediente e Protocolo',
    siglaExibicao: 'EXP.',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Seção de Expediente, Comunicações e Protocolo Geral (Sede Belém)',
  },
  SETOR_DL: {
    codigo: 'SETOR_DL',
    nome: 'Divisão de Logística',
    siglaExibicao: 'DL',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Divisão de Logística e Transporte Operacional (Sede Belém)',
  },
  SETOR_PMAC: {
    codigo: 'SETOR_PMAC',
    nome: 'Pavimentação / Manutenção',
    siglaExibicao: 'PMAC',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Seção Técnica de Pavimentação e Manutenção (Sede Belém)',
  },
  SETOR_DACD: {
    codigo: 'SETOR_DACD',
    nome: 'Divisão de Apoio e Controle',
    siglaExibicao: 'DACD',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Divisão de Apoio e Controle de Documentação (Sede Belém)',
  },
  SETOR_DESG: {
    codigo: 'SETOR_DESG',
    nome: 'Desenho e Projetos',
    siglaExibicao: 'DESG',
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: 'BE',
    pai: 'SEDE_BE',
    ativa: true,
    descricao: 'Seção de Desenho e Projetos de Engenharia (Sede Belém)',
  },
  NAO_CLASSIFICADO: {
    codigo: 'NAO_CLASSIFICADO',
    nome: 'Não Classificado / A Definir',
    siglaExibicao: 'N/C',
    tipo: 'NAO_CLASSIFICADO',
    ativa: true,
    descricao: 'Departamento não classificado ou valor genérico do sistema de origem',
  },
};

export const UNIDADES_ORGANIZACIONAIS_COLLECTION = 'unidades_organizacionais';
let unidadesOrganizacionaisLoad: Promise<void> | null = null;

/** Retorna somente UOs ativas cadastradas, sem incluir o marcador de pendência. */
export function listarUnidadesOrganizacionais(): UnidadeOrganizacional[] {
  return Object.values(UNIDADES_ORGANIZACIONAIS).filter(
    (unidade) => unidade.ativa && unidade.codigo !== 'NAO_CLASSIFICADO'
  );
}

/**
 * Setor virtual para exibição quando a OU ainda não possui setores filhos.
 * Ele não é persistido nem adicionado ao catálogo.
 */
export function obterSetorDefault(unidade: UnidadeOrganizacional): UnidadeOrganizacional {
  return {
    codigo: `${unidade.codigo}/GERAL`,
    nome: unidade.nome,
    siglaExibicao: `${unidade.siglaExibicao}/GERAL`,
    tipo: 'SETOR',
    sedeOuCanteiroPadrao: unidade.sedeOuCanteiroPadrao,
    pai: unidade.codigo,
    ativa: unidade.ativa,
    descricao: 'Setor de exibição padrão da OU; não cadastrado separadamente.',
  };
}

export function listarSetoresDaUnidade(codigoUo: string): UnidadeOrganizacional[] {
  const setores = listarUnidadesOrganizacionais().filter(
    (unidade) => unidade.tipo === 'SETOR' && unidade.pai === codigoUo
  );
  return setores.length > 0 ? setores : (() => {
    const unidade = UNIDADES_ORGANIZACIONAIS[codigoUo];
    return unidade ? [obterSetorDefault(unidade)] : [];
  })();
}

/** Carrega UOs persistidas uma vez e as mescla ao catálogo estático. */
export async function carregarUnidadesOrganizacionais(): Promise<void> {
  if (!unidadesOrganizacionaisLoad) {
    unidadesOrganizacionaisLoad = (async () => {
      const { collection, getDocs } = await import('../services/db');
      const { db } = await import('../services/db');
      const snapshot = await getDocs(collection(db, UNIDADES_ORGANIZACIONAIS_COLLECTION));
      snapshot.forEach((item) => {
        const data = item.data() as Partial<UnidadeOrganizacional>;
        if (data.codigo && data.nome && data.siglaExibicao && data.tipo && typeof data.ativa === 'boolean') {
          UNIDADES_ORGANIZACIONAIS[data.codigo] = data as UnidadeOrganizacional;
        }
      });
    })();
  }
  await unidadesOrganizacionaisLoad;
}

/**
 * Tabela de aliases para normalização de departamentos oriundos de CSVs legados.
 * As chaves são representadas normalizadas (maiúsculas, sem acentos, com e sem separadores).
 */
export const ALIASES_DEPARTAMENTO_CSV: Record<string, string> = {
  // DECO - Coari
  'DECO-KO': 'DECO_KO',
  'DECO_KO': 'DECO_KO',
  'DECOKO': 'DECO_KO',
  'DECO KO': 'DECO_KO',
  'KO': 'DECO_KO',
  'CANTEIRO COARI': 'DECO_KO',
  'CANTEIRO DE COARI': 'DECO_KO',

  // DACO - Manaus
  'DACO-MN': 'DACO_MN',
  'DACO_MN': 'DACO_MN',
  'DACOMN': 'DACO_MN',
  'DACO MN': 'DACO_MN',
  'MN': 'DACO_MN',
  'MANAUS': 'DACO_MN',

  // Sede Belém
  'SEDE': 'SEDE_BE',
  'SEDE-BE': 'SEDE_BE',
  'SEDE_BE': 'SEDE_BE',
  'SEDE BE': 'SEDE_BE',
  'SEDEBE': 'SEDE_BE',
  'BE': 'SEDE_BE',
  'BELEM': 'SEDE_BE',

  // Fonte Boa
  'PFB': 'DECO_PFB',
  'P-FB': 'DECO_PFB',
  'DECO-PFB': 'DECO_PFB',
  'FONTE BOA': 'DECO_PFB',

  // Setores Sede Belém
  // DL (Divisão de Logística)
  'DL': 'SETOR_DL',
  'D.L.': 'SETOR_DL',
  'D L': 'SETOR_DL',
  'DIVISAO DE LOGISTICA': 'SETOR_DL',
  'LOGISTICA': 'SETOR_DL',

  // PMAC / PVMAC (Pavimentação / Manutenção)
  'PMAC': 'SETOR_PMAC',
  'PVMAC': 'SETOR_PMAC',
  'P-MAC': 'SETOR_PMAC',
  'PV-MAC': 'SETOR_PMAC',
  'PAVIMENTACAO': 'SETOR_PMAC',

  // DACD (Divisão de Apoio e Controle)
  'DACD': 'SETOR_DACD',
  'D.A.C.D.': 'SETOR_DACD',
  'D A C D': 'SETOR_DACD',
  'DIVISAO DE APOIO E CONTROLE': 'SETOR_DACD',

  // DESG (Desenho e Projetos)
  'DESG': 'SETOR_DESG',
  'D.E.S.G.': 'SETOR_DESG',
  'D E S G': 'SETOR_DESG',
  'DESENHO': 'SETOR_DESG',

  // DAPR-SUPRIMENTOS
  'DAPR-SUPRIMENTOS': 'SETOR_SUPRIMENTOS',
  'DAPR_SUPRIMENTOS': 'SETOR_SUPRIMENTOS',
  'DAPR SUPRIMENTOS': 'SETOR_SUPRIMENTOS',
  'DAPRSUPRIMENTOS': 'SETOR_SUPRIMENTOS',
  'SUPRIMENTOS': 'SETOR_SUPRIMENTOS',
  'DAPR': 'SETOR_SUPRIMENTOS',

  // DAPC
  'DAPC': 'SETOR_DAPC',
  'D.A.P.C.': 'SETOR_DAPC',
  'D A P C': 'SETOR_DAPC',
  'PESSOAL CIVIL': 'SETOR_DAPC',

  // SDSG
  'SDSG': 'SETOR_SDSG',
  'S.D.S.G.': 'SETOR_SDSG',
  'S D S G': 'SETOR_SDSG',
  'SERVICOS GERAIS': 'SETOR_SDSG',

  // SAQ
  'SAQ': 'SETOR_SAQ',
  'S.A.Q.': 'SETOR_SAQ',
  'S A Q': 'SETOR_SAQ',
  'AQUISICOES': 'SETOR_SAQ',

  // Expediente
  'EXP.': 'SETOR_EXPEDIENTE',
  'EXP': 'SETOR_EXPEDIENTE',
  'EXPEDIENTE': 'SETOR_EXPEDIENTE',

  // Genéricos / Não classificados
  'DEPT. PADRAO': 'NAO_CLASSIFICADO',
  'DEPT. PADRÃO': 'NAO_CLASSIFICADO',
  'DEPT PADRAO': 'NAO_CLASSIFICADO',
  'DEPT PADRÃO': 'NAO_CLASSIFICADO',
  'DEPARTAMENTO PADRAO': 'NAO_CLASSIFICADO',
  'DEPARTAMENTO PADRÃO': 'NAO_CLASSIFICADO',
  'PADRAO': 'NAO_CLASSIFICADO',
  'PADRÃO': 'NAO_CLASSIFICADO',
  'NAO CLASSIFICADO': 'NAO_CLASSIFICADO',
  'N/C': 'NAO_CLASSIFICADO',
};

/**
 * Remove acentuação de uma string
 */
function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Reconhece os padrões DECO-XX, DACO-XX e SEDE-XX usados pelos CSVs legados. */
export function extrairBigramaDepartamento(valorBruto?: string | null): {
  prefixo: 'DECO' | 'DACO' | 'SEDE';
  bigrama: string;
} | null {
  if (!valorBruto) return null;
  const valor = removerAcentos(valorBruto.trim().toUpperCase());
  const match = valor.match(/^(DECO|DACO|SEDE)[\s_-]*([A-Z0-9]{2,})/);
  return match ? { prefixo: match[1] as 'DECO' | 'DACO' | 'SEDE', bigrama: match[2] } : null;
}

function localizarUoPorPrefixoEBigrama(valorBruto: string): UnidadeOrganizacional | undefined {
  const extraido = extrairBigramaDepartamento(valorBruto);
  if (!extraido) return undefined;
  const bigrama = extraido.bigrama;
  const tipoEsperado = extraido.prefixo === 'SEDE' ? 'SEDE' : extraido.prefixo;
  return listarUnidadesOrganizacionais().find((unidade) => {
    const sigla = removerAcentos(unidade.siglaExibicao.toUpperCase()).replace(/[^A-Z0-9]/g, '');
    const codigo = removerAcentos(unidade.codigo.toUpperCase()).replace(/[^A-Z0-9]/g, '');
    return unidade.tipo === tipoEsperado && (
      unidade.sedeOuCanteiroPadrao?.toUpperCase() === bigrama ||
      sigla.endsWith(bigrama) ||
      codigo.endsWith(bigrama)
    );
  });
}

/**
 * Normaliza o valor do campo departamento_nome extraído de planilhas e CSVs legados,
 * associando-o a uma Unidade Organizacional (UO) oficial da COMARA.
 */
export function normalizarDepartamentoCSV(valorBruto?: string | null): ResultadoNormalizacaoUO {
  if (!valorBruto || typeof valorBruto !== 'string' || !valorBruto.trim()) {
    return {
      codigoOriginal: valorBruto || '',
      unidade: UNIDADES_ORGANIZACIONAIS.NAO_CLASSIFICADO,
      confianca: 'NAO_CLASSIFICADO',
    };
  }

  const brutoTrim = valorBruto.trim();
  const upper = brutoTrim.toUpperCase();
  const semAcentos = removerAcentos(upper);

  // 1. Busca direta pelo valor original em maiúsculo e sem acentos
  if (ALIASES_DEPARTAMENTO_CSV[upper]) {
    const cod = ALIASES_DEPARTAMENTO_CSV[upper];
    const unidade = UNIDADES_ORGANIZACIONAIS[cod] || UNIDADES_ORGANIZACIONAIS.NAO_CLASSIFICADO;
    return {
      codigoOriginal: valorBruto,
      unidade,
      confianca: unidade.tipo === 'NAO_CLASSIFICADO' ? 'NAO_CLASSIFICADO' : 'ALTA',
    };
  }

  if (ALIASES_DEPARTAMENTO_CSV[semAcentos]) {
    const cod = ALIASES_DEPARTAMENTO_CSV[semAcentos];
    const unidade = UNIDADES_ORGANIZACIONAIS[cod] || UNIDADES_ORGANIZACIONAIS.NAO_CLASSIFICADO;
    return {
      codigoOriginal: valorBruto,
      unidade,
      confianca: unidade.tipo === 'NAO_CLASSIFICADO' ? 'NAO_CLASSIFICADO' : 'ALTA',
    };
  }

  // 2. Normaliza pontuação e separadores: substitui ., _, -, / por espaço
  const termoLimpo = semAcentos
    .replace(/[.\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (ALIASES_DEPARTAMENTO_CSV[termoLimpo]) {
    const cod = ALIASES_DEPARTAMENTO_CSV[termoLimpo];
    const unidade = UNIDADES_ORGANIZACIONAIS[cod] || UNIDADES_ORGANIZACIONAIS.NAO_CLASSIFICADO;
    return {
      codigoOriginal: valorBruto,
      unidade,
      confianca: unidade.tipo === 'NAO_CLASSIFICADO' ? 'NAO_CLASSIFICADO' : 'ALTA',
    };
  }

  // 3. Compactado (sem nenhum espaço nem pontuação)
  const termoCompactado = semAcentos.replace(/[\s.\-_/\\]/g, '');
  if (ALIASES_DEPARTAMENTO_CSV[termoCompactado]) {
    const cod = ALIASES_DEPARTAMENTO_CSV[termoCompactado];
    const unidade = UNIDADES_ORGANIZACIONAIS[cod] || UNIDADES_ORGANIZACIONAIS.NAO_CLASSIFICADO;
    return {
      codigoOriginal: valorBruto,
      unidade,
      confianca: unidade.tipo === 'NAO_CLASSIFICADO' ? 'NAO_CLASSIFICADO' : 'ALTA',
    };
  }

  // 4. Verificação por inclusão/prefixo com segurança
  if (termoCompactado.startsWith('DECOKO')) {
    return {
      codigoOriginal: valorBruto,
      unidade: UNIDADES_ORGANIZACIONAIS.DECO_KO,
      confianca: 'MEDIA',
    };
  }
  if (termoCompactado.startsWith('DACOMN')) {
    return {
      codigoOriginal: valorBruto,
      unidade: UNIDADES_ORGANIZACIONAIS.DACO_MN,
      confianca: 'MEDIA',
    };
  }

  // Prefixos são apenas padrões de reconhecimento da origem, não estruturas especiais.
  const uoPorPrefixo = localizarUoPorPrefixoEBigrama(valorBruto);
  if (uoPorPrefixo) {
    return {
      codigoOriginal: valorBruto,
      unidade: uoPorPrefixo,
      confianca: 'ALTA',
    };
  }

  // 5. Fallback Não Classificado
  return {
    codigoOriginal: valorBruto,
    unidade: UNIDADES_ORGANIZACIONAIS.NAO_CLASSIFICADO,
    confianca: 'NAO_CLASSIFICADO',
  };
}

/**
 * Registra uma nova UO em memória e associa o alias do departamento legado,
 * permitindo reclassificação instantânea e resolução futura de UOs.
 */
export function registrarNovaUOEmMemoria(
  novaUo: UnidadeOrganizacional,
  aliasDepartamentoOriginal?: string
): void {
  UNIDADES_ORGANIZACIONAIS[novaUo.codigo] = novaUo;

  if (aliasDepartamentoOriginal && aliasDepartamentoOriginal.trim()) {
    const bruto = aliasDepartamentoOriginal.trim();
    const upper = bruto.toUpperCase();
    const semAcentos = removerAcentos(upper);
    const termoLimpo = semAcentos
      .replace(/[.\-_/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const termoCompactado = semAcentos.replace(/[\s.\-_/\\]/g, '');

    ALIASES_DEPARTAMENTO_CSV[upper] = novaUo.codigo;
    ALIASES_DEPARTAMENTO_CSV[semAcentos] = novaUo.codigo;
    ALIASES_DEPARTAMENTO_CSV[termoLimpo] = novaUo.codigo;
    ALIASES_DEPARTAMENTO_CSV[termoCompactado] = novaUo.codigo;
  }
}

