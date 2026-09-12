import React, { useState, useRef, useEffect } from 'react';
import { SystemConfig, AdminRole } from '@/src/shared/types';
import { ComaraLogo } from '@/src/shared/components/ComaraLogo';
import { PWAInstallButton } from '@/src/shared/components/PWAInstallButton';
import { rbacService, ROLE_INFO } from '@/src/shared/services/rbacService';
import { SettingsMenu } from '../SettingsMenu';
import { ActiveTab, UserMode } from '../Navbar';
import {
  Menu,
  Settings,
  LogOut,
  BarChart3,
  Users,
  HardHat,
  Receipt,
  FileCheck,
  FileText,
  BookOpen,
  Clock,
  CalendarCheck2,
  Building2
} from 'lucide-react';

/* ============================================================ */
/* AppShell — Layout alternável "Clean" (Sidebar + Header)      */
/* Moldura estrutural: não contém lógica de negócio; apenas     */
/* chama os mesmos handlers do App para navegação e ações.      */
/* ============================================================ */

/** Rótulo de contexto do módulo ativo (subtítulo do header). */
const MODULE_LABELS: Record<ActiveTab, string> = {
  dashboard: 'Dashboard Executivo',
  extrato: 'Extrato do Colaborador',
  colaboradores: 'Gestão de Colaboradores',
  dispensas_faltas: 'Dispensas & Faltas',
  canteiros: 'Canteiros de Obras & UOs',
  insalubridade: 'Insalubridade (NR-15)',
  contracheques: 'Contracheques Digitais',
  relatorios: 'Relatórios Executivos',
  permissoes_admin: 'Gestão de Acessos (RBAC)',
  auditoria: 'Trilha de Auditoria & Logs',
  arquitetura: 'Manual Operacional',
  configuracoes_instituicao: 'Configurações da Instituição',
  backup_restauracao: 'Backup e Restauração'
};

function roleAvatarClass(currentRole: AdminRole): string {
  if (currentRole === 'SUPER_ADMIN') return 'bg-purple-600';
  if (currentRole === 'RH_ADMIN' || currentRole === 'GESTOR_RH') return 'bg-indigo-600';
  if (currentRole === 'GERENTE_CANTEIRO') return 'bg-blue-600';
  if (currentRole.includes('CHEFE')) return 'bg-amber-600';
  if (currentRole.includes('ENCARREGADO')) return 'bg-emerald-600';
  return 'bg-cyan-600';
}

function roleInitials(currentRole: AdminRole): string {
  if (currentRole === 'SUPER_ADMIN') return 'TI';
  if (currentRole === 'RH_ADMIN' || currentRole === 'GESTOR_RH') return 'RH';
  if (currentRole === 'AUX_DA' || (currentRole as string) === 'AUXILIAR_DA') return 'DA';
  return 'OP';
}

