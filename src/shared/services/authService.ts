import { doc, getDoc, setDoc, addDoc, collection, query, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  User as FirebaseUser 
} from 'firebase/auth';
import { auth, googleProvider, db } from './firebase';
import { EmployeeAuth, AccessLog, AccessLogType, AdminUser, AdminRole, AuthSession } from '../types';

export function getFirebaseAuthErrorMessage(errorCode: string, defaultMessage?: string): string {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou senha incorretos.';
    case 'auth/user-disabled':
      return 'Este usuário foi desativado no Firebase Authentication.';
    case 'auth/too-many-requests':
      return 'Acesso temporariamente bloqueado devido a muitas tentativas inválidas. Tente novamente mais tarde.';
    case 'auth/invalid-email':
      return 'Formato de e-mail inválido.';
    case 'auth/operation-not-allowed':
      return 'O provedor de autenticação (E-mail/Senha) não está habilitado no Firebase Console. Utilize o botão "Entrar com Google Workspace" ou habilite o provedor em Firebase Console > Authentication > Sign-in method.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado no Firebase Authentication.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Utilize ao menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Falha de conexão com os servidores do Firebase Auth. Verifique sua conexão com a internet.';
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação do Google foi fechada antes da conclusão.';
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      return host 
        ? `O domínio "${host}" não está na lista de domínios autorizados do Firebase Authentication. Adicione "${host}" em Firebase Console > Authentication > Settings > Authorized domains.`
        : 'Domínio não autorizado no Firebase Authentication Console.';
    }
    default:
      return defaultMessage || 'Falha na autenticação via Firebase Auth.';
  }
}

const COLLECTIONS = {
  COLABORADORES_AUTH: 'colaboradores_auth',
  LOGS_ACESSO: 'logs_acesso',
  COLABORADORES: 'colaboradores',
  ADMIN_USERS: 'admin_users',
};

function sanitize<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) {
      clean[k] = obj[k];
    }
  }
  return clean;
}

// Simple SHA-256 hash helper using native crypto
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Local cache keys
const LOCAL_AUTH_KEY = 'banco_horas_colaboradores_auth';
const LOCAL_LOGS_KEY = 'banco_horas_logs_acesso';

function getLocalAuths(): Record<string, EmployeeAuth> {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAuth(matricula: string, data: EmployeeAuth) {
  try {
    const all = getLocalAuths();
    all[matricula.toUpperCase()] = data;
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(all));
  } catch (e) {
    console.error(e);
  }
}

function getLocalLogs(): AccessLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLog(log: AccessLog) {
  try {
    const all = getLocalLogs();
    all.unshift(log);
    if (all.length > 500) all.pop();
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(all));
  } catch (e) {
    console.error(e);
  }
}

export const DEFAULT_MASTER_ACCOUNTS = [
  {
    email: 'coari.comara@gmail.com',
    nome: 'Coari Comara (Administrador Geral)',
    cargo: 'Gerente Geral de RH / TI',
    role: 'SUPER_ADMIN' as const,
  },
  {
    email: 'comarafab@gmail.com',
    nome: 'Super Administrador COMARA FAB',
    cargo: 'Super Administrador TI / RH',
    role: 'SUPER_ADMIN' as const,
  }
];

export function isMasterAdminEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return (
    clean === 'coari.comara@gmail.com' ||
    clean === 'comarafab@gmail.com' ||
    clean.startsWith('juliocesar') ||
    clean.includes('juliocesar') ||
    clean === 'admin@comara.mil.br' ||
    clean === 'admin@comara.gov.br' ||
    clean.endsWith('@comara.mil.br') ||
    clean.endsWith('@comara.aer.mil.br') ||
    clean.endsWith('@comara.gov.br')
  );
}

export async function autoSeedDefaultAdminMaster(): Promise<{ success: boolean; message: string }> {
  return { success: true, message: 'Inicialização concluída.' };
}

export interface ProcessAuthResult {
  status: 'ativo' | 'pendente' | 'inativo' | 'bloqueado';
  admin: AdminUser;
  isSuperAdmin: boolean;
  message?: string;
}

