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
import { UnidadeOrganizacional, Employee } from '../types';
import {
  UNIDADES_ORGANIZACIONAIS,
  UNIDADES_ORGANIZACIONAIS_COLLECTION,
  obterSetorDefault
} from '../constants/unidadesOrganizacionais';
import { localCache } from './localCache';

const CACHE_KEY_SETORES = 'unidades_organizacionais_setores';

/**
 * Normaliza um texto para formar código de setor válido (ex: SETOR_SAQ).
 */
export function gerarSugestaoCodigoSetor(sigla: string, nome?: string): string {
  const base = (sigla || nome || 'SETOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (base.startsWith('SETOR_')) {
    return base;
  }
  return `SETOR_${base}`;
}

export const setorService = {
  /**
   * Assinatura em tempo real de todas as Unidades Organizacionais e Setores.
   */
  subscribeSetores(
    onUpdate: (setores: UnidadeOrganizacional[], todasUOs: UnidadeOrganizacional[]) => void,
    onError?: (err: any) => void
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
        }
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
   * Salva ou atualiza um setor na coleção 'unidades_organizacionais'.
   * Se o código tiver sido renomeado, exclui o documento anterior com segurança.
   */
  async salvarSetor(setor: UnidadeOrganizacional, codigoAntigo?: string): Promise<void> {
    const codigoLimpo = setor.codigo.trim().toUpperCase();
    const dadosFinais: UnidadeOrganizacional = {
      codigo: codigoLimpo,
      nome: setor.nome.trim(),
      siglaExibicao: setor.siglaExibicao.trim().toUpperCase(),
      tipo: 'SETOR',
      sedeOuCanteiroPadrao: setor.sedeOuCanteiroPadrao || 'BE',
      pai: setor.pai || 'SEDE_BE',
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

    // 2. Persiste no Firestore
    try {
      const docRef = doc(db, UNIDADES_ORGANIZACIONAIS_COLLECTION, codigoLimpo);
      await setDoc(docRef, dadosFinais, { merge: true });
    } catch (e) {
      logDbError(e, OperationType.WRITE, `${UNIDADES_ORGANIZACIONAIS_COLLECTION}/${codigoLimpo}`);
      console.warn('Erro ao salvar setor no Firestore, mantendo em memória e cache local:', e);
    }

    // 3. Atualiza catálogo em memória
    UNIDADES_ORGANIZACIONAIS[codigoLimpo] = dadosFinais;

    // 4. Invalida cache local
    localCache.clearCache(CACHE_KEY_SETORES);
  },

  /**
   * Remove um setor do catálogo oficial.
   */
  async excluirSetor(codigo: string): Promise<void> {
    const codigoLimpo = codigo.trim().toUpperCase();

    // 1. Exclui do Firestore
    try {
      const docRef = doc(db, UNIDADES_ORGANIZACIONAIS_COLLECTION, codigoLimpo);
      await deleteDoc(docRef);
    } catch (e) {
      logDbError(e, OperationType.DELETE, `${UNIDADES_ORGANIZACIONAIS_COLLECTION}/${codigoLimpo}`);
      console.warn('Erro ao excluir setor no Firestore, removendo de memória local:', e);
    }

    // 2. Remove da memória
    delete UNIDADES_ORGANIZACIONAIS[codigoLimpo];

    // 3. Invalida cache
    localCache.clearCache(CACHE_KEY_SETORES);
  },

  /**
   * Alterna o status ativo/inativo de um setor.
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
   * Conta colaboradores alocados por setor (pelo código ou sigla de departamento).
   */
  contarColaboradoresPorSetor(employees: Employee[] = []): Record<string, number> {
    const contagem: Record<string, number> = {};

    employees.forEach((emp) => {
      // 1. Lotação direta
      if (emp.lotacaoUoCodigo) {
        contagem[emp.lotacaoUoCodigo] = (contagem[emp.lotacaoUoCodigo] || 0) + 1;
      }
      // 2. UO Execução
      if (emp.uoExecucaoCodigo && emp.uoExecucaoCodigo !== emp.lotacaoUoCodigo) {
        contagem[emp.uoExecucaoCodigo] = (contagem[emp.uoExecucaoCodigo] || 0) + 1;
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