/* ------------------------------------------------------------ */
/* Item de navegação principal da sidebar                        */
/* ------------------------------------------------------------ */
interface SidebarNavItemProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ active, icon, label, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
      active
        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-xs'
        : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border-transparent'
    }`}
  >
    <span className="shrink-0">{icon}</span>
    <span className="flex-1 text-left truncate">{label}</span>
    {badge !== undefined && (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-[#16243D] text-slate-300 border border-[#243756]">
        {badge}
      </span>
    )}
  </button>
);

/* ------------------------------------------------------------ */
/* Item de ação rápida (seção "Registrar")                       */
/* ------------------------------------------------------------ */
interface SidebarActionItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

const SidebarActionItem: React.FC<SidebarActionItemProps> = ({ icon, title, subtitle, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 text-slate-300 hover:text-white transition-all cursor-pointer"
  >
    <span className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-bold truncate">{title}</span>
      <span className="block text-[10px] text-slate-500 truncate">{subtitle}</span>
    </span>
  </button>
);

/* ------------------------------------------------------------ */
/* SIDEBAR                                                       */
/* ------------------------------------------------------------ */
interface AppSidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenQuickBatchModal: () => void;
  onOpenNewEntry: () => void;
  onOpenSptfDispensa?: () => void;
  systemConfig?: SystemConfig;
  totalEmployees: number;
  currentUserEmail: string;
  userRole?: AdminRole | string;
  onSignOut: () => void;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickBatchModal,
  onOpenNewEntry,
  onOpenSptfDispensa,
  systemConfig,
  totalEmployees,
  currentUserEmail,
  userRole = 'SUPER_ADMIN',
  onSignOut,
  isDrawerOpen,
  onCloseDrawer
}) => {
  const currentRole = (userRole || 'SUPER_ADMIN') as AdminRole;
  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.AUX_DA;
  const isAuxDA = currentRole === 'AUX_DA' || (currentRole as string) === 'AUXILIAR_DA';

  const select = (tab: ActiveTab) => onSelectTab(tab);

  return (
    <>
      {/* Overlay da gaveta mobile */}
      {isDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
          onClick={onCloseDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 flex flex-col bg-[#0B1426] border-r border-[#1D2C47] transition-transform duration-200 lg:translate-x-0 ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navegação principal"
      >
        {/* Topo institucional: logo + nome */}
        <div
          className="p-4 border-b border-[#1D2C47] flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => select('dashboard')}
          title="Ir para o Dashboard"
        >
          <ComaraLogo logoUrl={systemConfig?.logoUrl} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-black text-white tracking-tight truncate">
              COMARA <span className="text-blue-400">SPTF</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider truncate">
              Gestão &amp; Administração
            </div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <SidebarNavItem
            active={activeTab === 'dashboard' || activeTab === 'extrato'}
            icon={<BarChart3 className="w-4 h-4" />}
            label="Dashboard"
            onClick={() => select('dashboard')}
          />
          <SidebarNavItem
            active={activeTab === 'colaboradores'}
            icon={<Users className="w-4 h-4" />}
            label="Colaboradores"
            badge={totalEmployees}
            onClick={() => select('colaboradores')}
          />
          <SidebarNavItem
            active={activeTab === 'insalubridade'}
            icon={<HardHat className="w-4 h-4" />}
            label="Insalubridade"
            onClick={() => select('insalubridade')}
          />
          <SidebarNavItem
            active={activeTab === 'contracheques'}
            icon={<Receipt className="w-4 h-4" />}
            label="Contracheques"
            onClick={() => select('contracheques')}
          />
          <SidebarNavItem
            active={activeTab === 'dispensas_faltas'}
            icon={<FileCheck className="w-4 h-4" />}
            label="Dispensas & Faltas"
            onClick={() => select('dispensas_faltas')}
          />
          {!isAuxDA && (
            <SidebarNavItem
              active={activeTab === 'relatorios'}
              icon={<FileText className="w-4 h-4" />}
              label="Relatórios"
              onClick={() => select('relatorios')}
            />
          )}
          {!isAuxDA && (
            <SidebarNavItem
              active={activeTab === 'arquitetura'}
              icon={<BookOpen className="w-4 h-4" />}
              label="Manual"
              onClick={() => select('arquitetura')}
            />
          )}

          {/* Seção REGISTRAR — ações rápidas de lançamento */}
          <div className="pt-3 px-3 pb-1 text-[9px] uppercase font-black tracking-widest text-slate-600">
            Registrar
          </div>
          <SidebarActionItem
            icon={<Clock className="w-3.5 h-3.5" />}
            title="Lançamento de Horas"
            subtitle="Lote / Rápido"
            onClick={onOpenQuickBatchModal}
          />
          <SidebarActionItem
            icon={<CalendarCheck2 className="w-3.5 h-3.5" />}
            title="Lançamento Individual"
            subtitle="Diário, com anexo"
            onClick={onOpenNewEntry}
          />
          {onOpenSptfDispensa && (
            <SidebarActionItem
              icon={<FileText className="w-3.5 h-3.5" />}
              title="Nova Dispensa de SPTF"
              subtitle="Guia A4 — 2 vias"
              onClick={onOpenSptfDispensa}
            />
          )}
          <SidebarActionItem
            icon={<HardHat className="w-3.5 h-3.5" />}
            title="Insalubridade (NR-15)"
            subtitle="Planilha mensal de campo"
            onClick={() => select('insalubridade')}
          />
        </nav>

        {/* Rodapé: perfil + sair discreto */}
        <div className="border-t border-[#1D2C47] p-3 space-y-1.5">
          <div className="flex items-center gap-2.5 px-1">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 ${roleAvatarClass(currentRole)}`}>
              {roleInitials(currentRole)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{roleMeta.label}</div>
              <div className="text-[10px] font-mono text-slate-500 truncate">{currentUserEmail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
            title="Encerrar Sessão (Sair)"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Encerrar sessão</span>
          </button>
        </div>
      </aside>
    </>
  );
};

/* ------------------------------------------------------------ */
/* HEADER (área principal)                                      */
/* ------------------------------------------------------------ */
interface AppShellHeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenQuickBatchModal: () => void;
  onOpenNewEntry: () => void;
  onOpenSptfDispensa?: () => void;
  onOpenImportRecordsModal: () => void;
  onOpenLogoModal?: () => void;
  onResetData: () => void;
  onClearData: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleLayout: () => void;
  userMode: UserMode;
  onToggleUserMode: (mode: UserMode) => void;
  currentUserEmail: string;
  userRole?: AdminRole | string;
  onOpenDrawer: () => void;
}

export const AppShellHeader: React.FC<AppShellHeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickBatchModal,
  onOpenNewEntry,
  onOpenSptfDispensa,
  onOpenImportRecordsModal,
  onOpenLogoModal,
  onResetData,
  onClearData,
  theme,
  onToggleTheme,
  onToggleLayout,
  userMode,
  onToggleUserMode,
  currentUserEmail,
  userRole = 'SUPER_ADMIN',
  onOpenDrawer
}) => {
  const isDark = theme === 'dark';
  const currentRole = (userRole || 'SUPER_ADMIN') as AdminRole;
  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.AUX_DA;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#16243D]/90 border-[#243756] text-[#E2E8F0]' : 'bg-white/90 border-slate-200 text-slate-900'
      }`}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        {/* Esquerda: hamburger (mobile) + boas-vindas */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenDrawer}
            className={`lg:hidden p-2 rounded-xl border transition-colors active:scale-[0.98] cursor-pointer shrink-0 ${
              isDark
                ? 'bg-[#16243D] hover:bg-[#243756] text-slate-300 border-[#243756]'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Abrir menu de navegação"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg xl:text-xl font-black tracking-tight truncate">
              Bem-vindo(a), {roleMeta.label}
            </h1>
            <p className={`text-xs truncate ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              <span className="capitalize">{today}</span> • {MODULE_LABELS[activeTab] || 'Painel'}
            </p>
          </div>
        </div>

        {/* Direita: PWA, tema, layout, engrenagem */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <PWAInstallButton variant="navbar" theme={theme} />

          {/* Engrenagem: configurações, lançamentos, tema, layout e seletor de perfil RBAC */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
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
              <Settings className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-45 text-blue-500' : ''}`} />
            </button>

            {isSettingsOpen && (
              <SettingsMenu
                theme={theme}
                onToggleTheme={onToggleTheme}
                onToggleLayout={onToggleLayout}
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
                currentUserEmail={currentUserEmail}
                userRole={userRole}
                onClose={() => setIsSettingsOpen(false)}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
