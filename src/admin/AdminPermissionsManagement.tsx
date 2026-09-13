import React, { useState, useEffect, useMemo } from 'react';
import { AdminUser, AdminRole } from '@/src/shared/types';
import { storageService } from '@/src/shared/services/storageService';
import { dbService } from '@/src/shared/services/dbService';
import { registrarLogAuditoria } from '@/src/shared/services/auditService';
import { ROLE_INFO, rbacService, CONSOLIDATED_ROLES } from '@/src/shared/services/rbacService';
import { isMasterAdminEmail } from '@/src/shared/services/authService';
import { InfoTooltip } from '@/src/shared/components/InfoTooltip';
import { 
  ShieldCheck, 
  UserPlus, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  User, 
  Briefcase,
  Shield,
  Cloud, 
  Edit3,
  Search,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ToggleLeft,
  ToggleRight,
  Building2,
  Calendar,
  X,
  Sparkles,
  Ban,
  RefreshCw
} from 'lucide-react';

interface AdminPermissionsManagementProps {
  theme?: 'dark' | 'light';
  currentUserEmail: string;
  onAdminListChange?: (admins: AdminUser[]) => void;
}

const POSTO_GRAD_OPTIONS = [
  'Cel',
  'Ten Cel',
  'Maj',
  'Cap',
  '1º Ten',
  '2º Ten',
  'Asp',
  'SO',
  '1S',
  '2S',
  '3S',
  'CB',
  'SD',
  'Servidor Civil',
  'Engenheiro',
  'Analista',
  'Outro'
];

