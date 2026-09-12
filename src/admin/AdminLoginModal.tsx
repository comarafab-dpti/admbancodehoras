import React, { useState } from 'react';
import { 
  AlertCircle, 
  Lock, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink, 
  ChevronDown, 
  UserCheck,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  ArrowLeft,
  Send,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { authService, DEFAULT_MASTER_ACCOUNTS } from '@/src/shared/services/authService';
import { ComaraLogo } from '@/src/shared/components/ComaraLogo';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailPasswordSignIn?: (identifier: string, password: string) => Promise<any>;
  onGoogleSignIn: () => Promise<any>;
  onDevAdminSignIn?: (email?: string, password?: string) => Promise<any>;
  isDark: boolean;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onEmailPasswordSignIn,
  onGoogleSignIn,
  onDevAdminSignIn,
  isDark,
}) => {
  // Estados do formulário de login por e-mail/senha
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Modos de visualização: 'login' | 'forgot_password' | 'first_access'
  const [viewMode, setViewMode] = useState<'login' | 'forgot_password' | 'first_access'>('login');
  
  // Recuperação de senha
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  // Primeiro acesso / Troca de senha obrigatória
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Feedback geral
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Painel de contingência / homologação
  const [showContingency, setShowContingency] = useState(false);
  const [selectedMasterEmail, setSelectedMasterEmail] = useState<string>('coari.comara@gmail.com');
  const [masterPassword, setMasterPassword] = useState<string>('');

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyHostname = () => {
    if (currentHostname && navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  // Submit principal: E-mail / Matrícula e Senha no Supabase Auth
  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage('Digite seu e-mail corporativo ou matrícula.');
      return;
    }
    if (!password) {
      setErrorMessage('Digite sua senha.');
      return;
    }

    setIsLoading(true);
    try {
      if (onEmailPasswordSignIn) {
        const res = await onEmailPasswordSignIn(cleanId, password);
        if (res?.success) {
          await authService.logAccess(
            cleanId,
            'Usuário Autenticado',
            'LOGIN_GESTAO_RH',
            true,
            `Login autenticado com sucesso via Supabase Auth (${cleanId})`
          );
          if (res?.mustChangePassword) {
            setViewMode('first_access');
            setIsLoading(false);
            return;
          }
          onClose();
        } else if (res?.error) {
          setErrorMessage(res.error);
        }
      } else {
        const { user, processed, mustChangePassword } = await authService.signInWithEmailPassword(cleanId, password);
        if (processed.status === 'ativo') {
          await authService.logAccess(
            cleanId,
            processed.admin.nome,
            'LOGIN_GESTAO_RH',
            true,
            `Login autenticado com sucesso via Supabase Auth (${cleanId})`
          );
          if (mustChangePassword) {
            setViewMode('first_access');
            setIsLoading(false);
            return;
          }
          onClose();
        } else {
          setErrorMessage(processed.message || 'Sua conta ainda não está ativa no sistema.');
        }
      }
    } catch (err: any) {
      console.warn('Aviso no login por e-mail/senha:', err);
      setErrorMessage(err?.message || 'Falha ao autenticar. Verifique seus dados.');
    } finally {
      setIsLoading(false);
    }
  };

  // Envio de link de recuperação de senha por e-mail
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = recoveryEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Informe um e-mail válido para receber as instruções de recuperação.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.resetPasswordForEmail(cleanEmail);
      if (res.success) {
        setRecoverySent(true);
        setSuccessMessage('Instruções de redefinição enviadas! Verifique sua caixa de entrada e spam.');
      } else {
        setErrorMessage(res.error || 'Não foi possível enviar o e-mail de recuperação.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao solicitar recuperação de senha.');
    } finally {
      setIsLoading(false);
    }
  };

  // Troca de senha no primeiro acesso (quando flag must_change_password estiver ativa)
  const handleFirstAccessPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('A confirmação de senha não coincide com a nova senha digitada.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.updatePassword(newPassword);
      if (res.success) {
        setSuccessMessage('Senha atualizada com sucesso! Acessando o painel...');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Não foi possível atualizar a senha.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao atualizar senha no Supabase Auth.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Popup / Redirect
  const handleGoogleSubmit = async () => {
    setErrorMessage(null);
    setIsUnauthorizedDomain(false);
    setIsLoading(true);
    try {
      const res = (await onGoogleSignIn()) as any;
      if (res?.success) {
        await authService.logAccess(
          'ADMIN_AUTH',
          'Google Workspace User',
          'LOGIN_GESTAO_RH',
          true,
          'Login administrativo RH via Google Workspace autenticado com sucesso'
        );
        onClose();
      } else if (res?.error) {
        setErrorMessage(res.error);
        if (
          res.code === 'auth/unauthorized-domain' ||
          res.error.includes('não está na lista de domínios autorizados') ||
          res.error.includes('unauthorized-domain')
        ) {
          setIsUnauthorizedDomain(true);
        }
      }
    } catch (err: any) {
      console.warn('Aviso no login Google:', err);
      const errText = err?.message || 'Falha ao autenticar com Google Workspace.';
      setErrorMessage(errText);
      if (err?.code === 'auth/unauthorized-domain' || errText.includes('unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRedirectSubmit = async () => {
    setErrorMessage(null);
    setIsUnauthorizedDomain(false);
    setIsLoading(true);
    try {
      await authService.signInWithGoogleRedirect();
    } catch (err: any) {
      console.warn('Aviso no redirecionamento Google:', err);
      const errText = err?.message || 'Falha ao redirecionar para autenticação Google.';
      setErrorMessage(errText);
      if (err?.code === 'auth/unauthorized-domain' || errText.includes('unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
      }
      setIsLoading(false);
    }
  };

  // Login de Contingência / Homologação com contas master pré-configuradas
  const handleDevMasterSubmit = async (emailToUse?: string) => {
    const targetEmail = emailToUse || selectedMasterEmail;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (onDevAdminSignIn) {
        const res = await onDevAdminSignIn(targetEmail, masterPassword);
        if (res?.success) {
          await authService.logAccess(
            targetEmail,
            'Super Administrador COMARA (Homologação)',
            'LOGIN_GESTAO_RH',
            true,
            `Acesso administrativo mestre de homologação (${targetEmail}) realizado com sucesso`
          );
          onClose();
          return;
        } else if (res?.error) {
          setErrorMessage(res.error);
        }
      } else {
        const { processed } = await authService.signInWithDevMaster(targetEmail, masterPassword);
        if (processed.status === 'ativo') {
          authService.saveCurrentSession({
            email: processed.admin.email,
            nome: processed.admin.nome,
            role: 'SUPER_ADMIN',
            cargo: processed.admin.cargo,
            loginTime: new Date().toISOString(),
          });
          await authService.logAccess(
            targetEmail,
            processed.admin.nome,
            'LOGIN_GESTAO_RH',
            true,
            `Acesso administrativo mestre direto (${targetEmail})`
          );
          onClose();
          window.location.reload();
        } else {
          setErrorMessage(processed.message || 'Falha ao acessar conta mestre.');
        }
      }
    } catch (err: any) {
      console.warn('Aviso no login de contingência:', err);
      setErrorMessage(err?.message || 'Erro ao processar login mestre.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-4 sm:p-6 transition-colors ${
        isDark ? 'bg-[#0F1B33]' : 'bg-slate-50'
      }`}
    >
      <div
        className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-5 relative ${
          isDark ? 'bg-[#16243D] border-[#335075] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Top Decorative Border */}
        <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

        {/* Header com Brasão e Identidade Oficial */}
        <div className="text-center space-y-2 pt-2">
          <div className="flex justify-center mb-1">
            <ComaraLogo size="lg" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Acesso ao Sistema COMARA
          </h2>
          <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            Banco de Horas SPTF • Autenticação Supabase Auth com RBAC
          </p>
        </div>

        {/* Diagnostic Panel para Domínio não Autorizado no Google OAuth */}
        {isUnauthorizedDomain && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-3 animate-in fade-in ${
              isDark
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-sm block">URL não cadastrada no Supabase Auth</strong>
                <p className="mt-1 leading-relaxed text-[11px] opacity-90">
                  Para utilizar o Google OAuth, cadastre a URL deste ambiente no painel do Supabase. O login direto por
                  E-mail e Senha abaixo não depende dessa configuração e funciona normalmente.
                </p>
              </div>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 font-mono text-[11px] ${
                isDark ? 'bg-[#0B1426] border-amber-900/50 text-amber-300' : 'bg-white border-amber-200 text-amber-950'
              }`}
            >
              <span className="truncate flex-1 font-semibold">{currentHostname}</span>
              <button
                type="button"
                onClick={handleCopyHostname}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
              >
                {copiedDomain ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                <span>{copiedDomain ? 'Copiado!' : 'Copiar Domínio'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Mensagens de Feedback */}
        {errorMessage && !isUnauthorizedDomain && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODO 1: LOGIN PRINCIPAL (E-mail ou Matrícula + Senha)                      */}
        {/* ========================================================================= */}
        {viewMode === 'login' && (
          <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
            {/* Campo: Identificador (E-mail corporativo ou Matrícula) */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-identifier"
                className={`block text-xs font-bold tracking-wide ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                E-mail ou Matrícula
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ex: comarafab@gmail.com ou 12345"
                  autoComplete="username"
                  disabled={isLoading}
                  required
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium border outline-hidden transition-all focus:ring-2 focus:ring-blue-500 ${
                    isDark
                      ? 'bg-[#0F1B33] border-[#243756] text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
              <p className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Admins: e-mail cadastrado • Colaboradores: digite apenas a matrícula
              </p>
            </div>

            {/* Campo: Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className={`block text-xs font-bold tracking-wide ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('forgot_password');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                  className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs sm:text-sm font-medium border outline-hidden transition-all focus:ring-2 focus:ring-blue-500 ${
                    isDark
                      ? 'bg-[#0F1B33] border-[#243756] text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão Primário: Entrar */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>

            {/* Divisor: Ou acesse com */}
            <div className="relative flex py-1.5 items-center">
              <div className={`flex-grow border-t ${isDark ? 'border-[#243756]' : 'border-slate-200'}`} />
              <span
                className={`flex-shrink mx-3 text-[10px] uppercase font-bold tracking-wider ${
                  isDark ? 'text-[#94A3B8]' : 'text-slate-400'
                }`}
              >
                ou acesse via
              </span>
              <div className={`flex-grow border-t ${isDark ? 'border-[#243756]' : 'border-slate-200'}`} />
            </div>

            {/* Botão Secundário: Google Workspace */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSubmit}
                disabled={isLoading}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer shadow-xs ${
                  isDark
                    ? 'bg-[#243756] hover:bg-[#335075] border-[#335075] text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                } disabled:opacity-50`}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google Workspace</span>
              </button>

              <button
                type="button"
                onClick={handleGoogleRedirectSubmit}
                disabled={isLoading}
                className={`w-full py-1.5 px-3 rounded-lg text-[10px] font-semibold border transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDark
                    ? 'bg-[#16243D] hover:bg-[#243756] border-[#243756] text-blue-300'
                    : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                } disabled:opacity-50`}
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span>Google via Redirecionamento</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MODO 2: RECUPERAÇÃO DE SENHA                                              */}
        {/* ========================================================================= */}
        {viewMode === 'forgot_password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="font-bold text-sm">Recuperação de Senha</h3>
            </div>

            <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
              Informe o seu e-mail corporativo para receber um link seguro de redefinição de senha pelo Supabase Auth.
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="recovery-email"
                className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
              >
                E-mail Cadastrado
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="ex: seu.nome@comara.mil.br"
                  required
                  disabled={isLoading || recoverySent}
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium border outline-hidden transition-all focus:ring-2 focus:ring-blue-500 ${
                    isDark
                      ? 'bg-[#0F1B33] border-[#243756] text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || recoverySent}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Voltar para o Login
            </button>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MODO 3: PRIMEIRO ACESSO / TROCA OBRIGATÓRIA DE SENHA                       */}
        {/* ========================================================================= */}
        {viewMode === 'first_access' && (
          <form onSubmit={handleFirstAccessPasswordSubmit} className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-sm">Primeiro Acesso Detectado</h3>
                <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  Por segurança, defina uma nova senha pessoal para a sua conta.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="first-access-new-password"
                className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
              >
                Nova Senha (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <input
                  id="first-access-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha pessoal"
                  required
                  disabled={isLoading}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium border outline-hidden transition-all focus:ring-2 focus:ring-blue-500 ${
                    isDark
                      ? 'bg-[#0F1B33] border-[#243756] text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="first-access-confirm-password"
                className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
              >
                Confirme a Nova Senha
              </label>
              <input
                id="first-access-confirm-password"
                type={showNewPassword ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium border outline-hidden transition-all focus:ring-2 focus:ring-blue-500 ${
                  isDark
                    ? 'bg-[#0F1B33] border-[#243756] text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isLoading ? 'Atualizando...' : 'Salvar Nova Senha e Entrar'}</span>
            </button>
          </form>
        )}

        {/* ========================================================================= */}
        {/* PAINEL DE CONTINGÊNCIA & HOMOLOGAÇÃO (Colapsável)                          */}
        {/* ========================================================================= */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowContingency(!showContingency)}
            className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
              isDark
                ? 'bg-[#0F1B33]/60 hover:bg-[#0F1B33] border-[#243756] text-[#94A3B8] hover:text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Contingência & Homologação Master</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${showContingency ? 'rotate-180' : ''}`}
            />
          </button>

          {showContingency && (
            <div
              className={`mt-2 p-3.5 rounded-2xl border space-y-3 animate-in fade-in ${
                isDark ? 'bg-[#0F1B33]/90 border-[#243756]' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                Acesso direto com perfil Master para testes, validação de regras de negócio e suporte operacional.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <select
                  value={selectedMasterEmail}
                  onChange={(e) => setSelectedMasterEmail(e.target.value)}
                  className={`w-full sm:flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold border outline-hidden transition-all ${
                    isDark
                      ? 'bg-[#16243D] border-[#335075] text-white focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  {DEFAULT_MASTER_ACCOUNTS.map((acc) => (
                    <option key={acc.email} value={acc.email}>
                      {acc.nome} ({acc.email})
                    </option>
                  ))}
                </select>

                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Senha Master"
                  autoComplete="current-password"
                  className={`w-full sm:w-36 py-2 px-2.5 rounded-xl text-xs font-semibold border outline-hidden transition-all ${
                    isDark
                      ? 'bg-[#16243D] border-[#335075] text-white focus:border-blue-500 placeholder:text-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 placeholder:text-slate-400'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => handleDevMasterSubmit(selectedMasterEmail)}
                  disabled={isLoading}
                  className="w-full sm:w-auto py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Entrar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Informação Institucional RBAC */}
        <div
          className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
            isDark ? 'bg-[#0F1B33]/60 border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span>
            Acesso corporativo controlado por perfis de segurança RBAC e criptografia nativa Supabase Auth.
          </span>
        </div>

        {/* Rodapé Institucional */}
        <div className="pt-2 border-t border-slate-700/40 text-center space-y-1">
          <p className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            COMARA • Comissão de Aeroportos da Região Amazônica / FAB
          </p>
        </div>
      </div>
    </div>
  );
};