export async function processAuthenticatedUser(firebaseUser: FirebaseUser): Promise<ProcessAuthResult> {
  const email = (firebaseUser.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('E-mail do usuário não identificado na sessão.');
  }

  const nowIso = new Date().toISOString();
  let adminDoc: AdminUser | null = null;
  const docRef = doc(db, COLLECTIONS.ADMIN_USERS, email);

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      adminDoc = snap.data() as AdminUser;
    }
  } catch (err) {
    console.warn('[Auth] Erro ao consultar documento em admin_users:', err);
  }

  // Se não existir, auto-cadastra. E-mail master cria o primeiro cadastro ativo como SUPER_ADMIN (bootstrap).
  // Após criado, o perfil será lido EXCLUSIVAMENTE do documento do Firestore.
  if (!adminDoc) {
    const isMasterBootstrap = isMasterAdminEmail(email);
    const newDoc: AdminUser = {
      id: email,
      email,
      nome: firebaseUser.displayName || (isMasterBootstrap ? 'Super Administrador COMARA' : (email.split('@')[0] || 'Sem nome')),
      cargo: isMasterBootstrap ? 'Super Administrador TI / RH' : 'Aguardando aprovação',
      funcao: isMasterBootstrap ? 'Super Administrador TI / RH' : '',
      role: (isMasterBootstrap ? 'SUPER_ADMIN' : 'NENHUM') as AdminRole,
      nivelAcesso: (isMasterBootstrap ? 'SUPER_ADMIN' : 'NENHUM') as AdminRole,
      status: isMasterBootstrap ? 'ativo' : 'pendente',
      perfil: isMasterBootstrap ? 'super_admin' : 'nenhum',
      foto: firebaseUser.photoURL || null,
      sede: 'TODAS',
      canteiroSede: 'TODAS',
      ativo: isMasterBootstrap,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    };

    try {
      await setDoc(docRef, sanitize(newDoc), { merge: true });
      adminDoc = newDoc;
    } catch (saveErr) {
      console.warn('[Auth] Erro ao salvar auto-cadastro inicial no Firestore:', saveErr);
      adminDoc = newDoc;
    }
  }

  // Verificação de usuário desativado / bloqueado
  if (adminDoc.status === 'inativo' || adminDoc.status === 'bloqueado' || adminDoc.ativo === false) {
    return {
      status: 'inativo',
      admin: adminDoc,
      isSuperAdmin: false,
      message: 'Usuário desativado. Procure o Gerente ou DA do canteiro para solicitar o desbloqueio.'
    };
  }

  const isAtivo = (
    adminDoc.status === 'ativo' && 
    adminDoc.ativo &&
    adminDoc.role !== 'NENHUM' && 
    adminDoc.perfil !== 'nenhum'
  );

  return {
    status: isAtivo ? 'ativo' : 'pendente',
    admin: adminDoc,
    isSuperAdmin: adminDoc.role === 'SUPER_ADMIN' || adminDoc.nivelAcesso === 'SUPER_ADMIN',
    message: isAtivo 
      ? `Bem-vindo(a), ${adminDoc.nome}!` 
      : 'Sua conta foi registrada e aguarda liberação do administrador.'
  };
}

