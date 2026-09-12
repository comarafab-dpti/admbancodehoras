import { doc, getDoc, setDoc, addDoc, collection, query, orderBy, limit, onSnapshot, Unsubscribe } from './db';
import { supabase } from './supabase';
import { EmployeeAuth, AccessLog, AccessLogType, AdminUser, AdminRole, AuthSession } from '../types';

export function getAuthErrorMessage(errorCodeOrMessage: string, defaultMessage?: string): string {
  const norm = (errorCodeOrMessage || '').toLowerCase();
  if (norm.includes('invalid login credentials') || norm.includes('invalid_credentials') || norm.includes('wrong_password') || norm === 'invalid_credentials') {
    return 'E-mail (ou matrícula) ou senha incorretos.';
  }
  if (norm.includes('email not confirmed') || norm.includes('email_not_confirmed')) {
    return 'E-mail cadastrado, mas ainda não confirmado no Supabase Auth. Verifique seu e-mail ou no painel do Supabase confirme o usuário.';
  }
  if (norm.includes('user not found') || norm.includes('user_not_found')) {
    return 'Usuário não localizado no sistema. Verifique a credencial digitada ou procure a gestão de RH.';
  }
  if (norm.includes('too many requests') || norm.includes('over_request_rate_limit') || norm.includes('too_many_requests')) {
    return 'Acesso temporariamente bloqueado devido a muitas tentativas inválidas. Aguarde alguns instantes.';
  }
  if (norm.includes('password should be at least')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (norm.includes('user_disabled')) {
    return 'Este usuário foi desativado no sistema.';
  }
  if (norm.includes('invalid_email') || norm.includes('invalid email')) {
    return 'Formato de e-mail ou matrícula inválido.';
  }
  if (norm.includes('network_request_failed') || norm.includes('failed to fetch')) {
    return 'Falha de conexão com os servidores de autenticação. Verifique sua conexão com a internet.';
  }
  if (norm.includes('popup_closed_by_user')) {
    return 'A janela de autenticação foi fechada antes da conclusão.';
  }
  if (norm.includes('unauthorized_domain') || norm.includes('redirect_uri')) {
    const host = typeof window !== 'undefined' ? window.location.origin : '';
    return host
      ? `A URL "${host}" não está na lista de Redirect URLs do Supabase Authentication. Adicione-a em Authentication > URL Configuration.`
      : 'URL de redirecionamento não autorizada na configuração do Supabase Auth.';
  }
  return defaultMessage || 'Falha na autenticação. Verifique suas credenciais.';
}

/**
 * Normaliza o identificador de login:
 * Se contiver '@', assume e-mail corporativo.
 * Se for uma matrícula (apenas números ou alfanumérico sem '@'), converte para e-mail sintético '{matricula}@comara.local'.
 */
export function normalizeLoginIdentifier(identifier: string): string {
  const clean = (identifier || '').trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) {
    return clean;
  }
  return `${clean}@comara.local`;
}


const COLLECTIONS = {
  COLABORADORES_AUTH: 'colaboradores_auth',
  LOGS_ACESSO: 'logs_acesso',
  COLABORADORES: 'colaboradores',
  ADMIN_USERS: 'admin_users',
  USUARIOS_SISTEMA: 'usuarios_sistema',
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
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
  },
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

/**
 * Processa o usuário autenticado (sessão Supabase Auth) contra a matriz RBAC
 * em admin_users — mesma lógica do legado, agora lendo do PostgreSQL.
 */
