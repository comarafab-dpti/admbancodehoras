import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from './db';
import { db, logDbError, OperationType } from './db';
import { UnidadeOrganizacional, Employee, TipoUnidadeOrganizacional } from '../types';
import {
  UNIDADES_ORGANIZACIONAIS,
  UNIDADES_ORGANIZACIONAIS_COLLECTION,
  obterSetorDefault
} from '../constants/unidadesOrganizacionais';
import { localCache } from './localCache';

const CACHE_KEY_SETORES = 'unidades_organizacionais_setores';

export interface DependenciasUO {
  temDependencias: boolean;
  totalFilhos: number;
  totalColaboradores: number;
  filhos: UnidadeOrganizacional[];
  mensagemBloqueio?: string;
}

/**
 * Sugere um código padronizado conforme convenção de cada tipo de UO:
 * - SEDE -> SEDE_XX (ex: SEDE_BE)
 * - DACO -> DACO_XX (ex: DACO_MN)
 * - DECO -> DECO_XX (ex: DECO_KO)
 * - SETOR -> SETOR_NOME (ex: SETOR_DAPC)
 */
export function gerarSugestaoCodigoUO(
  tipo: TipoUnidadeOrganizacional,
  sigla: string,
  nome?: string
): string {
  const base = (sigla || nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (tipo === 'SEDE') {
    if (base.startsWith('SEDE_')) return base;
    return `SEDE_${base || 'NOVA'}`;
  }
  if (tipo === 'DACO') {
    if (base.startsWith('DACO_')) return base;
    return `DACO_${base || 'NOVO'}`;
  }
  if (tipo === 'DECO') {
    if (base.startsWith('DECO_')) return base;
    return `DECO_${base || 'NOVO'}`;
  }
  // SETOR
  if (base.startsWith('SETOR_')) return base;
  return `SETOR_${base || 'NOVO'}`;
}

/**
 * Normaliza um texto para formar código de setor válido (ex: SETOR_SAQ).
 * Mantido para compatibilidade regressiva.
 */
export function gerarSugestaoCodigoSetor(sigla: string, nome?: string): string {
  return gerarSugestaoCodigoUO('SETOR', sigla, nome);
}

export const setorService = {
  /**
   * Assinatura em tempo real de todas as Unidades Organizacionais e Setores.
   */
  subscribeSetores(
    onUpdate: (setores: UnidadeOrganizacional[], todasUOs: UnidadeOrganizacional[]) => void,
    onError?: (err: any) => void,
    realtime = false
  ): Unsubscribe {
    let unsubscribe: Unsubscribe = () => {};

    try {
      const colRef = collection(db, UNIDADES_ORGANIZACIONAIS_COLLECTION);
      
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          // Atualiza mapa em memória com o que veio do Firestore
          snapshot.forEach((itemDoc) => {
            const data = itemDoc.data() as Partial<UnidadeOrganizacional>;
            if (data.codigo && data.nome && data.tipo) {
              UNIDADES_ORGANIZACIONAIS[data.codigo] = {
                codigo: data.codigo,
                nome: data.nome,
                siglaExibicao: data.siglaExibicao || data.codigo,
                tipo: data.tipo,
                sedeOuCanteiroPadrao: data.sedeOuCanteiroPadrao || 'BE',
                pai: data.pai,
                ativa: typeof data.ativa === 'boolean' ? data.ativa : true,
                descricao: data.descricao || ''
              };
            }
          });

          const todas = Object.values(UNIDADES_ORGANIZACIONAIS).filter(
            (u) => u.codigo !== 'NAO_CLASSIFICADO'
          );
          const setores = todas.filter((u) => u.tipo === 'SETOR');

          // Salva no cache local para resiliência offline
          localCache.setCache(CACHE_KEY_SETORES, { todas, setores });

          onUpdate(setores, todas);
        },
        (error) => {
          logDbError(error, OperationType.LIST, UNIDADES_ORGANIZACIONAIS_COLLECTION);
          if (onError) onError(error);

          // Fallback gracioso para dados locais em memória/cache
          const todas = Object.values(UNIDADES_ORGANIZACIONAIS).filter(
            (u) => u.codigo !== 'NAO_CLASSIFICADO'
          );
          const setores = todas.filter((u) => u.tipo === 'SETOR');
          onUpdate(setores, todas);
        },
        { realtime }
      );
    } catch (err) {
      console.warn('Fallback offline para setores:', err);
      const todas = Object.values(UNIDADES_ORGANIZACIONAIS).filter(
        (u) => u.codigo !== 'NAO_CLASSIFICADO'
      );
      const setores = todas.filter((u) => u.tipo === 'SETOR');
      onUpdate(setores, todas);
    }

    return unsubscribe;
  },

  /**
   * Obtém a lista atual de setores e UOs (síncrona / do catálogo em memória)
   */
  getSetoresAtuais(): { setores: UnidadeOrganizacional[]; todasUOs: UnidadeOrganizacional[]; uosPrincipais: UnidadeOrganizacional[] } {
    const todas = Object.values(UNIDADES_ORGANIZACIONAIS).filter(
      (u) => u.codigo !== 'NAO_CLASSIFICADO'
    );
    const setores = todas.filter((u) => u.tipo === 'SETOR');
    const uosPrincipais = todas.filter((u) => u.tipo !== 'SETOR');

    return { setores, todasUOs: todas, uosPrincipais };
  },

  /**
   * Salva ou atualiza uma UO (qualquer tipo: SETOR, DECO, DACO, SEDE)
   * na coleção 'unidades_organizacionais'.
   * Se o código tiver sido renomeado, exclui o documento anterior com segurança.
   */
  async salvarSetor(setor: UnidadeOrganizacional, codigoAntigo?: string): Promise<void> {
    const codigoLimpo = setor.codigo.trim().toUpperCase();
    const tipoValido: TipoUnidadeOrganizacional = setor.tipo || 'SETOR';
    
    // Regra condicional de UO Pai:
    // - SETOR: pai é obrigatório e vincula a uma UO pai (SEDE/DACO/DECO)
    // - DECO, DACO, SEDE: pai implícito = 'COMARA'
    let paiFinal = setor.pai;
    if (tipoValido === 'SETOR') {
      paiFinal = (setor.pai && setor.pai !== 'COMARA') ? setor.pai : 'SEDE_BE';
    } else {
      paiFinal = 'COMARA';
    }

    const dadosFinais: UnidadeOrganizacional = {
      codigo: codigoLimpo,
      nome: setor.nome.trim(),
      siglaExibicao: setor.siglaExibicao.trim().toUpperCase(),
      tipo: tipoValido,
      sedeOuCanteiroPadrao: setor.sedeOuCanteiroPadrao || 'BE',
      pai: paiFinal,
      ativa: typeof setor.ativa === 'boolean' ? setor.ativa : true,
      descricao: setor.descricao ? setor.descricao.trim() : ''
    };

    // 1. Se houve renomeação do código de identificação, remove o antigo
    if (codigoAntigo && codigoAntigo !== codigoLimpo) {
      try {
        const oldDocRef = doc(db, UNIDADES_ORGANIZACIONAIS_COLLECTION, codigoAntigo);
        await deleteDoc(oldDocRef);
      } catch (e) {
        console.warn('Aviso ao remover código anterior no Firestore:', e);
      }
      delete UNIDADES_ORGANIZACIONAIS[codigoAntigo];
    }

    // 2. Persiste no Firestore / Supabase
    try {
      const docRef = doc(db, UNIDADES_ORGANIZACIONAIS_COLLECTION, codigoLimpo);
      await setDoc(docRef, dadosFinais, { merge: true });
    } catch (e) {
      logDbError(e, OperationType.WRITE, `${UNIDADES_ORGANIZACIONAIS_COLLECTION}/${codigoLimpo}`);
      console.warn('Erro ao salvar UO no Firestore, mantendo em memória e cache local:', e);
    }

    // 3. Atualiza catálogo em memória
    UNIDADES_ORGANIZACIONAIS[codigoLimpo] = dadosFinais;

    // 4. Invalida cache local
    localCache.clearCache(CACHE_KEY_SETORES);
  },

  /**
   * Verifica se a UO possui dependências (filhos na árvore ou colaboradores vinculados).
   * Impede exclusões acidentais que corrompam a árvore ou relatórios contábeis.
   */
  verificarDependenciasUO(
    codigo: string,
    employees: Employee[] = [],
    todasUOs?: UnidadeOrganizacional[]
  ): DependenciasUO {
    const codNorm = (codigo || '').trim().toUpperCase();
    if (!codNorm) {
      return { temDependencias: false, totalFilhos: 0, totalColaboradores: 0, filhos: [] };
    }

    // 1. Filhos (outras UOs que têm esta UO como pai)
    const listaUOs = todasUOs && todasUOs.length > 0 
      ? todasUOs 
      : Object.values(UNIDADES_ORGANIZACIONAIS);
      
    const filhos = listaUOs.filter(
      (u) => u.codigo.toUpperCase() !== codNorm && (u.pai || '').trim().toUpperCase() === codNorm
    );
    const totalFilhos = filhos.length;

    // 2. Colaboradores vinculados (lotação administrativa, UO de execução ou departamento)
    const colaboradores = employees.filter((emp) => {
      const lotacao = (emp.lotacaoUoCodigo || emp.lotacao || '').trim().toUpperCase();
      const execucao = (emp.uoExecucaoCodigo || emp.uoExecucao || '').trim().toUpperCase();
      const depto = (emp.departamentoOriginal || emp.departamento || '').trim().toUpperCase();
      return lotacao === codNorm || execucao === codNorm || depto === codNorm;
    });
    const totalColaboradores = colaboradores.length;

    const temDependencias = totalFilhos > 0 || totalColaboradores > 0;
    let mensagemBloqueio: string | undefined;

    if (temDependencias) {
      mensagemBloqueio = `Esta UO tem dependências (${totalFilhos} filhos, ${totalColaboradores} colaboradores). Desative-a em vez de excluir.`;
    }

    return {
      temDependencias,
      totalFilhos,
      totalColaboradores,
      filhos,
      mensagemBloqueio
    };
  },

  /**
   * Remove uma UO do catálogo oficial, garantindo que não haja dependências ativas.
   */
  async excluirSetor(
    codigo: string,
    employees: Employee[] = [],
    todasUOs?: UnidadeOrganizacional[]
  ): Promise<void> {
    const codigoLimpo = codigo.trim().toUpperCase();

    // 0. Validação de dependências pré-exclusão
    const dep = this.verificarDependenciasUO(codigoLimpo, employees, todasUOs);
    if (dep.temDependencias) {
      throw new Error(
        dep.mensagemBloqueio ||
          `Esta UO tem dependências (${dep.totalFilhos} filhos, ${dep.totalColaboradores} colaboradores). Desative-a em vez de excluir.`
      );
    }

    // 1. Exclui do Firestore
    try {
      const docRef = doc(db, UNIDADES_ORGANIZACIONAIS_COLLECTION, codigoLimpo);
      await deleteDoc(docRef);
    } catch (e) {
      logDbError(e, OperationType.DELETE, `${UNIDADES_ORGANIZACIONAIS_COLLECTION}/${codigoLimpo}`);
      console.warn('Erro ao excluir UO no Firestore, removendo de memória local:', e);
    }

    // 2. Remove da memória
    delete UNIDADES_ORGANIZACIONAIS[codigoLimpo];

    // 3. Invalida cache
    localCache.clearCache(CACHE_KEY_SETORES);
  },

  /**
   * Alterna o status ativo/inativo de uma UO (qualquer tipo).
   */
  async alternarStatusSetor(codigo: string, ativa: boolean): Promise<void> {
    const setorExistente = UNIDADES_ORGANIZACIONAIS[codigo];
    if (!setorExistente) return;

    await this.salvarSetor({
      ...setorExistente,
      ativa
    });
  },

  /**
   * Conta colaboradores alocados por UO (pelo código, lotação, execução ou departamento).
   */
  contarColaboradoresPorSetor(employees: Employee[] = []): Record<string, number> {
    const contagem: Record<string, number> = {};

    employees.forEach((emp) => {
      // 1. Lotação canônica ou direta
      if (emp.lotacaoUoCodigo) {
        contagem[emp.lotacaoUoCodigo] = (contagem[emp.lotacaoUoCodigo] || 0) + 1;
      }
      if (emp.lotacao && emp.lotacao !== emp.lotacaoUoCodigo) {
        contagem[emp.lotacao] = (contagem[emp.lotacao] || 0) + 1;
      }

      // 2. UO Execução canônica ou direta
      if (emp.uoExecucaoCodigo && emp.uoExecucaoCodigo !== emp.lotacaoUoCodigo) {
        contagem[emp.uoExecucaoCodigo] = (contagem[emp.uoExecucaoCodigo] || 0) + 1;
      }
      if (emp.uoExecucao && emp.uoExecucao !== emp.lotacao && emp.uoExecucao !== emp.uoExecucaoCodigo) {
        contagem[emp.uoExecucao] = (contagem[emp.uoExecucao] || 0) + 1;
      }

      // 3. Departamento original
      if (emp.departamentoOriginal) {
        const deptNorm = emp.departamentoOriginal.toUpperCase().trim();
        contagem[deptNorm] = (contagem[deptNorm] || 0) + 1;
      }
    });

    return contagem;
  }
};