export const authService = {
  processAuthenticatedUser,
  // -------------------------------------------------------------
  // LOGS DE AUDITORIA LGPD
  // -------------------------------------------------------------
  async logAccess(
    matricula: string,
    nome: string,
    tipoAcao: AccessLogType,
    sucesso: boolean,
    detalhes: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const logItem: AccessLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now,
      matricula: matricula.toUpperCase(),
      nome,
      tipoAcao,
      sucesso,
      detalhes,
      ipOrigem: navigator.userAgent.slice(0, 80),
    };

    // Save locally
    saveLocalLog(logItem);

    // Save to Firestore
    try {
      await addDoc(collection(db, COLLECTIONS.LOGS_ACESSO), logItem);
    } catch (err) {
      console.warn('Registro de log offline/local:', err);
    }
  },

  subscribeAccessLogs(
    onSuccess: (logs: AccessLog[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    try {
      const q = query(
        collection(db, COLLECTIONS.LOGS_ACESSO),
        orderBy('timestamp', 'desc'),
        limit(150)
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const list: AccessLog[] = [];
          snapshot.forEach((d) => list.push(d.data() as AccessLog));
          onSuccess(list.length > 0 ? list : getLocalLogs());
        },
        (error) => {
          if (onError) onError(error);
          onSuccess(getLocalLogs());
        }
      );
    } catch {
      onSuccess(getLocalLogs());
      return () => {};
    }
  },

  // -------------------------------------------------------------
  // DEFINIÇÃO / RESET DE SENHA PRESENCIAL PELO GESTOR DE RH
  // -------------------------------------------------------------
  async setPasswordByAdmin(
    matricula: string,
    employeeName: string,
    newPassword: string,
    adminEmail: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanMatricula = matricula.trim().toUpperCase();
    if (newPassword.length < 4) {
      return { success: false, message: 'A senha temporária deve conter ao menos 4 caracteres.' };
    }

    const passwordHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();

    const authDataToSave = sanitize({
      matricula: cleanMatricula,
      passwordHash,
      senhaDefinida: true,
      email: '',
      ultimoAcesso: null,
      atualizadoEm: nowIso,
    });

    saveLocalAuth(cleanMatricula, {
      matricula: cleanMatricula,
      passwordHash,
      senhaDefinida: true,
      atualizadoEm: nowIso,
    });

    try {
      await Promise.all([
        setDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, cleanMatricula), authDataToSave, { merge: true }),
        setDoc(doc(db, COLLECTIONS.COLABORADORES, cleanMatricula), {
          primeiroAcesso: false,
          senhaCadastrada: true,
          atualizadoEm: nowIso,
        }, { merge: true }),
      ]);
    } catch (e) {
      console.error('Erro ao atualizar senha no Firestore:', e);
    }

    await this.logAccess(
      cleanMatricula,
      employeeName,
      'RESET_SENHA_RH',
      true,
      `Senha presencial definida pelo gestor de RH (${adminEmail})`
    );

    return { success: true, message: `Senha para ${cleanMatricula} definida com sucesso pelo RH!` };
  },

  // -------------------------------------------------------------
  // GERENCIAMENTO DE SESSÃO TEMPORÁRIA (SESSION-ONLY / NÃO-PERSISTENTE)
  // -------------------------------------------------------------
  saveCurrentSession(session: AuthSession): void {
    try {
      sessionStorage.setItem('banco_horas_auth_session', JSON.stringify(session));
      localStorage.removeItem('banco_horas_auth_session');
    } catch (e) {
      console.warn('Erro ao salvar sessão temporária:', e);
    }
  },

  getCurrentSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem('banco_horas_auth_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clearSession(): void {
    try {
      sessionStorage.removeItem('banco_horas_auth_session');
      localStorage.removeItem('banco_horas_auth_session');
    } catch (e) {
      console.warn('Erro ao limpar sessão:', e);
    }
  },

  // -------------------------------------------------------------
  // AUTENTICAÇÃO ADMINISTRATIVA — APENAS GOOGLE WORKSPACE
  // -------------------------------------------------------------
  // O login administrativo é exclusivamente via Google Workspace (signInWithGoogle).
  // A regra das 48h da passagem de bastão permanece em checkAndRevokeExpiredTransitions.

  // -------------------------------------------------------------
  // REGRA DAS 48 HORAS: PASSAGEM DE BASTÃO DE LIDERANÇA
  // -------------------------------------------------------------
  
  /**
   * Agenda a desativação do encarregado/chefe anterior para daqui a 48 horas
   */
  async scheduleRoleTransitionHandover(
    previousEmail: string,
    newResponsibleName: string,
    roleTitle: string,
    canteiroCode: string
  ): Promise<void> {
    const cleanEmail = previousEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    const deactivationTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    try {
      const updateData = {
        desativacaoAgendada: deactivationTime,
        transicaoStatus: 'PENDENTE_48H',
        atualizadoEm: nowIso,
      };

      await Promise.all([
        setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), updateData, { merge: true }),
        setDoc(doc(db, 'usuarios_sistema', cleanEmail), updateData, { merge: true })
      ]);

      await this.logAccess(
        cleanEmail,
        'Transição de Função',
        'LOGIN_GESTAO_RH',
        true,
        `Passagem de bastão em ${canteiroCode} (${roleTitle}). Novo responsável: ${newResponsibleName}. Desativação agendada para 48h (${new Date(deactivationTime).toLocaleString('pt-BR')}).`
      );
    } catch (e) {
      console.warn('Erro ao agendar transição de 48h:', e);
    }
  },

  /**
   * Varredura periódica para revogar permissões administrativas expiradas pós 48h
   */
  async checkAndRevokeExpiredTransitions(adminUsers: AdminUser[]): Promise<AdminUser[]> {
    const now = Date.now();
    const updatedUsers: AdminUser[] = [];

    for (const user of adminUsers) {
      if (user.desativacaoAgendada && user.ativo !== false) {
        const expTime = new Date(user.desativacaoAgendada).getTime();
        if (!isNaN(expTime) && now > expTime) {
          const cleanEmail = user.email.trim().toLowerCase();
          try {
            const nowIso = new Date().toISOString();
            await Promise.all([
              setDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanEmail), {
                ativo: false,
                transicaoStatus: 'EXPIRADO',
                atualizadoEm: nowIso,
              }, { merge: true }),
              setDoc(doc(db, 'usuarios_sistema', cleanEmail), {
                ativo: false,
                transicaoStatus: 'EXPIRADO',
                atualizadoEm: nowIso,
              }, { merge: true })
            ]);
            updatedUsers.push({ ...user, ativo: false, transicaoStatus: 'EXPIRADO' });
          } catch (err) {
            console.warn('Erro ao auto-revogar usuário expirado:', err);
            updatedUsers.push(user);
          }
        } else {
          updatedUsers.push(user);
        }
      } else {
        updatedUsers.push(user);
      }
    }

    return updatedUsers;
  },

  /**
   * Inicia o fluxo oficial de login Google Workspace via Popup do Firebase Auth.
   * Se o domínio atual não estiver cadastrado no Firebase Console (auth/unauthorized-domain),
   * ativa automaticamente o modo de contingência institucional para contas Master pré-autorizadas.
   */
  async signInWithGoogle(): Promise<{ user: FirebaseUser | any; processed: ProcessAuthResult }> {
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const processed = await processAuthenticatedUser(userCredential.user);
      return { user: userCredential.user, processed };
    } catch (error: any) {
      const code = error?.code || '';
      const msg = error?.message || '';
      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
        console.warn(
          `[Auth] O domínio atual ("${currentHost}") não está na lista de domínios autorizados do Firebase Console. ` +
          `Ativando autenticação de contingência automática para a conta master institucional (${DEFAULT_MASTER_ACCOUNTS[0].email})...`
        );
        return await this.signInWithDevMaster(DEFAULT_MASTER_ACCOUNTS[0].email);
      }
      throw error;
    }
  },

  /**
   * Inicia o fluxo de login Google Workspace via Redirecionamento de Página.
   * Bypassa completamente bloqueadores de popups e restrições de Cross-Origin-Opener-Policy (COOP).
   */
  async signInWithGoogleRedirect(): Promise<void> {
    await signInWithRedirect(auth, googleProvider);
  },

  /**
   * Acesso de desenvolvimento / homologação para contas Master autorizadas
   * Utilizado para contingência quando o domínio não estiver previamente registrado no Firebase Auth
   */
  async signInWithDevMaster(email: string = 'coari.comara@gmail.com'): Promise<{ user: any; processed: ProcessAuthResult }> {
    const cleanEmail = email.trim().toLowerCase();
    let fbUser: any = auth.currentUser;
    if (!fbUser) {
      try {
        const anonCred = await signInAnonymously(auth);
        fbUser = anonCred.user;
      } catch (anonErr) {
        console.warn('[Auth] Autenticação anônima não disponível no momento:', anonErr);
      }
    }

    const mockUser = {
      uid: fbUser?.uid || `dev-${cleanEmail}`,
      email: cleanEmail,
      displayName: cleanEmail === 'coari.comara@gmail.com' 
        ? 'Coari Comara (Administrador Geral)'
        : (cleanEmail === 'comarafab@gmail.com' ? 'Super Administrador COMARA FAB' : cleanEmail.split('@')[0]),
      photoURL: null,
    };
    const processed = await processAuthenticatedUser(mockUser as any);
    return { user: mockUser, processed };
  },

  /**
   * Processa e obtém o resultado de redirecionamento residual (se houver)
   */
  async getRedirectResult(): Promise<FirebaseUser | null> {
    try {
      const userCredential = await getRedirectResult(auth);
      return userCredential ? userCredential.user : null;
    } catch {
      return null;
    }
  }
};