export const AdminPermissionsManagement: React.FC<AdminPermissionsManagementProps> = ({
  theme = 'dark',
  currentUserEmail,
  onAdminListChange,
}) => {
  const isDark = theme === 'dark';

  // Base state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<string>('SUPER_ADMIN');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [saram, setSaram] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [postoGraduacao, setPostoGraduacao] = useState('');
  const [funcao, setFuncao] = useState('');
  const [tituloImpressao, setTituloImpressao] = useState('');
  const [nivelAcesso, setNivelAcesso] = useState<AdminRole>('RH_ADMIN');
  const [canteiroSede, setCanteiroSede] = useState('KO');
  const [statusInicial, setStatusInicial] = useState<'ativo' | 'pendente'>('ativo');

  // Feedback State
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Forçar atualização manual da lista de administradores e solicitações pendentes
  const handleRefreshAdmins = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const freshList = await dbService.getAdmins(true);
      const cleanedList = freshList.filter(a => 
        a.email && 
        !a.email.includes('@empresa.com.br') && 
        a.email !== 'admin@comara.mil.br'
      );

      let fullList = [...cleanedList];
      if (cleanedList.length === 0) {
        fullList.unshift({
          id: 'adm-super-master',
          email: 'coari.comara@gmail.com',
          nome: 'Coari Comara (Administrador Geral)',
          cargo: 'Super Administrador TI / RH',
          funcao: 'Super Administrador TI / RH',
          postoGraduacao: 'Maj',
          nomeGuerra: 'Coari',
          saram: '1000000',
          tituloImpressao: 'Chefe da Seção de Pessoal & TI',
          nivelAcesso: 'SUPER_ADMIN',
          role: 'SUPER_ADMIN',
          status: 'ativo',
          ativo: true,
          sede: 'TODAS',
          canteiroSede: 'TODAS',
          criadoEm: '2026-01-01 00:00:00',
        });
      }
      setAdmins(fullList);
      if (onAdminListChange) onAdminListChange(fullList);
      storageService.saveAdmins(fullList);

      const pendentesNovos = fullList.filter(a => a.status === 'pendente').length;
      if (pendentesNovos > 0) {
        setFeedbackMsg(`Base atualizada! ${pendentesNovos} solicitação(ões) de acesso pendente(s) encontrada(s).`);
      } else {
        setFeedbackMsg('Lista de acessos atualizada. Nenhuma nova solicitação pendente no momento.');
      }
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      console.error('Erro ao atualizar lista de administradores:', err);
      setErrorMsg('Falha ao consultar novas solicitações no Firestore.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sync real-time with banco de dados (once, optimized)
  useEffect(() => {
    const unsub = dbService.subscribeAdmins((list) => {
      // Filtra contas fictícias legadas
      const cleanedList = list.filter(a => 
        a.email && 
        !a.email.includes('@empresa.com.br') && 
        a.email !== 'admin@comara.mil.br'
      );

      let fullList = [...cleanedList];
      if (cleanedList.length === 0) {
        fullList.unshift({
          id: 'adm-super-master',
          email: 'coari.comara@gmail.com',
          nome: 'Coari Comara (Administrador Geral)',
          cargo: 'Super Administrador TI / RH',
          funcao: 'Super Administrador TI / RH',
          postoGraduacao: 'Maj',
          nomeGuerra: 'Coari',
          saram: '1000000',
          tituloImpressao: 'Chefe da Seção de Pessoal & TI',
          nivelAcesso: 'SUPER_ADMIN',
          role: 'SUPER_ADMIN',
          status: 'ativo',
          ativo: true,
          sede: 'TODAS',
          canteiroSede: 'TODAS',
          criadoEm: '2026-01-01 00:00:00',
        });
      }
      setAdmins(fullList);
      if (onAdminListChange) onAdminListChange(fullList);
    }, () => {
      setAdmins([]);
    });

    return () => unsub();
  }, []);

  const currentAdmin = admins.find(
    (a) => a.ativo && a.email.toLowerCase() === currentUserEmail.toLowerCase()
  );

  const isCurrentSuperAdmin = currentAdmin
    ? (currentAdmin.nivelAcesso === 'SUPER_ADMIN' || currentAdmin.role === 'SUPER_ADMIN')
    : (admins.length === 0 && isMasterAdminEmail(currentUserEmail));

  // Toggle Row Expansion
  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Group and count admins locally
  const { pendingCount, inactiveCount, roleCounts, activeTabsList } = useMemo(() => {
    let pending = 0;
    let inactive = 0;
    const rCounts: Record<string, number> = {};

    CONSOLIDATED_ROLES.forEach(r => {
      rCounts[r] = 0;
    });

    admins.forEach(adm => {
      const isInactive = adm.status === 'inativo' || adm.status === 'bloqueado' || adm.ativo === false;
      const isPending = adm.status === 'pendente';

      if (isPending) {
        pending++;
      } else if (isInactive) {
        inactive++;
      } else {
        const normalized = rbacService.normalizeRole(adm.nivelAcesso || adm.role);
        rCounts[normalized] = (rCounts[normalized] || 0) + 1;
      }
    });

    // Auto-select tab if currently active tab has 0 but another has items, or stay
    return {
      pendingCount: pending,
      inactiveCount: inactive,
      roleCounts: rCounts,
      activeTabsList: CONSOLIDATED_ROLES
    };
  }, [admins]);

  // Filtered admins based on activeTab and searchQuery
  const filteredAdmins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return admins.filter(adm => {
      const isInactive = adm.status === 'inativo' || adm.status === 'bloqueado' || adm.ativo === false;
      const isPending = adm.status === 'pendente';
      const normalizedRole = rbacService.normalizeRole(adm.nivelAcesso || adm.role);

      // Tab filter
      let matchesTab = false;
      if (activeTab === 'PENDENTES') {
        matchesTab = isPending;
      } else if (activeTab === 'DESATIVADOS') {
        matchesTab = isInactive;
      } else {
        matchesTab = !isPending && !isInactive && normalizedRole === activeTab;
      }

      if (!matchesTab) return false;

      // Search Query filter (local in memory)
      if (!query) return true;

      const matchNome = (adm.nome || '').toLowerCase().includes(query);
      const matchEmail = (adm.email || '').toLowerCase().includes(query);
      const matchSaram = (adm.saram || '').toLowerCase().includes(query);
      const matchNomeGuerra = (adm.nomeGuerra || '').toLowerCase().includes(query);
      const matchPosto = (adm.postoGraduacao || '').toLowerCase().includes(query);
      const matchFuncao = (adm.funcao || adm.cargo || '').toLowerCase().includes(query);
      const matchCanteiro = (adm.canteiroSede || adm.sede || '').toLowerCase().includes(query);

      return matchNome || matchEmail || matchSaram || matchNomeGuerra || matchPosto || matchFuncao || matchCanteiro;
    });
  }, [admins, activeTab, searchQuery]);

  // Open "Novo Pré-Cadastro" Modal
  const handleOpenCreateModal = () => {
    setEditingAdmin(null);
    setEmail('');
    setNome('');
    setSaram('');
    setNomeGuerra('');
    setPostoGraduacao('1º Ten');
    setFuncao('Analista de RH');
    setTituloImpressao('');
    setNivelAcesso('RH_ADMIN');
    setCanteiroSede('TODAS');
    setStatusInicial('ativo');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (adm: AdminUser) => {
    setEditingAdmin(adm);
    setEmail(adm.email);
    setNome(adm.nome || '');
    setSaram(adm.saram || '');
    setNomeGuerra(adm.nomeGuerra || '');
    setPostoGraduacao(adm.postoGraduacao || '');
    setFuncao(adm.funcao || adm.cargo || '');
    setTituloImpressao(adm.tituloImpressao || '');
    const normalizedRole = rbacService.normalizeRole(adm.nivelAcesso || adm.role);
    setNivelAcesso(normalizedRole);
    setCanteiroSede(adm.canteiroSede || adm.sede || 'KO');
    setStatusInicial(adm.status === 'pendente' ? 'pendente' : 'ativo');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Save or Update Admin User (Firestore + Local State)
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Informe um endereço de e-mail corporativo ou Google Workspace válido.');
      return;
    }

    if (!editingAdmin) {
      if (admins.some((a) => a.email.toLowerCase() === cleanEmail)) {
        setErrorMsg(`O e-mail "${cleanEmail}" já está cadastrado na base de usuários.`);
        return;
      }
    }

    setIsSaving(true);

    const resolvedStatus = editingAdmin 
      ? editingAdmin.status 
      : statusInicial;
    const isAtivo = resolvedStatus === 'ativo';

    const selectedSede = rbacService.hasGlobalAccess(nivelAcesso) ? 'TODAS' : canteiroSede;

    const adminData: AdminUser = {
      id: cleanEmail,
      email: cleanEmail,
      nome: nome.trim() || cleanEmail.split('@')[0],
      saram: saram.trim() || undefined,
      nomeGuerra: nomeGuerra.trim() || undefined,
      postoGraduacao: postoGraduacao.trim() || undefined,
      funcao: funcao.trim() || 'Gestor RH',
      cargo: funcao.trim() || 'Gestor RH',
      tituloImpressao: tituloImpressao.trim() || undefined,
      nivelAcesso,
      role: nivelAcesso,
      perfil: nivelAcesso,
      sede: selectedSede,
      canteiroSede: selectedSede,
      canteiroCodigo: selectedSede,
      status: resolvedStatus,
      ativo: isAtivo,
      criadoEm: editingAdmin?.criadoEm || new Date().toISOString().replace('T', ' ').substring(0, 19),
      atualizadoEm: new Date().toISOString(),
    };

    try {
      const saveResult = await dbService.saveAdminUser(adminData);

      // Local State immediate update
      setAdmins(prev => {
        const idx = prev.findIndex(a => a.email.toLowerCase() === cleanEmail);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = adminData;
          return copy;
        } else {
          return [adminData, ...prev];
        }
      });

      // Audit Log
      await dbService.logSystemEvent({
        tipo: 'ALTERACAO_PERMISSAO_RBAC',
        descricao: editingAdmin 
          ? `Atualização de dados e perfil RBAC de ${adminData.nome} (${adminData.email}) -> ${nivelAcesso}`
          : `Novo pré-cadastro de usuário ${adminData.nome} (${adminData.email}) com perfil ${nivelAcesso}`,
        usuario: currentUserEmail,
        detalhes: {
          email: adminData.email,
          nome: adminData.nome,
          saram: adminData.saram,
          nomeGuerra: adminData.nomeGuerra,
          postoGraduacao: adminData.postoGraduacao,
          funcao: adminData.funcao,
          nivelAcesso,
          canteiroSede: adminData.canteiroSede,
          status: adminData.status,
        }
      });

      registrarLogAuditoria({
        usuarioId: currentUserEmail,
        usuarioNome: currentUserEmail.split('@')[0] || 'Super Admin',
        usuarioPerfil: 'SUPER_ADMIN',
        canteiroId: adminData.canteiroSede || 'SEDE-MN',
        tipoAcao: editingAdmin ? 'ALTERACAO_FUNCAO' : 'CRIACAO_REGISTRO',
        detalhes: editingAdmin 
          ? `Perfil RBAC atualizado: ${adminData.nome} (${adminData.email}) alterado para ${nivelAcesso} [${adminData.postoGraduacao || ''} - ${adminData.funcao || ''}].`
          : `Pré-cadastro criado: ${adminData.nome} (${adminData.email}) com perfil ${nivelAcesso} no canteiro ${adminData.canteiroSede}.`,
        recursoId: adminData.email,
      });

      let successMsg = editingAdmin 
        ? `Usuário "${adminData.nome}" atualizado com sucesso!` 
        : `Usuário "${adminData.nome}" cadastrado com sucesso!`;

      if (saveResult?.tempPassword) {
        successMsg += ` Senha temporária: ${saveResult.tempPassword}`;
      }
      if (saveResult?.warning) {
        successMsg += ` (Aviso: ${saveResult.warning})`;
      }

      setFeedbackMsg(successMsg);

      // Switch to the user's tab automatically
      if (adminData.status === 'pendente') {
        setActiveTab('PENDENTES');
      } else if (adminData.status === 'inativo' || adminData.status === 'bloqueado' || !adminData.ativo) {
        setActiveTab('DESATIVADOS');
      } else {
        setActiveTab(nivelAcesso);
      }

      setIsModalOpen(false);
      setEditingAdmin(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar usuário no Firestore:', err);
      setErrorMsg('Erro ao salvar usuário no Firestore. Verifique sua conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Status: Enable / Disable
  const handleToggleStatus = async (adm: AdminUser) => {
    if (adm.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      alert('Você não pode desativar seu próprio acesso administrativo ativo.');
      return;
    }

    const isCurrentlyInactive = adm.status === 'inativo' || adm.status === 'bloqueado' || adm.ativo === false;
    const nextStatus: AdminUser['status'] = isCurrentlyInactive ? 'ativo' : 'inativo';
    const nextAtivo = nextStatus === 'ativo';

    const normalizedRole = rbacService.normalizeRole(adm.nivelAcesso || adm.role);

    const updated: AdminUser = {
      ...adm,
      status: nextStatus,
      ativo: nextAtivo,
      atualizadoEm: new Date().toISOString(),
    };

    try {
      await dbService.saveAdminUser(updated);

      setAdmins(prev => prev.map(a => a.email.toLowerCase() === adm.email.toLowerCase() ? updated : a));

      // Auto tab change if necessary
      if (nextStatus === 'inativo') {
        setActiveTab('DESATIVADOS');
      } else {
        setActiveTab(normalizedRole);
      }

      setFeedbackMsg(nextStatus === 'ativo' 
        ? `Usuário "${adm.nome}" reabilitado e ativado com sucesso!` 
        : `Acesso do usuário "${adm.nome}" desabilitado.`
      );
      setTimeout(() => setFeedbackMsg(null), 4000);

      await dbService.logSystemEvent({
        tipo: 'ALTERACAO_PERMISSAO_RBAC',
        descricao: `Status de acesso de ${adm.nome} alterado para ${nextStatus.toUpperCase()}`,
        usuario: currentUserEmail,
        detalhes: { email: adm.email, status: nextStatus, ativo: nextAtivo }
      });
    } catch (err) {
      console.error('Erro ao alternar status do usuário:', err);
      setErrorMsg('Não foi possível alterar o status do usuário.');
    }
  };

  // Approve Pending User
  const handleApprovePendingUser = async (adm: AdminUser) => {
    if (!adm || !adm.email) return;

    const selectedRole = rbacService.normalizeRole(adm.role || adm.nivelAcesso || 'AUX_DA');
    const updated: AdminUser = {
      ...adm,
      status: 'ativo',
      ativo: true,
      perfil: selectedRole,
      nivelAcesso: selectedRole,
      role: selectedRole,
      sede: adm.sede || adm.canteiroSede || 'TODAS',
      canteiroSede: adm.canteiroSede || adm.sede || 'TODAS',
      atualizadoEm: new Date().toISOString(),
    };

    try {
      await dbService.saveAdminUser(updated);

      setAdmins(prev => prev.map(a => a.email.toLowerCase() === adm.email.toLowerCase() ? updated : a));
      setActiveTab(selectedRole);

      setFeedbackMsg(`Usuário "${adm.nome}" aprovado e ativado no perfil ${ROLE_INFO[selectedRole]?.shortLabel || selectedRole}!`);
      setTimeout(() => setFeedbackMsg(null), 4000);

      await dbService.logSystemEvent({
        tipo: 'ALTERACAO_PERMISSAO_RBAC',
        descricao: `Aprovação de usuário pendente: ${adm.nome} (${adm.email}) ativado como ${selectedRole}`,
        usuario: currentUserEmail,
        detalhes: { email: adm.email, role: selectedRole }
      });
    } catch (err) {
      console.error('Erro ao aprovar usuário pendente:', err);
      setErrorMsg('Não foi possível aprovar o usuário.');
    }
  };

  return (
    <div className="space-y-6" id="admin-rbac-management-view">
      {/* Top Header & Cloud Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`text-xl font-bold font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Gestão de Permissões de Acesso (RBAC)
            </h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 ${
              isDark ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <Cloud className="w-3 h-3" />
              <span>banco de dados Sync</span>
            </span>
          </div>
          <p className={`text-xs mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            Controle de perfis de acesso, escopos por canteiro e homologação de novos gestores
            <InfoTooltip theme={theme} content="Apenas e-mails corporativos cadastrados e ativos no banco de dados têm permissão para acessar o painel de gestão." />
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-atualizar-rbac"
            type="button"
            onClick={handleRefreshAdmins}
            disabled={isRefreshing}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
              isDark 
                ? 'bg-[#16243D] text-slate-300 border-[#243756] hover:text-white hover:bg-[#1E3252]' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
            }`}
            title="Atualizar lista de administradores e solicitações pendentes no banco de dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
          </button>

          {isCurrentSuperAdmin && (
            <button
              id="btn-novo-pre-cadastro"
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo Pré-Cadastro</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Search Filter (Local in-memory search) */}
      <div className={`p-3 rounded-2xl border ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="relative">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            id="input-busca-rbac"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, SARAM, nome de guerra, e-mail ou função..."
            className={`w-full pl-10 pr-10 py-2 rounded-xl text-xs outline-hidden border transition-all ${
              isDark 
                ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-xs cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation (Abas com contadores) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {/* Aba Pendentes */}
        <button
          type="button"
          id="tab-pendentes"
          onClick={() => setActiveTab('PENDENTES')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
            activeTab === 'PENDENTES'
              ? isDark 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                : 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm'
              : isDark 
                ? 'bg-[#16243D] text-slate-400 border-[#243756] hover:text-slate-200 hover:bg-[#1E3252]' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>Pendentes</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
              {pendingCount}
            </span>
          )}
        </button>

        {/* Abas dos Perfis Ativos */}
        {activeTabsList.map((roleKey) => {
          const meta = ROLE_INFO[roleKey] || ROLE_INFO.AUX_DA;
          const count = roleCounts[roleKey] || 0;
          const isActive = activeTab === roleKey;

          return (
            <button
              key={roleKey}
              type="button"
              id={`tab-role-${roleKey.toLowerCase()}`}
              onClick={() => setActiveTab(roleKey)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                isActive
                  ? isDark 
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20' 
                    : 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                  : isDark 
                    ? 'bg-[#16243D] text-slate-300 border-[#243756] hover:text-white hover:bg-[#1E3252]' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{meta.shortLabel || roleKey}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : isDark ? 'bg-[#243756] text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Aba Desativados */}
        <button
          type="button"
          id="tab-desativados"
          onClick={() => setActiveTab('DESATIVADOS')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
            activeTab === 'DESATIVADOS'
              ? isDark 
                ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm' 
                : 'bg-red-100 text-red-900 border-red-300 shadow-sm'
              : isDark 
                ? 'bg-[#16243D] text-slate-400 border-[#243756] hover:text-slate-200 hover:bg-[#1E3252]' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>Desativados</span>
          {inactiveCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-red-500 text-white">
              {inactiveCount}
            </span>
          )}
        </button>
      </div>

      {/* BANNER DEDICADO NA ABA PENDENTE COM BOTÃO DE ATUALIZAR */}
      {activeTab === 'PENDENTES' && (
        <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
          isDark ? 'bg-amber-950/25 border-amber-500/40 text-amber-300' : 'bg-amber-50/90 border-amber-300 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>Solicitações de Acesso Pendentes</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-amber-500/30 text-amber-200 border border-amber-500/40">
                  {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
                </span>
              </div>
              <p className={`text-[11px] mt-0.5 leading-tight ${isDark ? 'text-amber-200/80' : 'text-amber-800'}`}>
                {pendingCount === 0 
                  ? 'Nenhum pedido de acesso aguardando homologação. Clique em atualizar para checar novas tentativas de login.' 
                  : 'Usuários autenticados via Google aguardando atribuição de perfil e canteiro.'}
              </p>
            </div>
          </div>
          <button
            id="btn-atualizar-pendentes-banner"
            type="button"
            onClick={handleRefreshAdmins}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Verificar se alguém pediu acesso sem precisar sair e entrar novamente"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Verificando...' : 'Atualizar Pendentes'}</span>
          </button>
        </div>
      )}

      {/* Tabela de Administradores / Gestores */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" id="table-rbac-users">
            <thead className={`uppercase font-bold border-b ${
              isDark ? 'bg-[#0F1B33] border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <tr>
                <th className="py-3.5 px-5">NOME</th>
                <th className="py-3.5 px-5">POSTO/GRAD</th>
                <th className="py-3.5 px-5">FUNÇÃO</th>
                <th className="py-3.5 px-5 text-center">CANTEIRO/SEDE</th>
                <th className="py-3.5 px-5 text-right w-16">DETALHES</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${
              isDark ? 'divide-[#243756] text-[#E2E8F0]' : 'divide-slate-200 text-slate-800'
            }`}>
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs">
                    {activeTab === 'PENDENTES' ? (
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            Nenhuma solicitação pendente no momento
                          </p>
                          <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Quando alguém tentar entrar com a conta Google corporativa, o pedido ficará visível aqui para sua liberação.
                          </p>
                        </div>
                        <button
                          id="btn-atualizar-pendentes-empty-state"
                          type="button"
                          onClick={handleRefreshAdmins}
                          disabled={isRefreshing}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                          <span>{isRefreshing ? 'Verificando solicitações...' : 'Atualizar e Checar Agora'}</span>
                        </button>
                      </div>
                    ) : (
                      <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        Nenhum usuário encontrado nesta aba.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((adm) => {
                  const isSelf = adm.email.toLowerCase() === currentUserEmail.toLowerCase();
                  const roleKey = rbacService.normalizeRole(adm.nivelAcesso || adm.role);
                  const roleMeta = ROLE_INFO[roleKey] || ROLE_INFO.AUX_DA;
                  const isExpanded = Boolean(expandedRows[adm.email]);
                  const isInactive = adm.status === 'inativo' || adm.status === 'bloqueado' || adm.ativo === false;
                  const isPending = adm.status === 'pendente';

                  const canteiroDisplay = rbacService.hasGlobalAccess(roleKey) 
                    ? 'TODAS (Global)' 
                    : (adm.canteiroSede || adm.sede || adm.canteiroCodigo || 'KO');

                  return (
                    <React.Fragment key={adm.email}>
                      <tr 
                        onClick={() => toggleRow(adm.email)}
                        className={`transition-colors cursor-pointer ${
                          isExpanded 
                            ? isDark ? 'bg-[#1E3252]/80' : 'bg-blue-50/50' 
                            : isDark ? 'hover:bg-[#1E3252]/40' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* 1. NOME */}
                        <td className="py-3.5 px-5 font-sans">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shrink-0 ${
                              isInactive
                                ? isDark ? 'bg-red-950/40 text-red-400 border-red-800/40' : 'bg-red-100 text-red-700 border-red-300'
                                : isPending
                                ? isDark ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' : 'bg-amber-100 text-amber-700 border-amber-300'
                                : rbacService.hasGlobalAccess(roleKey)
                                ? isDark ? 'bg-purple-950/60 text-purple-300 border-purple-800/40' : 'bg-purple-100 text-purple-700 border-purple-300'
                                : isDark ? 'bg-blue-950/60 text-blue-300 border-blue-800/40' : 'bg-blue-100 text-blue-700 border-blue-300'
                            }`}>
                              {adm.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                              <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'} text-xs flex items-center gap-1.5`}>
                                <span>{adm.nome}</span>
                                {adm.nomeGuerra && (
                                  <span className={`text-[11px] font-normal ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                    ({adm.nomeGuerra})
                                  </span>
                                )}
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    Você
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] font-mono ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                                {adm.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. POSTO/GRAD */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {adm.postoGraduacao || '—'}
                          </span>
                        </td>

                        {/* 3. FUNÇÃO */}
                        <td className="py-3.5 px-5">
                          <div className="flex flex-col gap-0.5">
                            <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {adm.funcao || adm.cargo || 'Gestor RH'}
                            </span>
                            {adm.tituloImpressao && (
                              <span className={`text-[10px] font-mono ${isDark ? 'text-cyan-400/90' : 'text-cyan-700'}`}>
                                🖨️ Impresso: {adm.tituloImpressao}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. CANTEIRO/SEDE */}
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border ${
                            canteiroDisplay.includes('Global')
                              ? isDark ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : isDark ? 'bg-blue-950/40 text-blue-300 border-blue-800/40' : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {canteiroDisplay}
                          </span>
                        </td>

                        {/* 5. CHEVRON EXPANSÃO */}
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(adm.email);
                              }}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isDark 
                                  ? 'bg-[#0F1B33] border-[#243756] text-slate-300 hover:bg-[#243756]' 
                                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                              }`}
                              title={isExpanded ? "Ocultar detalhes" : "Ver detalhes e ações"}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* PAINEL EXPANDIDO DE DETALHES & AÇÕES */}
                      {isExpanded && (
                        <tr className={isDark ? 'bg-[#0F1B33]/90' : 'bg-slate-50'}>
                          <td colSpan={5} className="p-5 border-t border-b border-blue-500/20">
                            <div className="space-y-4">
                              {/* Grid de Informações Detalhadas */}
                              <div className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs ${
                                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                              }`}>
                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    E-mail Corporativo
                                  </span>
                                  <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {adm.email}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    SARAM / Matrícula
                                  </span>
                                  <span className={`font-mono font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {adm.saram || 'Não informado'}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Nome de Guerra
                                  </span>
                                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {adm.nomeGuerra || 'Não informado'}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Posto / Graduação
                                  </span>
                                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {adm.postoGraduacao || 'Não informado'}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Função Oficial
                                  </span>
                                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {adm.funcao || adm.cargo || 'Gestor RH'}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Perfil de Acesso (RBAC)
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold border ${roleMeta.badgeColor}`}>
                                    {roleMeta.label}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Status do Usuário
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold border ${
                                    isPending 
                                      ? isDark ? 'bg-amber-950/50 text-amber-400 border-amber-800/60' : 'bg-amber-100 text-amber-800 border-amber-300'
                                      : isInactive
                                      ? isDark ? 'bg-red-950/50 text-red-400 border-red-800/60' : 'bg-red-100 text-red-800 border-red-300'
                                      : isDark ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  }`}>
                                    {isPending ? '● PENDENTE DE APROVAÇÃO' : isInactive ? '○ DESATIVADO' : '● ATIVO'}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Canteiro / Sede
                                  </span>
                                  <span className={`font-mono font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {canteiroDisplay}
                                  </span>
                                </div>

                                <div className="sm:col-span-2">
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Título do Cargo Impresso (Guias & Assinaturas)
                                  </span>
                                  <span className={`font-sans ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {adm.tituloImpressao || 'Mesmo da função'}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Data de Cadastro
                                  </span>
                                  <span className={`font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {adm.criadoEm || '—'}
                                  </span>
                                </div>

                                <div>
                                  <span className={`block text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Última Atualização
                                  </span>
                                  <span className={`font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {adm.atualizadoEm || '—'}
                                  </span>
                                </div>
                              </div>

                              {/* Aviso se usuário estiver desativado */}
                              {isInactive && (
                                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2.5">
                                  <Ban className="w-4 h-4 text-red-400 shrink-0" />
                                  <span className="font-semibold">
                                    Usuário desativado. Procure o Gerente ou DA do canteiro para solicitar o desbloqueio.
                                  </span>
                                </div>
                              )}

                              {/* Barra de Ações */}
                              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                                {isPending && isCurrentSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleApprovePendingUser(adm)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Aprovar Acesso</span>
                                  </button>
                                )}

                                {isCurrentSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(adm)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95 cursor-pointer ${
                                      isDark 
                                        ? 'bg-[#16243D] hover:bg-[#1E3252] text-amber-300 border-amber-500/40' 
                                        : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-300'
                                    }`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Editar Dados</span>
                                  </button>
                                )}

                                {isCurrentSuperAdmin && !isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(adm)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95 cursor-pointer ${
                                      isInactive
                                        ? isDark 
                                          ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-700/60' 
                                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : isDark 
                                          ? 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border-red-800/60' 
                                          : 'bg-red-50 hover:bg-red-100 text-red-800 border-red-300'
                                    }`}
                                  >
                                    {isInactive ? (
                                      <>
                                        <ToggleRight className="w-4 h-4 text-emerald-400" />
                                        <span>Reabilitar / Ativar Acesso</span>
                                      </>
                                    ) : (
                                      <>
                                        <ToggleLeft className="w-4 h-4 text-red-400" />
                                        <span>Desabilitar Acesso</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {isSelf && (
                                  <span className={`text-[11px] px-3 py-1.5 rounded-lg ${isDark ? 'text-slate-500 bg-[#16243D]' : 'text-slate-400 bg-slate-100'}`}>
                                    Sua própria conta de acesso ativo
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className={`p-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs ${
          isDark ? 'border-[#243756] bg-[#0F1B33] text-[#94A3B8]' : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Segurança RBAC: Autenticação exclusiva Google Workspace com verificação direta de perfil e status.</span>
          </div>
          <span className="font-mono text-[11px]">SPTF Security Engine v4.5</span>
        </div>
      </div>

      {/* MODAL: NOVO PRÉ-CADASTRO OU EDITAR USUÁRIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border animate-in zoom-in-95 ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-blue-500" />
                <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {editingAdmin ? 'Editar Dados do Usuário (RBAC)' : 'Novo Pré-Cadastro de Usuário'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingAdmin(null); }}
                className={`text-sm p-1 rounded-md cursor-pointer ${isDark ? 'text-[#94A3B8] hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdmin} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* E-mail */}
              <div>
                <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                  E-mail Corporativo / Google Workspace *
                </label>
                <input
                  type="email"
                  value={email}
                  disabled={Boolean(editingAdmin)}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@comara.gov.br ou usuario@gmail.com"
                  required
                  className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-mono ${
                    editingAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  } ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                {!editingAdmin && (
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Quando o colaborador fizer login com esta conta Google, as permissões pré-definidas serão vinculadas automaticamente.
                  </p>
                )}
              </div>

              {/* Nome Completo */}
              <div>
                <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva Santos"
                  required
                  className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-sans ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
              </div>

              {/* SARAM / Matrícula & Nome de Guerra */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    SARAM / Matrícula
                  </label>
                  <input
                    type="text"
                    value={saram}
                    onChange={(e) => setSaram(e.target.value)}
                    placeholder="Ex: 7654321 ou 12345"
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-mono ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Nome de Guerra
                  </label>
                  <input
                    type="text"
                    value={nomeGuerra}
                    onChange={(e) => setNomeGuerra(e.target.value)}
                    placeholder="Ex: Silva, Santos, Ferreira"
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-sans ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>
              </div>

              {/* Posto / Graduação & Função */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Posto / Graduação
                  </label>
                  <input
                    type="text"
                    list="posto-grad-list"
                    value={postoGraduacao}
                    onChange={(e) => setPostoGraduacao(e.target.value)}
                    placeholder="Selecione ou digite (ex: Cap, SO, Servidor Civil)"
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-sans ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                  <datalist id="posto-grad-list">
                    {POSTO_GRAD_OPTIONS.map(opt => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Função Oficial *
                  </label>
                  <input
                    type="text"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    placeholder="Ex: Engenheiro Fiscal, Encarregado de DA"
                    required
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-sans ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>
              </div>

              {/* Título do Cargo Impresso */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className={`block font-semibold text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Título do Cargo Impresso (Guias SPTF & Assinaturas)
                  </label>
                  <InfoTooltip 
                    theme={theme}
                    content="Título oficial que constará nas Guias de Dispensa SPTF e Relatórios executivos (ex: 'Capitão Encarregado de Obras', 'Chefe da DA', 'Auxiliar de DA')."
                  />
                </div>
                <input
                  type="text"
                  value={tituloImpressao}
                  onChange={(e) => setTituloImpressao(e.target.value)}
                  placeholder="Ex: Capitão Encarregado de Obras"
                  className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-sans ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
              </div>

              {/* Perfil / Nível de Acesso (RBAC) & Canteiro/Sede */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className={`block font-semibold text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                      Perfil / Nível de Acesso (Role) *
                    </label>
                  </div>
                  <select
                    value={nivelAcesso}
                    onChange={(e) => setNivelAcesso(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-semibold ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (TI - Global)</option>
                    <option value="RH_ADMIN">RH_ADMIN (RH Sede - Global)</option>
                    <option value="GERENTE_CANTEIRO">GERENTE_CANTEIRO (Visualização)</option>
                    <option value="CHEFE_CANTEIRO">CHEFE_CANTEIRO (Operacional)</option>
                    <option value="CHEFE_DA">CHEFE_DA (Gestão DA & Auditoria Local)</option>
                    <option value="AUX_DA">AUX_DA (Auxiliar de Campo / Lançamentos)</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Canteiro / Sede Vinculada {rbacService.hasGlobalAccess(nivelAcesso) ? '(Global)' : '*'}
                  </label>
                  <select
                    value={rbacService.hasGlobalAccess(nivelAcesso) ? 'TODAS' : canteiroSede}
                    disabled={rbacService.hasGlobalAccess(nivelAcesso)}
                    onChange={(e) => setCanteiroSede(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border focus:outline-hidden font-semibold ${
                      rbacService.hasGlobalAccess(nivelAcesso) ? 'opacity-60 cursor-not-allowed' : ''
                    } ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  >
                    {rbacService.hasGlobalAccess(nivelAcesso) ? (
                      <option value="TODAS">TODAS AS SEDES E CANTEIROS (Acesso Global)</option>
                    ) : (
                      <>
                        <option value="KO">KO - Canteiro de Obras Coari (DECO-KO)</option>
                        <option value="BE">BE - Sede Belém / Destacamento de Apoio</option>
                        <option value="MN">MN - Destacamento de Manaus (BAMN)</option>
                        <option value="SP">SP - Destacamento São Paulo</option>
                        <option value="RJ">RJ - Destacamento Rio de Janeiro</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Status Inicial (Apenas para novos pré-cadastros) */}
              {!editingAdmin && (
                <div>
                  <label className={`block font-semibold text-xs mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Status Inicial do Cadastro
                  </label>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="statusInicial"
                        value="ativo"
                        checked={statusInicial === 'ativo'}
                        onChange={() => setStatusInicial('ativo')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>Ativo (Liberado para acesso imediato)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="statusInicial"
                        value="pendente"
                        checked={statusInicial === 'pendente'}
                        onChange={() => setStatusInicial('pendente')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>Pendente (Aguardando homologação futura)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className={`pt-4 border-t flex justify-end gap-2.5 ${
                isDark ? 'border-[#243756]' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingAdmin(null); }}
                  className={`px-4 py-2 font-semibold text-xs rounded-xl cursor-pointer ${
                    isDark ? 'text-[#94A3B8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : editingAdmin ? 'Salvar Alterações' : 'Concluir Pré-Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
