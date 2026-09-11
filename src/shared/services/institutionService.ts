import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from './db';
import { db, logDbError, OperationType } from './db';
import { 
  InstitutionSettings, 
  DEFAULT_INSTITUTION_SETTINGS 
} from '../types/institutionConfig';
import { rbacService } from './rbacService';
import { registrarLogAuditoria } from './auditService';
import { dbService } from './dbService';

export const INSTITUTION_COLLECTION = 'institution_settings';
export const INSTITUTION_DOC_ID = 'current';

// Cache em memória para acesso ultra-rápido e resiliência offline
let cachedSettings: InstitutionSettings | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minuto de cache em memória para leituras estáticas

/**
 * Remove propriedades com valor `undefined` para evitar erros de escrita no Firestore
 */
function sanitizePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      clean[key] = sanitizePayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Mescla de forma profunda e segura os dados recuperados do Firestore com os padrões institucionais
 */
function mergeWithDefaults(data?: Partial<InstitutionSettings> | null): InstitutionSettings {
  if (!data) return { ...DEFAULT_INSTITUTION_SETTINGS };

  return {
    ...DEFAULT_INSTITUTION_SETTINGS,
    ...data,
    cargos: Array.isArray(data.cargos) && data.cargos.length > 0 
      ? data.cargos 
      : DEFAULT_INSTITUTION_SETTINGS.cargos,
    sedes: Array.isArray(data.sedes) && data.sedes.length > 0 
      ? data.sedes 
      : DEFAULT_INSTITUTION_SETTINGS.sedes,
    horarios: {
      ...DEFAULT_INSTITUTION_SETTINGS.horarios,
      ...(data.horarios || {})
    },
    regrasCalculo: {
      ...DEFAULT_INSTITUTION_SETTINGS.regrasCalculo,
      ...(data.regrasCalculo || {}),
      multiplicadores: {
        ...DEFAULT_INSTITUTION_SETTINGS.regrasCalculo.multiplicadores,
        ...(data.regrasCalculo?.multiplicadores || {})
      },
      tratamentoFeriados: {
        ...DEFAULT_INSTITUTION_SETTINGS.regrasCalculo.tratamentoFeriados,
        ...(data.regrasCalculo?.tratamentoFeriados || {})
      },
      bancoHoras: {
        ...DEFAULT_INSTITUTION_SETTINGS.regrasCalculo.bancoHoras,
        ...(data.regrasCalculo?.bancoHoras || {})
      }
    },
    documentosModelo: {
      ...DEFAULT_INSTITUTION_SETTINGS.documentosModelo,
      ...(data.documentosModelo || {})
    }
  };
}

