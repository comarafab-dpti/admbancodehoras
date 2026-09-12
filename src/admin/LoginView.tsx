import React, { useState } from 'react';
import { authService, DEFAULT_MASTER_ACCOUNTS } from '@/src/shared/services/authService';
import { AuthSession } from '@/src/shared/types';
import { ComaraLogo } from '@/src/shared/components/ComaraLogo';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  Copy, 
  Check,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Send,
  ArrowLeft,
  ChevronDown,
  UserCheck
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess?: (session: AuthSession) => void;
  theme?: 'dark' | 'light';
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Formulário E-mail / Senha
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Modos de tela: 'login' | 'forgot_password'
  const [viewMode, setViewMode] = useState<'login' | 'forgot_password'>('login');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  // Painel de Contingência Master
  const [showContingency, setShowContingency] = useState(false);
  const [selectedMasterEmail, setSelectedMasterEmail] = useState('coari.comara@gmail.com');
  const [masterPassword, setMasterPassword] = useState('');

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyHostname = () => {
    if (currentHostname && navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleApplyLoginSuccess = (user: any, processed: any) => {
    if (processed.status === 'inativo' || processed.status === 'bloqueado') {
      setErrorMessage('Usuário desativado. Procure o Gerente ou DA do canteiro para solicitar o desbloqueio.');
      return;
    }

    if (processed.status === 'pendente') {
      setErrorMessage('Sua conta foi registrada no sistema e aguarda liberação de perfil pelo administrador.');
      return;
    }

    const session: AuthSession = {
      email: processed.admin.email,
      nome: processed.admin.nome || user.displayName || 'Gestor RH',
      saram: processed.admin.saram,
      nomeGuerra: processed.admin.nomeGuerra,
      postoGraduacao: processed.admin.postoGraduacao,
      funcao: processed.admin.funcao || processed.admin.cargo,
      canteiroSede: processed.admin.canteiroSede || processed.admin.sede || 'TODAS',
      role: (processed.admin.nivelAcesso || processed.admin.role || 'GESTOR_RH') as any,
      cargo: processed.admin.cargo || 'Gestor RH',
      sede: processed.admin.sede || processed.admin.canteiroCodigo || 'KO',
      canteiroCodigo: processed.admin.canteiroCodigo || processed.admin.sede || 'KO',
      canteiroId: processed.admin.canteiroCodigo || processed.admin.sede || 'KO',
      tratamentoTitulo: processed.admin.tratamentoTitulo,
      loginTime: new Date().toISOString(),
    };
    authService.saveCurrentSession(session);
    setSuccessMessage(`Bem-vindo(a), ${session.nome}!`);
    if (onLoginSuccess) {
      onLoginSuccess(session);
    } else {
      window.location.reload();
    }
  };

  // Submit principal: E-mail ou Matrícula + Senha (Supabase Auth)
  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { user, processed } = await authService.signInWithEmailPassword(identifier, password);
      handleApplyLoginSuccess(user, processed);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  // Recuperação de senha por e-mail
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await authService.resetPasswordForEmail(recoveryEmail);
      if (res.success) {
        setRecoverySent(true);
        setSuccessMessage('Link de redefinição enviado com sucesso para o e-mail informado.');
      } else {
        setErrorMessage(res.error || 'Erro ao enviar e-mail de recuperação.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao processar solicitação.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login com Google Workspace
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorizedDomain(false);
    setSuccessMessage(null);
    try {
      const { user, processed } = await authService.signInWithGoogle();
      if (user && processed) {
        handleApplyLoginSuccess(user, processed);
      }
    } catch (error: any) {
      console.warn('Aviso no Google Sign-In:', error);
      const code = error?.code || '';
      if (code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
      }
      setErrorMessage(error?.message || 'Falha na autenticação Google.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login Contingência Master
  const handleDevMasterLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { user, processed } = await authService.signInWithDevMaster(selectedMasterEmail, masterPassword);
      handleApplyLoginSuccess(user, processed);
    } catch (err: any) {
      console.warn('Aviso no login mestre:', err);
      setErrorMessage(err?.message || 'Falha ao processar login mestre.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors ${
        isDark ? 'bg-[#0F1B33] text-[#E2E8F0]' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Brand Bar */}
      <header
        className={`p-4 sm:px-8 border-b flex items-center justify-between ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          <ComaraLogo size="md" />
          <div>
            <div className="flex items-center space-x-2">
              <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                BANCO DE HORAS SPTF / COMARA
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                SUPABASE AUTH
              </span>
            </div>
            <p className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Sedes Operacionais: KO (Coari) • BE (Belém) • MN (Manaus)
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Segurança Criptográfica RBAC</span>
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-md space-y-6">
          <div
            className={`p-6 sm:p-8 rounded-3xl border shadow-2xl relative overflow-hidden ${
              isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-slate-200/50'
            }`}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

            <div className="text-center space-y-2 mb-6">
              <div className="flex justify-center mb-2">
                <ComaraLogo size="xl" />
              </div>
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Acesso ao Painel de Gestão & RH
              </h1>
              <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                COMARA • Comissão de Aeroportos da Região Amazônica
              </p>
            </div>

            {/* Alertas */}
            {isUnauthorizedDomain && (
              <div
                className={`mb-5 p-4 rounded-xl border text-xs space-y-3 animate-in fade-in ${
                  isDark ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-sm block">URL não cadastrada no Supabase Auth</strong>
                    <p className="mt-1 leading-relaxed text-[11px] opacity-90">
                      O login direto por E-mail e Senha abaixo não depende dessa configuração e funciona normalmente.
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
                    <span>{copiedDomain ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            )}

            {errorMessage && !isUnauthorizedDomain && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* MODO LOGIN */}
            {viewMode === 'login' ? (
              <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="view-login-identifier"
                    className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                  >
                    E-mail ou Matrícula
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="view-login-identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="ex: comarafab@gmail.com ou 12345"
                      required
                      disabled={isLoading}
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium border outline-hidden transition-all focus:ring-2 focus:ring-blue-500 ${
                        isDark
                          ? 'bg-[#0F1B33] border-[#243756] text-white placeholder:text-slate-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="view-login-password"
                      className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setViewMode('forgot_password')}
                      className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="view-login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha de acesso"
                      required
                      disabled={isLoading}
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
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isLoading ? 'Autenticando...' : 'Entrar no Sistema'}</span>
                </button>

                <div className="relative flex py-1.5 items-center">
                  <div className={`flex-grow border-t ${isDark ? 'border-[#243756]' : 'border-slate-200'}`} />
                  <span className={`flex-shrink mx-3 text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`}>
                    ou acesse via
                  </span>
                  <div className={`flex-grow border-t ${isDark ? 'border-[#243756]' : 'border-slate-200'}`} />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-xs active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                    isDark 
                      ? 'bg-[#243756] hover:bg-[#335075] text-white border-[#335075]' 
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google Workspace</span>
                </button>
              </form>
            ) : (
              /* MODO RECUPERAÇÃO DE SENHA */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('login')}
                    className="p-1 rounded hover:bg-slate-700/30 text-slate-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h3 className="font-bold text-sm">Recuperar Senha</h3>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="view-recovery-email"
                    className={`block text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                  >
                    E-mail Cadastrado
                  </label>
                  <input
                    id="view-recovery-email"
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="seu.email@comara.mil.br"
                    required
                    disabled={isLoading || recoverySent}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium border outline-hidden transition-all focus:ring-2 focus:ring-blue-500 ${
                      isDark
                        ? 'bg-[#0F1B33] border-[#243756] text-white placeholder:text-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || recoverySent}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Enviando...' : 'Enviar Link'}</span>
                </button>
              </form>
            )}

            {/* Painel de Contingência Master */}
            <div className="pt-3 border-t border-slate-700/30 mt-4">
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
                  <span>Contingência Master</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showContingency ? 'rotate-180' : ''}`} />
              </button>

              {showContingency && (
                <div className="mt-2 space-y-2 p-3 rounded-xl border bg-[#0F1B33]/90 border-[#243756]">
                  <select
                    value={selectedMasterEmail}
                    onChange={(e) => setSelectedMasterEmail(e.target.value)}
                    className="w-full py-2 px-2.5 rounded-lg text-xs font-semibold border border-[#335075] bg-[#16243D] text-white"
                  >
                    {DEFAULT_MASTER_ACCOUNTS.map((acc) => (
                      <option key={acc.email} value={acc.email}>
                        {acc.nome} ({acc.email})
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      placeholder="Senha Master"
                      className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold border border-[#335075] bg-[#16243D] text-white"
                    />
                    <button
                      type="button"
                      onClick={handleDevMasterLogin}
                      disabled={isLoading}
                      className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Entrar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-[10px] text-[#94A3B8] flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Autenticação Supabase Auth • Criptografia e RBAC</span>
          </div>
        </div>
      </main>

      <footer
        className={`p-4 border-t text-center text-[10px] ${
          isDark ? 'bg-[#16243D] border-[#243756] text-[#94A3B8]' : 'bg-white border-slate-200 text-slate-500'
        }`}
      >
        Sistema de Banco de Horas SPTF • COMARA • Sedes KO / BE / MN
      </footer>
    </div>
  );
};
