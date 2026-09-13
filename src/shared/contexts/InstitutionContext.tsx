import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  ReactNode 
} from 'react';
import { 
  InstitutionSettings, 
  CargoInstituicao,
  SedeInstituicao,
  HorariosInstituicao,
  RegrasCalculoInstituicao,
  DocumentosModeloInstituicao,
  DEFAULT_INSTITUTION_SETTINGS 
} from '../types/institutionConfig';
import { institutionService } from '../services/institutionService';
import { rbacService } from '../services/rbacService';
import { authService } from '../services/authService';

export interface InstitutionContextType {
  settings: InstitutionSettings;
  cargos: CargoInstituicao[];
  sedes: SedeInstituicao[];
  horarios: HorariosInstituicao;
  regrasCalculo: RegrasCalculoInstituicao;
  documentosModelo: DocumentosModeloInstituicao;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  lastUpdated: string | null;
  updateSettings: (newSettings: Partial<InstitutionSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  canEditSettings: boolean;
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export interface InstitutionProviderProps {
  children: ReactNode;
  currentUser?: {
    role?: string;
    email?: string;
    nome?: string;
  } | null;
}

export const InstitutionProvider: React.FC<InstitutionProviderProps> = ({ 
  children, 
  currentUser 
}) => {
  const [settings, setSettings] = useState<InstitutionSettings>(DEFAULT_INSTITUTION_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Obtém o usuário ativo (via props ou sessão salva)
  const activeUser = useMemo(() => {
    if (currentUser) return currentUser;
    const session = authService.getCurrentSession();
    if (session) {
      return {
        role: session.role,
        email: session.email,
        nome: session.nome
      };
    }
    return null;
  }, [currentUser]);

  // Determina se o usuário atual possui permissão de Super Admin TI
  const canEditSettings = useMemo(() => {
    if (!activeUser) return false;
    const role = rbacService.normalizeRole(activeUser.role);
    return role === 'SUPER_ADMIN';
  }, [activeUser]);

  // Inicia a assinatura em tempo real via onSnapshot do banco de dados
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const unsubscribe = institutionService.subscribeInstitutionSettings(
      (newSettings) => {
        setSettings(newSettings);
        setLastUpdated(newSettings.atualizadoEm || new Date().toISOString());
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('[InstitutionContext] Erro ao sincronizar com banco de dados:', err);
        setError('Não foi possível sincronizar as configurações institucionais com a nuvem. Usando valores locais.');
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Função para salvar alterações nas configurações
  const updateSettings = useCallback(async (newSettings: Partial<InstitutionSettings>): Promise<void> => {
    setIsUpdating(true);
    setError(null);
    try {
      const saved = await institutionService.updateInstitutionSettings(newSettings, activeUser);
      setSettings(saved);
      setLastUpdated(saved.atualizadoEm || new Date().toISOString());
    } catch (err: any) {
      const msg = err?.message || 'Falha ao atualizar as configurações institucionais.';
      setError(msg);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [activeUser]);

  // Força atualização manual
  const refreshSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const fresh = await institutionService.getInstitutionSettings(true);
      setSettings(fresh);
      setLastUpdated(fresh.atualizadoEm || new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Falha ao recarregar configurações institucionais.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restaura para configurações padrão
  const resetToDefaults = useCallback(async (): Promise<void> => {
    await updateSettings(DEFAULT_INSTITUTION_SETTINGS);
  }, [updateSettings]);

  const value = useMemo<InstitutionContextType>(() => ({
    settings,
    cargos: settings.cargos || [],
    sedes: settings.sedes || [],
    horarios: settings.horarios,
    regrasCalculo: settings.regrasCalculo,
    documentosModelo: settings.documentosModelo,
    isLoading,
    isUpdating,
    error,
    lastUpdated,
    updateSettings,
    refreshSettings,
    resetToDefaults,
    canEditSettings
  }), [
    settings,
    isLoading,
    isUpdating,
    error,
    lastUpdated,
    updateSettings,
    refreshSettings,
    resetToDefaults,
    canEditSettings
  ]);

  return (
    <InstitutionContext.Provider value={value}>
      {children}
    </InstitutionContext.Provider>
  );
};

/**
 * Hook customizado para acessar os dados institucionais em qualquer componente da árvore React.
 */
export function useInstitution(): InstitutionContextType {
  const context = useContext(InstitutionContext);
  if (!context) {
    throw new Error('useInstitution deve ser utilizado dentro de um <InstitutionProvider>.');
  }
  return context;
}