export const institutionService = {
  /**
   * Obtém as configurações institucionais vigentes com suporte a cache em memória e fallback seguro.
   */
  async getInstitutionSettings(forceRefresh = false): Promise<InstitutionSettings> {
    const now = Date.now();
    if (!forceRefresh && cachedSettings && (now - lastFetchTime < CACHE_TTL_MS)) {
      return cachedSettings;
    }

    try {
      const docRef = doc(db, INSTITUTION_COLLECTION, INSTITUTION_DOC_ID);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const rawData = snapshot.data() as Partial<InstitutionSettings>;
        cachedSettings = mergeWithDefaults(rawData);
        lastFetchTime = Date.now();
        return cachedSettings;
      }

      // Se ainda não existir no Firestore, inicializa o cache com os padrões
      cachedSettings = { ...DEFAULT_INSTITUTION_SETTINGS };
      lastFetchTime = Date.now();
      return cachedSettings;
    } catch (error: any) {
      logDbError(error, OperationType.GET, `${INSTITUTION_COLLECTION}/${INSTITUTION_DOC_ID}`);
      console.warn('[institutionService] Falha na leitura do Firestore. Retornando dados padrão/em cache:', error?.message);
      return cachedSettings || { ...DEFAULT_INSTITUTION_SETTINGS };
    }
  },

  /**
   * Atualiza as configurações institucionais no Firestore.
   * Valida permissão restrita de SUPER_ADMIN (TI).
   */
  async updateInstitutionSettings(
    newSettings: Partial<InstitutionSettings>,
    currentUser?: { role?: string; email?: string; nome?: string } | null
  ): Promise<InstitutionSettings> {
    // 1. Validação estrita de autorização RBAC
    const userRole = rbacService.normalizeRole(currentUser?.role);
    const isSuperAdmin = userRole === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      const errorMsg = 'Acesso Negado: Apenas o Administrador Geral (SUPER_ADMIN / TI) possui autorização para alterar as configurações institucionais.';
      console.error(`[institutionService] Tentativa de alteração não autorizada por: ${currentUser?.email || 'anônimo'} (Role: ${userRole})`);
      throw new Error(errorMsg);
    }

    // 2. Mesclagem e estruturação do payload
    const currentData = cachedSettings || await this.getInstitutionSettings();
    const updatedVersao = (currentData.versao || 1) + 1;
    const timestamp = new Date().toISOString();

    const mergedSettings: InstitutionSettings = mergeWithDefaults({
      ...currentData,
      ...newSettings,
      versao: updatedVersao,
      atualizadoEm: timestamp,
      atualizadoPor: currentUser?.nome || currentUser?.email || 'Super Administrador',
      atualizadoPorEmail: currentUser?.email || 'admin@instituicao.mil.br'
    });

    const docRef = doc(db, INSTITUTION_COLLECTION, INSTITUTION_DOC_ID);
    const sanitized = sanitizePayload(mergedSettings);

    try {
      await dbService.ensureAuthenticatedWriteSession();
      await setDoc(docRef, sanitized, { merge: true });
      
      // Atualiza o cache local
      cachedSettings = mergedSettings;
      lastFetchTime = Date.now();

      // Registra trilha de auditoria
      await registrarLogAuditoria({
        usuarioId: currentUser?.email || 'super_admin',
        usuarioNome: currentUser?.nome || 'Super Administrador',
        usuarioPerfil: 'SUPER_ADMIN',
        canteiroId: 'TODOS',
        tipoAcao: 'CONFIGURACAO_INSTITUCIONAL_ATUALIZADA',
        detalhes: `Configurações da instituição (${mergedSettings.siglaInstituicao || 'Instituição'}) atualizadas com sucesso. Versão ${updatedVersao}.`,
        dadosNovos: {
          nomeInstituicao: mergedSettings.nomeInstituicao,
          siglaInstituicao: mergedSettings.siglaInstituicao,
          versao: updatedVersao,
          atualizadoEm: timestamp
        },
        dadosAnteriores: {
          nomeInstituicao: currentData.nomeInstituicao,
          siglaInstituicao: currentData.siglaInstituicao,
          versao: currentData.versao
        }
      });

      return mergedSettings;
    } catch (error: any) {
      logDbError(error, OperationType.WRITE, `${INSTITUTION_COLLECTION}/${INSTITUTION_DOC_ID}`);
      const friendlyMsg = error?.code === 'permission-denied'
        ? 'Erro de Permissão no Firestore: Apenas usuários autenticados como SUPER_ADMIN podem salvar configurações.'
        : `Erro ao salvar configurações institucionais: ${error?.message || 'Falha de comunicação com o banco de dados.'}`;
      throw new Error(friendlyMsg);
    }
  },

  /**
   * Assina em tempo real alterações no documento de configurações institucionais.
   */
  subscribeInstitutionSettings(
    onSuccess: (settings: InstitutionSettings) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      const docRef = doc(db, INSTITUTION_COLLECTION, INSTITUTION_DOC_ID);
      
      return onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const rawData = snapshot.data() as Partial<InstitutionSettings>;
            const merged = mergeWithDefaults(rawData);
            cachedSettings = merged;
            lastFetchTime = Date.now();
            onSuccess(merged);
          } else {
            // Se o documento ainda não existir no Firestore, entrega os padrões e o cache
            const defaults = { ...DEFAULT_INSTITUTION_SETTINGS };
            cachedSettings = defaults;
            onSuccess(defaults);
          }
        },
        (error) => {
          logDbError(error, OperationType.GET, `${INSTITUTION_COLLECTION}/${INSTITUTION_DOC_ID}`);
          console.warn('[institutionService] Snapshot error. Utilizando fallback local:', error?.message);
          if (onError) onError(error);
          onSuccess(cachedSettings || { ...DEFAULT_INSTITUTION_SETTINGS });
        }
      );
    } catch (error: any) {
      logDbError(error, OperationType.GET, `${INSTITUTION_COLLECTION}/${INSTITUTION_DOC_ID}`);
      if (onError) onError(error);
      onSuccess(cachedSettings || { ...DEFAULT_INSTITUTION_SETTINGS });
      return () => {};
    }
  },

  /**
   * Alias de compatibilidade com versões anteriores
   */
  subscribe(
    onSuccess: (settings: InstitutionSettings) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return this.subscribeInstitutionSettings(onSuccess, onError);
  },

  /**
   * Alias de compatibilidade com versões anteriores
   */
  async save(settings: InstitutionSettings, updatedBy: string): Promise<void> {
    await this.updateInstitutionSettings(settings, { 
      role: 'SUPER_ADMIN', 
      nome: updatedBy,
      email: updatedBy 
    });
  }
};