export async function processAuthenticatedUser(authUser: {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  uid?: string | null;
}): Promise<ProcessAuthResult> {
  const email = (authUser.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('E-mail do usuário não identificado na sessão.');
  }

  const nowIso = new Date().toISOString();
  let adminDoc: AdminUser | null = null;
  const docRef = doc(null as any, COLLECTIONS.ADMIN_USERS, email);

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      adminDoc = snap.data() as AdminUser;
    }
  } catch (err) {
    console.warn('[Auth] Erro ao consultar documento em admin_users:', err);
  }

  // Verificação especial para colaborador com e-mail sintético ({matricula}@comara.local)
  const isSyntheticCollab = email.endsWith('@comara.local');
  const syntheticMatricula = isSyntheticCollab ? email.replace('@comara.local', '').toUpperCase() : null;

  if (syntheticMatricula) {
    try {
      const colabSnap = await getDoc(doc(null as any, COLLECTIONS.COLABORADORES, syntheticMatricula));
      if (colabSnap.exists()) {
        const colabData = colabSnap.data() as any;
        const colabAdminDoc: AdminUser = {
          id: email,
          email,
          nome: colabData.nome || authUser.displayName || `Colaborador ${syntheticMatricula}`,
          cargo: colabData.cargo || 'Colaborador',
          funcao: colabData.cargo || 'Colaborador',
          role: 'AUDITOR' as AdminRole,
          nivelAcesso: 'AUDITOR' as AdminRole,
          status: 'ativo',
          perfil: 'auditor',
          foto: null,
          sede: colabData.sedeCodigo || 'TODAS',
          canteiroSede: colabData.sedeCodigo || 'TODAS',
          ativo: true,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        };
        return {
          status: 'ativo',
          admin: colabAdminDoc,
          isSuperAdmin: false,
          message: `Bem-vindo(a), ${colabAdminDoc.nome}!`,
        };
      }
    } catch (colabErr) {
      console.warn('[Auth] Erro ao consultar dados de colaborador por matrícula:', colabErr);
    }
  }

  // Se não existir em admin_users, auto-cadastra. E-mail master cria o primeiro cadastro ativo
  // como SUPER_ADMIN (bootstrap). Após criado, o perfil será lido EXCLUSIVAMENTE
  // do documento no banco.
  if (!adminDoc) {
    const isMasterBootstrap = isMasterAdminEmail(email);
    const newDoc: AdminUser = {
      id: email,
      email,
      nome: authUser.displayName || (isMasterBootstrap ? 'Super Administrador COMARA' : (email.split('@')[0] || 'Sem nome')),
      cargo: isMasterBootstrap ? 'Super Administrador TI / RH' : 'Aguardando aprovação',
      funcao: isMasterBootstrap ? 'Super Administrador TI / RH' : '',
      role: (isMasterBootstrap ? 'SUPER_ADMIN' : 'NENHUM') as AdminRole,
      nivelAcesso: (isMasterBootstrap ? 'SUPER_ADMIN' : 'NENHUM') as AdminRole,
      status: isMasterBootstrap ? 'ativo' : 'pendente',
      perfil: isMasterBootstrap ? 'super_admin' : 'nenhum',
      foto: authUser.photoURL || null,
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
      console.warn('[Auth] Erro ao salvar auto-cadastro inicial no banco:', saveErr);
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
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

    // Save to Supabase
    try {
      await addDoc(collection(null as any, COLLECTIONS.LOGS_ACESSO), sanitize(logItem));
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
        collection(null as any, COLLECTIONS.LOGS_ACESSO),
        orderBy('timestamp', 'desc'),
        limit(150)
      );
      return onSnapshot(
        q,
        (snapshot: any) => {
          const list: AccessLog[] = [];
          snapshot.forEach((d: any) => list.push(d.data() as AccessLog));
          onSuccess(list.length > 0 ? list : getLocalLogs());
        },
        (error: Error) => {
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
    } as EmployeeAuth);

    try {
      await Promise.all([
        setDoc(doc(null as any, COLLECTIONS.COLABORADORES_AUTH, cleanMatricula), authDataToSave, { merge: true }),
        setDoc(doc(null as any, COLLECTIONS.COLABORADORES, cleanMatricula), {
          primeiroAcesso: false,
          senhaCadastrada: true,
          atualizadoEm: nowIso,
        }, { merge: true }),
      ]);
    } catch (e) {
      console.error('Erro ao atualizar senha no banco:', e);
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
  // GERENCIAMENTO DE SESSÃO TEMPORÁRIA
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
  // REGRA DAS 48 HORAS: PASSAGEM DE BASTÃO DE LIDERANÇA
  // -------------------------------------------------------------

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
        setDoc(doc(null as any, COLLECTIONS.ADMIN_USERS, cleanEmail), updateData, { merge: true }),
        setDoc(doc(null as any, COLLECTIONS.USUARIOS_SISTEMA, cleanEmail), updateData, { merge: true }),
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
              setDoc(doc(null as any, COLLECTIONS.ADMIN_USERS, cleanEmail), {
                ativo: false,
                transicaoStatus: 'EXPIRADO',
                atualizadoEm: nowIso,
              }, { merge: true }),
              setDoc(doc(null as any, COLLECTIONS.USUARIOS_SISTEMA, cleanEmail), {
                ativo: false,
                transicaoStatus: 'EXPIRADO',
                atualizadoEm: nowIso,
              }, { merge: true }),
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

  // -------------------------------------------------------------
  // AUTENTICAÇÃO ADMINISTRATIVA E COLABORADORES — SUPABASE AUTH
  // -------------------------------------------------------------

  /**
   * Login principal por E-mail ou Matrícula e Senha no Supabase Auth.
   * - Suporta e-mails corporativos (@comara.mil.br, @gmail.com, etc.)
   * - Suporta matrículas de colaboradores (sintético: {matricula}@comara.local)
   * - Detecta flag 'must_change_password' para forçar troca no primeiro acesso
   */
  async signInWithEmailPassword(
    identifier: string,
    password: string
  ): Promise<{
    user: any;
    processed: ProcessAuthResult;
    mustChangePassword: boolean;
  }> {
    const rawId = (identifier || '').trim();
    if (!rawId) {
      throw new Error('Informe seu e-mail corporativo ou matrícula.');
    }
    if (!password) {
      throw new Error('Informe a sua senha.');
    }

    const email = normalizeLoginIdentifier(rawId);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      const msg = getAuthErrorMessage(error?.code || error?.message || '', error?.message);
      throw new Error(msg);
    }

    const authUser = data.user;
    const isSyntheticCollab = email.endsWith('@comara.local');
    const matriculaFromEmail = isSyntheticCollab ? email.replace('@comara.local', '') : undefined;

    const sessionUser = {
      uid: authUser.id,
      email: authUser.email || email,
      displayName:
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.nome ||
        (matriculaFromEmail ? `Colaborador ${matriculaFromEmail}` : email.split('@')[0]),
      photoURL: authUser.user_metadata?.avatar_url || null,
    };

    const processed = await processAuthenticatedUser(sessionUser);
    const mustChangePassword = Boolean(authUser.user_metadata?.must_change_password);

    return {
      user: sessionUser,
      processed,
      mustChangePassword,
    };
  },

  /**
   * Atualização de senha no Supabase Auth (primeiro acesso ou troca voluntária).
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: {
        must_change_password: false,
      },
    });

    if (error) {
      return {
        success: false,
        error: getAuthErrorMessage(error.code || error.message, error.message),
      };
    }

    return { success: true };
  },

  /**
   * Envia e-mail de recuperação / redefinição de senha pelo Supabase Auth.
   */
  async resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Informe um endereço de e-mail válido para envio das instruções.' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/admin`,
    });

    if (error) {
      return {
        success: false,
        error: getAuthErrorMessage(error.code || error.message, error.message),
      };
    }

    return { success: true };
  },

  /**
   * Criação de usuário com e-mail e senha no Supabase Auth.
   * Usado na homologação ou pelo RH ao cadastrar gestor ou colaborador.
   */
  async signUpUser(options: {
    email: string;
    password?: string;
    nome: string;
    role?: AdminRole;
    canteiroSede?: string;
    mustChangePassword?: boolean;
  }): Promise<{ user: any | null; error?: string }> {
    const cleanEmail = normalizeLoginIdentifier(options.email);
    const defaultPassword = options.password || 'Comara@123';

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: defaultPassword,
      options: {
        data: {
          full_name: options.nome,
          nome: options.nome,
          nivel_acesso: options.role || 'NENHUM',
          role: options.role || 'NENHUM',
          canteiro_sede: options.canteiroSede || 'TODAS',
          must_change_password: options.mustChangePassword ?? true,
        },
      },
    });

    if (error) {
      return {
        user: null,
        error: getAuthErrorMessage(error.code || error.message, error.message),
      };
    }

    return { user: data.user };
  },

  /**
   * Login Google Workspace via Supabase Auth (OAuth por redirecionamento).
   * A página navega para o Google; ao retornar, a sessão é detectada
   * automaticamente (detectSessionInUrl) e processada pelo listener
   * onAuthStateChanged da aplicação.
   */
  async signInWithGoogle(): Promise<{ user: any | null; processed: ProcessAuthResult | null; redirected?: boolean }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/userinfo.email',
        redirectTo: `${window.location.origin}/admin`,
      },
    });
    if (error) {
      throw error;
    }
    return { user: null, processed: null, redirected: true };
  },

  /**
   * Login Google via redirecionamento explícito (mesma rota do Supabase Auth).
   */
  async signInWithGoogleRedirect(): Promise<void> {
    await this.signInWithGoogle();
  },

  /**
   * Acesso de contingência/homologação para contas Master.
   * Agora requer um usuário real (e-mail/senha) no Supabase Auth para que
   * as políticas RLS se apliquem corretamente à sessão.
   * Crie o usuário em Authentication > Users (e-mail/senha, auto-confirmado).
   */
  async signInWithDevMaster(email: string = 'coari.comara@gmail.com', password?: string): Promise<{ user: any; processed: ProcessAuthResult }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!password) {
      throw new Error('Informe a senha da conta mestre (usuário e-mail/senha do Supabase Auth).');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data?.user) {
      const msg = error?.code
        ? getAuthErrorMessage(error.code, error.message)
        : 'Falha no acesso de contingência. Verifique se o usuário existe em Authentication > Users.';
      throw new Error(msg);
    }

    const sessionUser = {
      uid: data.user.id,
      email: data.user.email ?? cleanEmail,
      displayName:
        cleanEmail === 'coari.comara@gmail.com'
          ? 'Coari Comara (Administrador Geral)'
          : cleanEmail === 'comarafab@gmail.com'
            ? 'Super Administrador COMARA FAB'
            : data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
      photoURL: data.user.user_metadata?.avatar_url ?? null,
    };
    const processed = await processAuthenticatedUser(sessionUser);
    return { user: sessionUser, processed };
  },

  /**
   * Legado: o retorno do OAuth é processado automaticamente pelo listener
   * de sessão do Supabase Auth.
   */
  async getRedirectResult(): Promise<null> {
    return null;
  },
};
