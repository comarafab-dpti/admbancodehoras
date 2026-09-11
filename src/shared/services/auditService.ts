import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  where,
  Unsubscribe 
} from './db';
import { db, logDbError, OperationType } from './db';
import { AuditLog, AuditActionType } from '../types';
import { dbService } from './dbService';

export const AUDIT_COLLECTION = 'logs_auditoria';

export interface DadosLogAuditoria {
  usuarioId: string;
  usuarioNome: string;
  usuarioPerfil?: string;
  canteiroId: string;
  tipoAcao: AuditActionType | string;
  detalhes: string;
  recursoId?: string;
  detalhesJson?: Record<string, any>;
  dadosAnteriores?: Record<string, any>;
  dadosNovos?: Record<string, any>;
  ipOrigem?: string;
}

export type RegisterAuditParams = DadosLogAuditoria & {
  nomeUsuario?: string;
  acao?: AuditActionType | string;
};

/**
 * Função utilitária global para salvar registros estruturados na coleção `logs_auditoria` do Firestore.
 * Execução assíncrona não-bloqueante para não interromper os fluxos de trabalho do operador.
 */
export async function registrarLogAuditoria(dadosLog: DadosLogAuditoria | RegisterAuditParams): Promise<void> {
  try {
    const now = new Date();
    const auditId = `audit_${now.getTime()}_${Math.floor(1000 + Math.random() * 9000)}`;
    
    const usuarioNomeFinal = (dadosLog.usuarioNome || (dadosLog as any).nomeUsuario || 'Operador do Sistema').trim();
    const tipoAcaoFinal = (dadosLog.tipoAcao || (dadosLog as any).acao || 'ACAO_SISTEMA').trim();
    const usuarioPerfilFinal = (dadosLog.usuarioPerfil || 'OPERADOR').trim().toUpperCase();
    const canteiroIdFinal = (dadosLog.canteiroId || 'TODOS').trim().toUpperCase();
    const usuarioIdFinal = (dadosLog.usuarioId || 'sistema@comara.aer.mil.br').trim();

    const payload: Record<string, any> = {
      id: auditId,
      timestamp: now.toISOString(),
      usuarioId: usuarioIdFinal,
      usuarioNome: usuarioNomeFinal,
      nomeUsuario: usuarioNomeFinal, // Alias retrocompatível
      usuarioPerfil: usuarioPerfilFinal,
      canteiroId: canteiroIdFinal,
      tipoAcao: tipoAcaoFinal,
      acao: tipoAcaoFinal, // Alias retrocompatível
      detalhes: dadosLog.detalhes || '',
    };

    if (dadosLog.recursoId) payload.recursoId = dadosLog.recursoId;
    if (dadosLog.detalhesJson) payload.detalhesJson = dadosLog.detalhesJson;
    if (dadosLog.dadosAnteriores) payload.dadosAnteriores = dadosLog.dadosAnteriores;
    if (dadosLog.dadosNovos) payload.dadosNovos = dadosLog.dadosNovos;
    if (dadosLog.ipOrigem) payload.ipOrigem = dadosLog.ipOrigem;

    // Sanitizar chaves undefined
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(payload)) {
      if (payload[key] !== undefined) {
        sanitized[key] = payload[key];
      }
    }

    await dbService.ensureAuthenticatedWriteSession();
    await setDoc(doc(db, AUDIT_COLLECTION, auditId), sanitized);
    console.info(`[AUDIT] Log registrado com sucesso: [${tipoAcaoFinal}] ${dadosLog.detalhes}`);
  } catch (err) {
    console.warn('[AUDIT] Falha não-bloqueante ao registrar log de auditoria:', err);
  }
}

export const auditService = {
  /**
   * Registra log de auditoria
   */
  registrarLogAuditoria,

  /**
   * Alias de compatibilidade
   */
  async logAction(params: RegisterAuditParams): Promise<void> {
    return registrarLogAuditoria(params);
  },

  /**
   * Assina em tempo real a trilha de auditoria dos últimos registros.
   */
  subscribeAuditLogs(
    onSuccess: (logs: AuditLog[]) => void,
    onError?: (error: Error) => void,
    maxLimit: number = 200
  ): Unsubscribe {
    try {
      const q = query(
        collection(db, AUDIT_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(maxLimit)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: AuditLog[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const userNome = data.usuarioNome || data.nomeUsuario || 'Operador';
              const act = data.tipoAcao || data.acao || 'ACAO_SISTEMA';
              list.push({
                id: docSnap.id,
                usuarioId: data.usuarioId || '',
                usuarioNome: userNome,
                nomeUsuario: userNome,
                usuarioPerfil: data.usuarioPerfil || 'OPERADOR',
                tipoAcao: act,
                acao: act,
                detalhes: data.detalhes || '',
                detalhesJson: data.detalhesJson,
                canteiroId: data.canteiroId || 'TODOS',
                timestamp: data.timestamp || new Date().toISOString(),
                ipOrigem: data.ipOrigem,
                recursoId: data.recursoId,
                dadosAnteriores: data.dadosAnteriores,
                dadosNovos: data.dadosNovos,
              });
            });
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de logs de auditoria:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logDbError(error, OperationType.LIST, AUDIT_COLLECTION);
          if (onError) onError(error);
        }
      );
    } catch (error: any) {
      logDbError(error, OperationType.LIST, AUDIT_COLLECTION);
      if (onError) onError(error);
      return () => {};
    }
  },

  /**
   * Busca paginada ou filtrada sob demanda
   */
  async getAuditLogs(filter?: { canteiroId?: string; tipoAcao?: string; maxLimit?: number }): Promise<AuditLog[]> {
    try {
      const max = filter?.maxLimit || 150;
      const q = query(
        collection(db, AUDIT_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(max)
      );

      const snapshot = await getDocs(q);
      const list: AuditLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const userNome = data.usuarioNome || data.nomeUsuario || 'Operador';
        const act = data.tipoAcao || data.acao || 'ACAO_SISTEMA';
        list.push({
          id: docSnap.id,
          usuarioId: data.usuarioId || '',
          usuarioNome: userNome,
          nomeUsuario: userNome,
          usuarioPerfil: data.usuarioPerfil || 'OPERADOR',
          tipoAcao: act,
          acao: act,
          detalhes: data.detalhes || '',
          detalhesJson: data.detalhesJson,
          canteiroId: data.canteiroId || 'TODOS',
          timestamp: data.timestamp || new Date().toISOString(),
          ipOrigem: data.ipOrigem,
          recursoId: data.recursoId,
          dadosAnteriores: data.dadosAnteriores,
          dadosNovos: data.dadosNovos,
        });
      });

      return list.filter((log) => {
        if (filter?.canteiroId && filter.canteiroId !== 'TODOS' && log.canteiroId !== filter.canteiroId && log.canteiroId !== 'TODOS') {
          return false;
        }
        if (filter?.tipoAcao && filter.tipoAcao !== 'TODOS' && log.tipoAcao !== filter.tipoAcao) {
          return false;
        }
        return true;
      });
    } catch (error: any) {
      logDbError(error, OperationType.LIST, AUDIT_COLLECTION);
      return [];
    }
  }
};
