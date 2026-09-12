import React, { useState, useRef, useEffect } from 'react';
import { SystemConfig, AdminRole } from '@/src/shared/types';
import { ComaraLogo } from '@/src/shared/components/ComaraLogo';
import { SettingsMenu } from './SettingsMenu';
import { PWAInstallButton } from '@/src/shared/components/PWAInstallButton';
import { ModuleBadge } from '@/src/shared/components/ModuleBadge';
import { rbacService, ROLE_INFO } from '@/src/shared/services/rbacService';
import { 
  BarChart3, 
  Plus, 
  Users, 
  BookOpen, 
  RotateCcw, 
  Zap, 
  ShieldCheck, 
  UserCheck, 
  Sun, 
  Moon, 
  LayoutPanelTop, 
  Lock, 
  ChevronDown, 
  Settings, 
  Shield, 
  User, 
  ExternalLink, 
  Sparkles, 
  Check, 
  Trash2, 
  UploadCloud, 
  FileSpreadsheet, 
  LogOut, 
  Cloud,
  HardHat,
  Building2,
  Building,
  Image as ImageIcon,
  Clock,
  CalendarCheck2,
  Receipt,
  FileText,
  FileCheck,
  DatabaseBackup
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'colaboradores' | 'dispensas_faltas' | 'canteiros' | 'insalubridade' | 'contracheques' | 'relatorios' | 'extrato' | 'permissoes_admin' | 'auditoria' | 'arquitetura' | 'configuracoes_instituicao' | 'backup_restauracao';
export type UserMode = 'ADMIN' | 'COLABORADOR';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewEntry: () => void;
  onOpenQuickBatchModal: () => void;
  onOpenSptfDispensa?: () => void;
  onResetData: () => void;
  onClearData: () => void;
  onOpenImportRecordsModal: () => void;
  onOpenLogoModal?: () => void;
  systemConfig?: SystemConfig;
  totalEmployees: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleLayout?: () => void;
  userMode: UserMode;
  onToggleUserMode: (mode: UserMode) => void;
  onSelectRole?: (role: AdminRole) => void;
  currentUserEmail: string;
  userRole?: AdminRole | string;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewEntry,
  onOpenQuickBatchModal,
  onOpenSptfDispensa,
  onResetData,
  onClearData,
  onOpenImportRecordsModal,
  onOpenLogoModal,
  systemConfig,
  totalEmployees,
  theme,
  onToggleTheme,
  onToggleLayout,
  userMode,
  onToggleUserMode,
  onSelectRole,
  currentUserEmail,
  userRole = 'SUPER_ADMIN',
  onSignOut,
}) => {
  const isDark = theme === 'dark';
  const isAdmin = userMode === 'ADMIN';
  const currentRole = (userRole || 'SUPER_ADMIN') as AdminRole;
  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.AUX_DA;
  const isAuxDA = currentRole === 'AUX_DA' || (currentRole as string) === 'AUXILIAR_DA';

  const canManageAdmins = rbacService.canManageAdmins(currentRole);
  const canManageSystem = rbacService.canManageSystemConfig(currentRole);
  const canManageBackups = currentRole === 'SUPER_ADMIN';
  const canImportFolha = rbacService.canImportFolha(currentRole);
  const canManageCanteiros = rbacService.canManageCanteiros(currentRole);
  const canViewAuditLogs = rbacService.canViewAuditLogs(currentRole);
  const canLaunchHours = rbacService.canLaunchHours(currentRole);
  const canLaunchInsalubrity = rbacService.canLaunchInsalubrity(currentRole);
  const canIssueDispensa = rbacService.canIssueDispensa(currentRole);

  // Dropdown states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={`${
      isDark ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' : 'bg-[#0B1426] border-[#1D2C47] text-[#E2E8F0]'
    } border-b sticky top-0 z-40 shadow-md transition-colors`}>
      {/* 0. TOPO INSTITUCIONAL: BARRA DO MÓDULO ADMINISTRATIVO */}
      <div className="bg-[#070D19] border-b border-[#1A263D] px-2 sm:px-4 lg:px-6 xl:px-8 py-1 text-[11px] flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <ModuleBadge tipo="admin" size="sm" />
          <span className="text-[10px] sm:text-[11px] font-bold text-amber-400 tracking-wider uppercase hidden xs:inline">
            Gestão & Administração SPTF
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] sm:text-[11px] font-mono text-slate-400">
          <span className="hidden sm:inline text-slate-400">
            Painel Operacional RH & Fiscalização
          </span>
        </div>
      </div>

      <div className="max-w-[1880px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between h-16 gap-1.5 sm:gap-3">
          
          {/* ========================================================= */}
          {/* 1. ESQUERDA: LOGOTIPO & MARCA COM CANTEIRO */}
          {/* ========================================================= */}
          <div 
            className="flex items-center space-x-2 sm:space-x-3 cursor-pointer shrink-0 group select-none" 
            onClick={() => onSelectTab('dashboard')}
            title="Ir para o Dashboard Principal"
          >
            <ComaraLogo logoUrl={systemConfig?.logoUrl} size="sm" />
            <div>
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className={`font-bold text-xs sm:text-sm xl:text-base tracking-tight text-white`}>
                  COMARA <span className="text-[#3B82F6]">SPTF</span>
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1 sm:px-1.5 py-0.2 rounded border bg-[#243756] text-blue-400 border-[#335075]">
                  RH Cloud
                </span>
                <ModuleBadge tipo="admin" size="sm" className="hidden xl:inline-flex" />
              </div>
              <p className="text-[10px] sm:text-[11px] font-mono font-medium hidden sm:block text-[#94A3B8]">
                Sedes: <span className="text-[#3B82F6] font-bold">KO</span> • BE • MN
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. CENTRO: ABAS PRINCIPAIS EM GRUPO LIMPO E ADAPTÁVEL     */}
          {/* ========================================================= */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 bg-transparent p-0.5 rounded-xl min-w-0 justify-center flex-1 overflow-x-auto no-scrollbar">
            {/* Aba 1: Dashboard */}
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-2 lg:px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'dashboard' || activeTab === 'extrato'
                  ? isDark 
                    ? 'bg-[#243756] text-white border border-[#335075] shadow-xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Dashboard Executivo de Gestão"
            >
              <BarChart3 className="w-4 h-4 text-[#3B82F6] shrink-0" />
              <span className="hidden xl:inline">Dashboard</span>
              <span className="xl:hidden">Dash</span>
            </button>

            {/* Aba 2: Colaboradores */}
            <button
              onClick={() => onSelectTab('colaboradores')}
              className={`px-2 lg:px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'colaboradores'
                  ? isDark 
                    ? 'bg-[#243756] text-white border border-[#335075] shadow-xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Gestão de Colaboradores e Efetivo"
            >
              <Users className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="hidden xl:inline">Colaboradores</span>
              <span className="xl:hidden">Pessoas</span>
              <span className={`text-[10px] xl:text-xs px-1.5 xl:px-2 py-0.2 xl:py-0.5 rounded-full font-mono font-bold ${
                isDark ? 'bg-[#0F1B33] text-[#94A3B8]' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalEmployees}
              </span>
            </button>

            {/* Aba 3: Insalubridade (Matriz Simples & Completa) */}
            <button
              onClick={() => onSelectTab('insalubridade')}
              className={`px-2 lg:px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'insalubridade'
                  ? isDark 
                    ? 'bg-[#243756] text-amber-400 border border-[#335075] shadow-xs' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Gestão e Apontamentos de Insalubridade em Campo"
            >
              <HardHat className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden 2xl:inline">Insalubridade</span>
              <span className="2xl:hidden">Insalubr.</span>
            </button>

            {/* Aba 4: Contracheques Digitais (Importação e Gestão) */}
            <button
              onClick={() => onSelectTab('contracheques')}
              className={`px-2 lg:px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'contracheques'
                  ? isDark 
                    ? 'bg-[#243756] text-emerald-400 border border-[#335075] shadow-xs' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Contracheques e Fichas Financeiras Digitais"
            >
              <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="hidden 2xl:inline">Contracheques</span>
              <span className="2xl:hidden">Folha</span>
            </button>

            {/* Aba 5: Dispensas & Faltas */}
            <button
              onClick={() => onSelectTab('dispensas_faltas')}
              className={`px-2 lg:px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'dispensas_faltas'
                  ? isDark 
                    ? 'bg-[#243756] text-blue-400 border border-[#335075] shadow-xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Dispensas de SPTF e Faltas"
            >
              <FileCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="hidden 2xl:inline">Dispensas & Faltas</span>
              <span className="2xl:hidden">Dispensas</span>
            </button>

            {/* Aba 6: Relatórios - Oculto para Aux de DA */}
            {!isAuxDA && (
              <button
                onClick={() => onSelectTab('relatorios')}
                className={`px-2 lg:px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'relatorios'
                    ? isDark 
                      ? 'bg-[#243756] text-purple-400 border border-[#335075] shadow-xs' 
                      : 'bg-purple-50 text-purple-700 border border-purple-200 font-bold shadow-xs'
                    : isDark 
                      ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Gerador de Relatórios Executivos Consolidados"
              >
                <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="hidden xl:inline">Relatórios</span>
                <span className="xl:hidden">Relat.</span>
              </button>
            )}

            {/* Aba 7: Manual */}
            {!isAuxDA && <button
              onClick={() => onSelectTab('arquitetura')}
              className={`px-2 lg:px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'arquitetura'
                  ? isDark 
                    ? 'bg-[#243756] text-cyan-400 border border-[#335075] shadow-xs' 
                    : 'bg-blue-50 text-cyan-700 border border-cyan-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Manual Operacional e Normativas"
            >
              <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Manual</span>
            </button>}
          </nav>

          {/* ========================================================= */}
          {/* 3. DIREITA: AÇÕES RÁPIDAS, ENGRENAGEM, PERFIL & LOGOFF */}
          {/* ========================================================= */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 ml-auto">
            
            {/* BOTÃO INSTALAR APLICATIVO (PWA) */}
            <PWAInstallButton variant="navbar" theme={theme} />

            {/* ALTERNADOR DE TEMA (SOL / LUA) */}
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-xl transition-colors active:scale-[0.98] border cursor-pointer ${
                isDark 
                  ? 'bg-[#16243D] hover:bg-[#243756] text-amber-400 hover:text-amber-300 border-[#243756]' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200'
              }`}
              title={isDark ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* ALTERNADOR DE LAYOUT (SIDEBAR "CLEAN" VS CLÁSSICA) */}
            {onToggleLayout && (
              <button
                onClick={onToggleLayout}
                className={`p-2 rounded-xl transition-colors active:scale-[0.98] border cursor-pointer ${
                  isDark 
                    ? 'bg-[#16243D] hover:bg-[#243756] text-blue-400 hover:text-blue-300 border-[#243756]' 
                    : 'bg-slate-100 hover:bg-slate-200 text-blue-600 hover:text-blue-700 border-slate-200'
                }`}
                title="Alternar para o layout com Sidebar (Clean)"
                aria-label="Alternar layout"
              >
                <LayoutPanelTop className="w-4 h-4" />
              </button>
            )}

            {/* DROPDOWN DE CONFIGURAÇÕES & LANÇAMENTOS (ÍCONE DE ENGRENAGEM ⚙️) */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen);
                }}
                className={`p-2 rounded-xl transition-colors active:scale-[0.98] border cursor-pointer ${
                  isSettingsOpen
                    ? isDark 
                      ? 'bg-[#243756] text-white border-blue-500/50 shadow-xs' 
                      : 'bg-slate-200 text-slate-900 border-blue-300 shadow-xs'
                    : isDark 
                      ? 'bg-[#16243D] hover:bg-[#243756] text-[#94A3B8] hover:text-white border-[#243756]' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                }`}
                title="Lançamentos, Configurações e Menu do Sistema"
                aria-label="Configurações e Lançamentos"
              >
                <Settings className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-45 text-[#3B82F6]' : ''}`} />
              </button>

              {/* Menu Suspenso de Configurações & Ações */}
              {isSettingsOpen && (
                <SettingsMenu
                  theme={theme}
                  activeTab={activeTab}
                  onSelectTab={onSelectTab}
                  onOpenQuickBatchModal={onOpenQuickBatchModal}
                  onOpenNewEntry={onOpenNewEntry}
                  onOpenSptfDispensa={onOpenSptfDispensa}
                  onOpenImportRecordsModal={onOpenImportRecordsModal}
                  onOpenLogoModal={onOpenLogoModal}
                  onResetData={onResetData}
                  onClearData={onClearData}
                  userMode={userMode}
                  onToggleUserMode={onToggleUserMode}
                  onSelectRole={onSelectRole}
                  currentUserEmail={currentUserEmail}
                  userRole={userRole}
                  onClose={() => setIsSettingsOpen(false)}
                />
              )}
            </div>

            {/* BOTÃO DEDICADO DE LOGOFF (APENAS ÍCONE DE SAÍDA) */}
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className={`p-2 rounded-xl border transition-all active:scale-[0.98] cursor-pointer ${
                  isDark 
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/40 shadow-xs' 
                    : 'bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border-red-200 shadow-xs'
                }`}
                title="Encerrar Sessão (Sair)"
                aria-label="Encerrar Sessão (Sair)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Navegação Mobile & Tablet Compacta (Visível abaixo de lg / 1024px) */}
      <div className={`lg:hidden flex items-center justify-start sm:justify-center border-t ${
        isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50'
      } px-2 py-1.5 text-xs overflow-x-auto no-scrollbar gap-1`}>
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium shrink-0 transition-colors ${
            activeTab === 'dashboard' || activeTab === 'extrato'
              ? isDark ? 'text-blue-400 font-bold bg-[#243756]' : 'text-blue-700 font-bold bg-blue-100'
              : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onSelectTab('colaboradores')}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium shrink-0 transition-colors flex items-center gap-1 ${
            activeTab === 'colaboradores'
              ? isDark ? 'text-blue-400 font-bold bg-[#243756]' : 'text-blue-700 font-bold bg-blue-100'
              : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Pessoas</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
            isDark ? 'bg-[#0B1426] text-[#94A3B8]' : 'bg-slate-200 text-slate-700'
          }`}>
            {totalEmployees}
          </span>
        </button>
        <button
          onClick={() => onSelectTab('insalubridade')}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium shrink-0 transition-colors ${
            activeTab === 'insalubridade'
              ? isDark ? 'text-amber-400 font-bold bg-[#243756]' : 'text-amber-700 font-bold bg-amber-100'
              : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Insalubridade
        </button>
        <button
          onClick={() => onSelectTab('contracheques')}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium shrink-0 transition-colors ${
            activeTab === 'contracheques'
              ? isDark ? 'text-emerald-400 font-bold bg-[#243756]' : 'text-emerald-700 font-bold bg-emerald-100'
              : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Contracheques
        </button>
        <button
          onClick={() => onSelectTab('dispensas_faltas')}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium shrink-0 transition-colors ${
            activeTab === 'dispensas_faltas'
              ? isDark ? 'text-blue-400 font-bold bg-[#243756]' : 'text-blue-700 font-bold bg-blue-100'
              : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Dispensas
        </button>
        {!isAuxDA && (
          <button
            onClick={() => onSelectTab('relatorios')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium shrink-0 transition-colors ${
              activeTab === 'relatorios'
                ? isDark ? 'text-purple-400 font-bold bg-[#243756]' : 'text-purple-700 font-bold bg-purple-100'
                : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Relatórios
          </button>
        )}
        {!isAuxDA && <button
          onClick={() => onSelectTab('arquitetura')}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium shrink-0 transition-colors ${
            activeTab === 'arquitetura'
              ? isDark ? 'text-cyan-400 font-bold bg-[#243756]' : 'text-cyan-700 font-bold bg-cyan-100'
              : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Manual
        </button>}
      </div>
    </header>
  );
};
