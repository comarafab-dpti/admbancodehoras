import React, { useState, useMemo, useEffect } from 'react';
import { ConstructionSite, Employee, InsalubrityRecord, Branch, GrauInsalubridade } from '@/src/shared/types';
import { InfoTooltip } from '@/src/shared/components/InfoTooltip';
import { canteiroService } from '@/src/shared/services/canteiroService';
import { dbService } from '@/src/shared/services/dbService';
import { SetoresManagementTab } from './SetoresManagementTab';
import { setorService } from '@/src/shared/services/setorService';
import { 
  Building2, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  MapPin, 
  HardHat, 
  Download, 
  CheckCircle2, 
  X,
  Phone,
  UserCheck,
  AlertCircle,
  Calendar,
  Layers,
  Power
} from 'lucide-react';

interface CanteirosManagementProps {
  constructionSites?: ConstructionSite[];
  employees?: Employee[];
  insalubrityRecords?: InsalubrityRecord[];
  onSaveSite?: (site: Partial<ConstructionSite>) => Promise<void>;
  onDeleteSite?: (id: string) => Promise<void>;
  theme?: 'dark' | 'light';
}

export const CanteirosManagement: React.FC<CanteirosManagementProps> = ({
  constructionSites,
  employees,
  insalubrityRecords,
  onSaveSite,
  onDeleteSite,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  // Navegação entre abas: 'canteiros' (Frentes Físicas) ou 'setores' (Divisões/Seções)
  const [activeTab, setActiveTab] = useState<'canteiros' | 'setores'>('canteiros');
  const [setoresCount, setSetoresCount] = useState<number>(() => {
    return setorService.getSetoresAtuais().setores.length;
  });

  // Assinatura para atualizar contador de setores
  useEffect(() => {
    const unsub = setorService.subscribeSetores((setores) => {
      setSetoresCount(setores.length);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Real-time backend state
  const [sites, setSites] = useState<ConstructionSite[]>(constructionSites || []);
  const [isLoading, setIsLoading] = useState<boolean>(!constructionSites || constructionSites.length === 0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('TODAS');
  const [selectedStatus, setSelectedStatus] = useState<string>('ATIVO');

  // Modal: Add/Edit Canteiro
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<ConstructionSite | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formSedeCodigo, setFormSedeCodigo] = useState('KO');
  const [formBigramas, setFormBigramas] = useState('');
  const [formChief, setFormChief] = useState('');
  const [formEncarregado, setFormEncarregado] = useState('');
  const [formChiefContact, setFormChiefContact] = useState('');
  const [formManager, setFormManager] = useState('');
  const [formStatus, setFormStatus] = useState<string>('Ativo');
  const [formInsalubrityLevel, setFormInsalubrityLevel] = useState<GrauInsalubridade>('20%');
  const [formStartDate, setFormStartDate] = useState('');
  const [formExpectedEndDate, setFormExpectedEndDate] = useState('');
  const [formUoVinculada, setFormUoVinculada] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Assinatura em tempo real exclusiva da coleção 'canteiros_obras'
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const unsubscribe = canteiroService.subscribeCanteiros(
      (loadedSites) => {
        if (!isMounted) return;
        setSites(loadedSites);
        setIsLoading(false);
      },
      (err) => {
        if (!isMounted) return;
        console.warn('Fallback para getConstructionSites em CanteirosManagement:', err);
        dbService.getConstructionSites()
          .then((cached) => {
            if (isMounted) {
              setSites(cached && cached.length > 0 ? cached : (constructionSites || []));
              setIsLoading(false);
            }
          })
          .catch(() => {
            if (isMounted) {
              setSites(constructionSites || []);
              setIsLoading(false);
            }
          });
      }
    );

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Sincroniza se o pai enviar lista e o estado local estiver vazio
  useEffect(() => {
    if (constructionSites && constructionSites.length > 0 && sites.length === 0 && !isLoading) {
      setSites(constructionSites);
    }
  }, [constructionSites, isLoading, sites.length]);

  // Função auxiliar para verificar status ativo/inativo
  const isSiteActive = (site: ConstructionSite): boolean => {
    const st = String(site.status || 'Ativo').toUpperCase().trim();
    if (st === 'ATIVO' || st === 'ACTIVE' || st === 'EM OPERAÇÃO' || st === 'EM OPERACAO') return true;
    if (st.includes('DESMOBILIZ') || st === 'PLANEJADO' || st === 'PLANNED') return true;
    if (st === 'INATIVO' || st === 'INACTIVE' || st === 'ENCERRADO' || st === 'CONCLUÍDO' || st === 'CONCLUIDO') return false;
    return true;
  };

  // Contadores dinâmicos reais baseados na coleção
  const activeCount = useMemo(() => sites.filter(isSiteActive).length, [sites]);
  const inactiveCount = useMemo(() => sites.filter((s) => !isSiteActive(s)).length, [sites]);

  // Validação em tempo real de unicidade de código do canteiro
  const formCodeTrim = formCode.trim().toUpperCase();
  const isCanteiroCodeInUse = Boolean(
    formCodeTrim &&
      sites.some((s) => {
        const c = (s.codigo || s.code || '').toUpperCase();
        const isSelf = editingSite && (s.id === editingSite.id || (editingSite.codigo && editingSite.codigo.toUpperCase() === c));
        return !isSelf && c === formCodeTrim;
      })
  );

  // Lista dinâmica de sedes presentes nos canteiros cadastrados
  const availableSedes = useMemo(() => {
    const s = new Set<string>();
    sites.forEach((site) => {
      const code = site.sedeCodigo || site.branch || site.sede;
      if (code) s.add(String(code).toUpperCase());
    });
    return Array.from(s).sort();
  }, [sites]);

  // Filtros locais (busca, sede e status)
  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      const siteSede = String(site.sedeCodigo || site.branch || site.sede || '').toUpperCase();
      const siteStatus = String(site.status || 'Ativo').toUpperCase();
      const siteName = (site.nome || site.name || '').toLowerCase();
      const siteCode = (site.codigo || site.code || '').toLowerCase();
      const siteChief = (site.chefe || site.chefeCanteiro || site.chief || '').toLowerCase();
      const siteEncarregado = (site.encarregado || '').toLowerCase();
      const siteManager = (site.gerente || site.manager || '').toLowerCase();
      const siteAddress = (site.endereco || site.address || '').toLowerCase();

      const matchBranch = selectedBranch === 'TODAS' || siteSede === selectedBranch.toUpperCase();
      
      let matchStatus = true;
      if (selectedStatus !== 'TODOS') {
        const normFilter = selectedStatus.toUpperCase();
        if (normFilter === 'ATIVO') {
          matchStatus = isSiteActive(site);
        } else if (normFilter === 'DESMOBILIZACAO') {
          matchStatus = siteStatus.includes('DESMOBILIZ');
        } else if (normFilter === 'PLANEJADO') {
          matchStatus = siteStatus === 'PLANEJADO' || siteStatus === 'PLANNED';
        } else if (normFilter === 'INATIVO') {
          matchStatus = !isSiteActive(site);
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        siteName.includes(q) ||
        siteCode.includes(q) ||
        siteChief.includes(q) ||
        siteEncarregado.includes(q) ||
        siteManager.includes(q) ||
        siteAddress.includes(q);

      return matchBranch && matchStatus && matchQuery;
    });
  }, [sites, selectedBranch, selectedStatus, searchQuery]);

  // Abrir modal de criação
  const handleOpenCreateModal = () => {
    setEditingSite(null);
    setFormName('');
    setFormCode('');
    setFormAddress('');
    setFormSedeCodigo('KO');
    setFormBigramas('');
    setFormChief('');
    setFormEncarregado('');
    setFormChiefContact('');
    setFormManager('');
    setFormStatus('Ativo');
    setFormInsalubrityLevel('20%');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormExpectedEndDate('');
    setFormUoVinculada('');
    setFormNotes('');
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  // Abrir modal de edição
  const handleOpenEditModal = (site: ConstructionSite) => {
    setEditingSite(site);
    setFormName(site.nome || site.name || '');
    setFormCode(site.codigo || site.code || '');
    setFormAddress(site.endereco || site.address || '');
    setFormSedeCodigo(String(site.sedeCodigo || site.branch || site.sede || 'KO').toUpperCase());
    setFormBigramas(site.bigramasImportacao ? site.bigramasImportacao.join(', ') : '');
    setFormChief(site.chefe || site.chefeCanteiro || site.chief || '');
    setFormEncarregado(site.encarregado || '');
    setFormChiefContact(site.chiefContact || site.chefeContato || '');
    setFormManager(site.gerente || site.manager || '');
    setFormStatus(site.status || 'Ativo');
    setFormInsalubrityLevel((site.grauInsalubridade || site.insalubrityLevel || '20%') as GrauInsalubridade);
    setFormStartDate(site.dataInicio || site.startDate || '');
    setFormExpectedEndDate(site.dataPrevisaoFim || site.expectedEndDate || '');
    setFormUoVinculada(site.uoVinculadaCodigo || '');
    setFormNotes(site.observacoes || site.notes || '');
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  // Salvar canteiro no banco de dados e invalidar cache
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Informe o nome do canteiro de obras.' });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    const normCode = formCode.trim().toUpperCase() || (formName.trim().substring(0, 5).toUpperCase());
    const normSede = (formSedeCodigo.trim() || normCode.split('-')[0] || 'KO').toUpperCase();

    // Validação de código único de canteiro em tempo real
    const isCodeConflict = normCode && sites.some((s) => {
      const c = (s.codigo || s.code || '').toUpperCase();
      const isSelf = editingSite && (s.id === editingSite.id || (editingSite.codigo && editingSite.codigo.toUpperCase() === c));
      return !isSelf && c === normCode;
    });

    if (isCodeConflict) {
      setFeedbackMsg({ type: 'error', text: 'Este código já está em uso. Escolha outro.' });
      setIsSubmitting(false);
      return;
    }

    const bigramasArray = formBigramas
      ? formBigramas.split(',').map((b) => b.trim().toUpperCase()).filter(Boolean)
      : [normCode, normSede];

    const sitePayload: any = {
      ...(editingSite ? { id: editingSite.id } : {}),
      codigo: normCode,
      code: normCode,
      nome: formName.trim(),
      name: formName.trim(),
      sedeCodigo: normSede,
      sede: normSede as Branch,
      branch: normSede as Branch,
      uoVinculadaCodigo: formUoVinculada.trim().toUpperCase() || undefined,
      bigramasImportacao: bigramasArray,
      chefe: formChief.trim(),
      chief: formChief.trim(),
      chefeCanteiro: formChief.trim(),
      encarregado: formEncarregado.trim(),
      chiefContact: formChiefContact.trim(),
      chefeContato: formChiefContact.trim(),
      manager: formManager.trim(),
      gerente: formManager.trim(),
      endereco: formAddress.trim(),
      address: formAddress.trim(),
      status: formStatus,
      insalubrityLevel: formInsalubrityLevel,
      grauInsalubridade: formInsalubrityLevel,
      dataInicio: formStartDate,
      startDate: formStartDate,
      dataPrevisaoFim: formExpectedEndDate,
      expectedEndDate: formExpectedEndDate,
      observacoes: formNotes.trim(),
      notes: formNotes.trim(),
    };

    try {
      if (typeof onSaveSite === 'function') {
        await onSaveSite(sitePayload);
      } else {
        await canteiroService.saveCanteiro(sitePayload);
      }

      // Atualizar o estado local imediatamente
      setSites((prev) => {
        const id = sitePayload.id || `canteiro-${normCode.toLowerCase()}`;
        const idx = prev.findIndex((s) => s.id === id || (s.codigo && s.codigo.toUpperCase() === normCode));
        const normalized = { ...sitePayload, id } as ConstructionSite;
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...normalized };
          return updated;
        }
        return [...prev, normalized];
      });

      setFeedbackMsg({ type: 'success', text: 'Canteiro salvo com sucesso na base de dados!' });
      setTimeout(() => {
        setIsModalOpen(false);
      }, 500);
    } catch (err: any) {
      console.error('Erro ao salvar canteiro:', err);
      setFeedbackMsg({ type: 'error', text: 'Erro ao salvar canteiro no Firestore. Verifique sua conexão.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar status operacional (Ativo / Inativo) do Canteiro
  const handleToggleStatus = async (site: ConstructionSite) => {
    const isAtivo = isSiteActive(site);
    const novoStatus = isAtivo ? 'Inativo' : 'Ativo';
    const siteName = site.nome || site.name || site.codigo || 'Canteiro';

    if (isAtivo) {
      const confirmacao = window.confirm(
        `Deseja desativar o canteiro de obras "${siteName}"?\n\nEle deixará de constar na lista padrão de ativos e não receberá novos lançamentos, mantendo todo o histórico contábil preservado.`
      );
      if (!confirmacao) return;
    }

    try {
      await canteiroService.alternarStatusCanteiro(site.id, novoStatus);

      // Atualizar o estado local imediatamente
      setSites((prev) =>
        prev.map((s) => (s.id === site.id ? { ...s, status: novoStatus } : s))
      );

      setFeedbackMsg({
        type: 'success',
        text: `Canteiro "${siteName}" ${isAtivo ? 'desativado' : 'ativado'} com sucesso!`,
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      console.error('Erro ao alternar status do canteiro:', err);
      alert('Erro ao alterar status do canteiro. Verifique sua conexão e permissões.');
    }
  };

  // Excluir canteiro do banco de dados com verificação de dependências de colaboradores
  const handleDelete = async (site: ConstructionSite) => {
    const siteName = site.nome || site.name || site.codigo || 'Canteiro';
    const dep = canteiroService.verificarDependenciasCanteiro(site, employees);

    if (dep.temColaboradores) {
      alert(
        `Ação não permitida!\n\nO canteiro "${siteName}" possui ${dep.totalColaboradores} colaborador(es) associado(s).\n\nExemplos: ${dep.colaboradoresExemplo.join(', ')}\n\nNão é permitido excluir fisicamente canteiros com histórico de colaboradores vinculados. Por favor, utilize a opção "Desativar" para arquivá-lo com segurança.`
      );
      return;
    }

    if (!window.confirm(`Deseja realmente excluir permanentemente o canteiro de obras "${siteName}"? Esta ação não pode ser desfeita.`)) return;
    try {
      if (typeof onDeleteSite === 'function') {
        await onDeleteSite(site.id);
      } else {
        await canteiroService.deleteCanteiro(site.id, employees);
      }

      // Atualizar estado local imediatamente
      setSites((prev) => prev.filter((s) => s.id !== site.id));
    } catch (err: any) {
      console.error('Erro ao excluir canteiro:', err);
      alert(err?.message || 'Erro ao excluir canteiro. Verifique as permissões de acesso.');
    }
  };

  // Exportar dados em CSV com todos os campos canônicos
  const handleExportCSV = () => {
    if (sites.length === 0) {
      alert('Não há canteiros para exportar.');
      return;
    }

    const headers = [
      'Código',
      'Nome do Canteiro',
      'Sede Territorial',
      'UO Referência',
      'Chefe',
      'Encarregado',
      'Gerente/Fiscal',
      'Contato',
      'Endereço',
      'Insalubridade',
      'Data Início',
      'Previsão Fim',
      'Status',
      'Observações'
    ];

    const rows = sites.map((site) => [
      `"${site.codigo || site.code || ''}"`,
      `"${(site.nome || site.name || '').replace(/"/g, '""')}"`,
      `"${site.sedeCodigo || site.branch || site.sede || ''}"`,
      `"${site.uoVinculadaCodigo || ''}"`,
      `"${(site.chefe || site.chefeCanteiro || site.chief || '').replace(/"/g, '""')}"`,
      `"${(site.encarregado || '').replace(/"/g, '""')}"`,
      `"${(site.gerente || site.manager || '').replace(/"/g, '""')}"`,
      `"${(site.chiefContact || site.chefeContato || '').replace(/"/g, '""')}"`,
      `"${(site.endereco || site.address || '').replace(/"/g, '""')}"`,
      `"${site.grauInsalubridade || site.insalubrityLevel || ''}"`,
      `"${site.dataInicio || site.startDate || ''}"`,
      `"${site.dataPrevisaoFim || site.expectedEndDate || ''}"`,
      `"${site.status || 'Ativo'}"`,
      `"${(site.observacoes || site.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `canteiros_obras_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Renderizador de Badge de Status
  const renderStatusBadge = (status?: string) => {
    const s = String(status || 'Ativo').toUpperCase();
    if (s === 'ATIVO' || s === 'ACTIVE' || s === 'EM OPERAÇÃO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Ativo
        </span>
      );
    }
    if (s.includes('DESMOBILIZ')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Em Desmobilização
        </span>
      );
    }
    if (s === 'PLANEJADO' || s === 'PLANNED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          Planejado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">
        Inativo
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* CABEÇALHO DA TELA & CONTADORES REAIS                          */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-gray-200'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5">
                  <span>Canteiros de Obras</span>
                  <InfoTooltip
                    theme={isDark ? 'dark' : 'light'}
                    content="Canteiros de obras são as frentes físicas e territoriais de serviço da COMARA onde ocorrem as operações de engenharia. Cadastre, acompanhe responsáveis e edite as informações das frentes operacionais diretamente nesta tela."
                  />
                </h2>

                <div className="flex items-center gap-1.5 ml-1">
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                    isDark ? 'bg-[#1B2D4A] text-blue-300 border-[#2E4566]' : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {sites.length} {sites.length === 1 ? 'canteiro cadastrado' : 'canteiros cadastrados'}
                  </span>
                  {sites.length > 0 && (
                    <>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                        isDark ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {activeCount} {activeCount === 1 ? 'ativo' : 'ativos'}
                      </span>
                      {inactiveCount > 0 && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                          isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}>
                          {inactiveCount} {inactiveCount === 1 ? 'inativo' : 'inativos'}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Frentes físicas e destacamentos operacionais COMARA integrados à coleção <code className="text-amber-400 font-mono">canteiros_obras</code>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors active:scale-[0.98] cursor-pointer flex items-center gap-1.5 ${
              isDark ? 'bg-[#16243D] border-[#335075] hover:bg-[#243756] text-gray-300' : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-700'
            }`}
            title="Exportar dados de canteiros em formato CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-md flex items-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Canteiro</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SELETOR DE ABAS: CANTEIROS DE OBRAS vs GESTÃO DE SETORES      */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-1.5 rounded-2xl border flex flex-wrap items-center gap-2 w-full sm:w-fit ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <button
          type="button"
          onClick={() => setActiveTab('canteiros')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'canteiros'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
              : isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-[#1B2D4A]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Canteiros de Obras</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'canteiros'
              ? 'bg-amber-700/80 text-white'
              : isDark ? 'bg-[#243756] text-slate-300' : 'bg-slate-200 text-slate-700'
          }`}>
            {sites.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('setores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'setores'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
              : isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-[#1B2D4A]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Gestão de Setores (UOs)</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            activeTab === 'setores'
              ? 'bg-blue-700/80 text-white'
              : isDark ? 'bg-[#243756] text-slate-300' : 'bg-slate-200 text-slate-700'
          }`}>
            {setoresCount}
          </span>
        </button>
      </div>

      {activeTab === 'setores' ? (
        <SetoresManagementTab employees={employees} theme={theme} />
      ) : (
        <>

      {/* ------------------------------------------------------------- */}
      {/* FILTROS RÁPIDOS (BUSCA, SEDE, STATUS)                         */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-3 sm:p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-3 ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-gray-200 shadow-xs'
      }`}>
        <div className="relative w-full md:w-80">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, código, encarregado ou endereço..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition-colors ${
              isDark ? 'bg-[#0F1B33] border-[#2E4566] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold outline-none ${
              isDark ? 'bg-[#0F1B33] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
            }`}
          >
            <option value="TODAS">Todas as Sedes</option>
            {availableSedes.map((sede) => (
              <option key={sede} value={sede}>Sede {sede}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold outline-none ${
              isDark ? 'bg-[#0F1B33] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
            }`}
          >
            <option value="ATIVO">Apenas Ativos (Padrão)</option>
            <option value="TODOS">Todos os Canteiros</option>
            <option value="INATIVO">Apenas Inativos</option>
            <option value="DESMOBILIZACAO">Em Desmobilização</option>
            <option value="PLANEJADO">Planejados</option>
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TABELA OPERACIONAL / INDICADOR DE CARREGAMENTO / ESTADO VAZIO */}
      {/* ------------------------------------------------------------- */}
      {isLoading ? (
        <div className={`p-12 text-center rounded-2xl border space-y-3 ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-gray-200 shadow-xs'
        }`}>
          <div className="w-8 h-8 mx-auto border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Carregando canteiros de obras cadastrados...
          </p>
        </div>
      ) : sites.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border space-y-3 ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-gray-200 shadow-xs'
        }`}>
          <Building2 className="w-12 h-12 mx-auto text-gray-400 opacity-50" />
          <p className={`text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
            Nenhum canteiro cadastrado. Utilize o cadastro para adicionar uma frente de serviço.
          </p>
          <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Canteiros físicos representam destacamentos e frentes territoriais como Coari, Belém, Manaus ou Fonte Boa.
          </p>
          <div className="pt-2">
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-md inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Canteiro</span>
            </button>
          </div>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-x-auto shadow-inner ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-gray-200'
        }`}>
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className={`text-xs uppercase font-mono font-bold border-b ${
                isDark ? 'bg-[#0F1B33] text-[#94A3B8] border-[#243756]' : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}>
                <th className="py-3.5 px-4 min-w-[270px]">CANTEIRO / SEDE / UO</th>
                <th className="py-3.5 px-4 min-w-[210px]">CHEFIA & ENCARREGADO</th>
                <th className="py-3.5 px-4 min-w-[180px]">GERENTE / FISCAL</th>
                <th className="py-3.5 px-4 min-w-[200px]">ENDEREÇO / LOCALIZAÇÃO</th>
                <th className="py-3.5 px-4 min-w-[130px] text-center">PERÍODO</th>
                <th className="py-3.5 px-4 min-w-[120px] text-center">STATUS</th>
                <th className="py-3.5 px-4 min-w-[140px] text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className={`text-xs divide-y ${
              isDark ? 'divide-[#243756] text-[#E2E8F0]' : 'divide-gray-200 text-gray-800'
            }`}>
              {filteredSites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-mono">
                    <Building2 className="w-8 h-8 mx-auto text-gray-500 opacity-40 mb-2" />
                    Nenhum canteiro de obras encontrado para os filtros informados.
                  </td>
                </tr>
              ) : (
                filteredSites.map((site) => {
                  const siteName = site.nome || site.name || 'Canteiro sem nome';
                  const siteCode = site.codigo || site.code || 'CT-01';
                  const siteBranch = site.sedeCodigo || site.branch || site.sede || 'KO';
                  const siteChief = site.chefe || site.chefeCanteiro || site.chief || '';
                  const siteEncarregado = site.encarregado || '';
                  const siteChiefContact = site.chiefContact || site.chefeContato || '';
                  const siteManager = site.gerente || site.manager || '';
                  const siteAddress = site.endereco || site.address || '';
                  const siteInsalubrity = site.grauInsalubridade || site.insalubrityLevel;
                  const siteStartDate = site.dataInicio || site.startDate;
                  const siteEndDate = site.dataPrevisaoFim || site.expectedEndDate;

                  return (
                    <tr
                      key={site.id}
                      className={`transition-colors ${isDark ? 'hover:bg-[#1E3252]' : 'hover:bg-amber-50/30'}`}
                    >
                      {/* 1. Nome do Canteiro / Sede / UO Referência */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded font-mono font-black text-[10px] border ${
                              isDark ? 'bg-amber-950/70 text-amber-300 border-amber-800/60' : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {siteCode}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isDark ? 'bg-[#0F1B33] border-[#335075] text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
                            }`}>
                              Sede {siteBranch}
                            </span>
                            {site.uoVinculadaCodigo && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20" title="UO de referência">
                                UO: {site.uoVinculadaCodigo}
                              </span>
                            )}
                            {siteInsalubrity && siteInsalubrity !== 'ISENTO' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                NR-15 ({siteInsalubrity})
                              </span>
                            )}
                          </div>
                          <div className={`font-bold text-sm leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {siteName}
                          </div>
                          {(site.observacoes || site.notes) && (
                            <div className={`text-[11px] italic line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              "{site.observacoes || site.notes}"
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2. Chefia & Encarregado */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {siteChief ? (
                            <div className="font-bold flex items-center gap-1.5">
                              <HardHat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{siteChief}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 italic block text-[11px]">Chefe não informado</span>
                          )}

                          {siteEncarregado && (
                            <div className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              <span className="text-gray-500">Encarregado:</span>
                              <span className="font-semibold">{siteEncarregado}</span>
                            </div>
                          )}

                          {siteChiefContact && (
                            <div className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              <Phone className="w-3 h-3 text-blue-400 shrink-0" />
                              <span>{siteChiefContact}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Gerente / Fiscal */}
                      <td className="py-3.5 px-4">
                        {siteManager ? (
                          <div className="font-semibold flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{siteManager}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">Não informado</span>
                        )}
                      </td>

                      {/* 4. Endereço / Localização */}
                      <td className="py-3.5 px-4">
                        {siteAddress ? (
                          <div className={`flex items-start gap-1.5 text-xs max-w-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{siteAddress}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">Sem endereço cadastrado</span>
                        )}
                      </td>

                      {/* 5. Período (Início / Fim) */}
                      <td className="py-3.5 px-4 text-center">
                        {siteStartDate || siteEndDate ? (
                          <div className="text-[11px] space-y-0.5">
                            {siteStartDate && (
                              <div className="flex items-center justify-center gap-1 text-gray-400">
                                <Calendar className="w-3 h-3 text-emerald-400" />
                                <span>{siteStartDate}</span>
                              </div>
                            )}
                            {siteEndDate && (
                              <div className="text-[10px] text-gray-500">
                                Até: {siteEndDate}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* 6. Status */}
                      <td className="py-3.5 px-4 text-center">
                        {renderStatusBadge(site.status)}
                      </td>

                      {/* 7. Ações (Editar, Desativar/Ativar e Excluir Seguro) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(site)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1 ${
                              isDark 
                                ? 'bg-[#1E3252] border-[#335075] hover:bg-[#2E4566] text-blue-400' 
                                : 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700'
                            }`}
                            title="Editar dados do Canteiro"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          {/* Toggle Desativar / Ativar */}
                          {isSiteActive(site) ? (
                            <button
                              onClick={() => handleToggleStatus(site)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1 ${
                                isDark 
                                  ? 'bg-[#2B2317] border-[#4A3B24] hover:bg-[#3D2F1D] text-amber-400' 
                                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-700'
                              }`}
                              title="Desativar canteiro (preserva dados contábeis e bloqueia novos lançamentos)"
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>Desativar</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(site)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1 ${
                                isDark 
                                  ? 'bg-[#162B23] border-[#254A3B] hover:bg-[#1E3A2F] text-emerald-400' 
                                  : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700'
                              }`}
                              title="Reativar canteiro operacional"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Ativar</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(site)}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition-all active:scale-[0.98] cursor-pointer flex items-center ${
                              isDark 
                                ? 'bg-[#1E2433] border-[#2B354A] hover:bg-[#2B1C1F] hover:border-[#402A30] text-gray-400 hover:text-red-400' 
                                : 'bg-gray-50 border-gray-200 hover:bg-red-50 hover:border-red-200 text-gray-500 hover:text-red-700'
                            }`}
                            title="Excluir canteiro permanentemente (somente permitido se não houver colaboradores associados)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CRIAR / EDITAR CANTEIRO                                */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-xl p-6 rounded-3xl border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-[#14171F] border-[#2E4566] text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-[#2E4566]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingSite ? 'Editar Canteiro de Obras' : 'Cadastrar Novo Canteiro'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Preencha as informações da frente física operacional da COMARA.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {feedbackMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedbackMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Código do Canteiro *</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Ex: KO-01, BE-02, MN-01"
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border outline-none ${
                      isCanteiroCodeInUse
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : isDark ? 'bg-[#0B1426] border-[#2E4566] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                    }`}
                  />
                  {isCanteiroCodeInUse && (
                    <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Este código já está em uso. Escolha outro.</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Sede Territorial (sedeCodigo) *</label>
                  <input
                    type="text"
                    value={formSedeCodigo}
                    onChange={(e) => setFormSedeCodigo(e.target.value.toUpperCase())}
                    placeholder="Ex: KO, BE, MN, FB, SP"
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase">Nome do Canteiro / Frente de Serviço *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Destacamento de Engenharia de Coari"
                  required
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'bg-[#0B1426] border-[#2E4566] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Chefe do Canteiro</label>
                  <input
                    type="text"
                    value={formChief}
                    onChange={(e) => setFormChief(e.target.value)}
                    placeholder="Ex: Cap QOENG Fulano"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Encarregado da Frente</label>
                  <input
                    type="text"
                    value={formEncarregado}
                    onChange={(e) => setFormEncarregado(e.target.value)}
                    placeholder="Ex: 1º Sgt Silva"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Contato (Telefone / Rádio)</label>
                  <input
                    type="text"
                    value={formChiefContact}
                    onChange={(e) => setFormChiefContact(e.target.value)}
                    placeholder="Ex: (97) 98123-4567 / Rádio Ch-04"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Gerente de Obra / Fiscal</label>
                  <input
                    type="text"
                    value={formManager}
                    onChange={(e) => setFormManager(e.target.value)}
                    placeholder="Ex: Cap Eng Oliveira"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Status Operacional</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border font-medium outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="Ativo">Ativo (Em Operação)</option>
                    <option value="Em Desmobilização">Em Desmobilização</option>
                    <option value="Planejado">Planejado (Em Mobilização)</option>
                    <option value="Inativo">Inativo / Concluído</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Grau Insalubridade</label>
                  <select
                    value={formInsalubrityLevel}
                    onChange={(e) => setFormInsalubrityLevel(e.target.value as GrauInsalubridade)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border font-bold outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-amber-400' : 'bg-gray-50 border-gray-300 text-amber-600'
                    }`}
                  >
                    <option value="ISENTO">Isento (0%)</option>
                    <option value="10%">Mínimo (10%)</option>
                    <option value="20%">Médio (20%)</option>
                    <option value="40%">Máximo (40%)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase">Endereço / Localização</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Ex: Estrada do Aeroporto, s/n - Coari/AM"
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Data Início</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase">Previsão Fim</label>
                  <input
                    type="date"
                    value={formExpectedEndDate}
                    onChange={(e) => setFormExpectedEndDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              {/* UO de Referência (somente referência de vínculo, não edita UOs) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>UO Vinculada de Referência</span>
                  <span className={`text-[10px] font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formUoVinculada}
                  onChange={(e) => setFormUoVinculada(e.target.value.toUpperCase())}
                  placeholder="Ex: DECO_KO, DACO_MN, SEDE_BE"
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                    isDark ? 'bg-[#0B1426] border-[#2E4566] text-purple-300' : 'bg-gray-50 border-gray-300 text-purple-700'
                  }`}
                />
                <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Exibe o vínculo de referência com a Unidade Organizacional (a gestão estrutural de UOs e setores permanece na tela de Configuração de UOs).
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase flex items-center gap-2">
                  <span>Bigramas para Importação</span>
                  <span className={`text-[10px] font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formBigramas}
                  onChange={(e) => setFormBigramas(e.target.value.toUpperCase())}
                  placeholder="Ex: KO, DECO-KO, DACO-KO (separados por vírgula)"
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                    isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase">Observações Operacionais</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Informações adicionais sobre escopo, pavimentação, canteiro avançado..."
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'bg-[#0B1426] border-[#2E4566] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-[#2E4566]' : 'border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isCanteiroCodeInUse}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 cursor-pointer shadow-md disabled:opacity-50 transition-all active:scale-[0.98] flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Salvando no Firestore...' : 'Salvar Canteiro'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
      </>
      )}

    </div>
  );
};
