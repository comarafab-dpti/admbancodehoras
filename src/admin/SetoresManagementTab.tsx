import React, { useState, useMemo, useEffect } from 'react';
import { UnidadeOrganizacional, Employee, TipoUnidadeOrganizacional } from '@/src/shared/types';
import { setorService, DependenciasUO } from '@/src/shared/services/setorService';
import { SetorFormModal } from './SetorFormModal';
import { Button } from '@/src/shared/components/ui/Button';
import { 
  Layers, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Building, 
  Users, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Power,
  Info,
  CornerDownRight,
  Warehouse,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface SetoresManagementTabProps {
  employees?: Employee[];
  theme?: 'dark' | 'light';
}

export const SetoresManagementTab: React.FC<SetoresManagementTabProps> = ({
  employees = [],
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';

  // Estados de dados principais
  const [setores, setSetores] = useState<UnidadeOrganizacional[]>([]);
  const [todasUOs, setTodasUOs] = useState<UnidadeOrganizacional[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('TODOS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');

  // Estado de nós expandidos na árvore
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Modais de criação/edição e deleção
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUo, setEditingUo] = useState<UnidadeOrganizacional | null>(null);
  const [modalInitialTipo, setModalInitialTipo] = useState<TipoUnidadeOrganizacional>('SETOR');
  const [modalInitialPai, setModalInitialPai] = useState<string | undefined>(undefined);

  // Modal de exclusão e dependências (Gap 4)
  const [uoToDelete, setUoToDelete] = useState<UnidadeOrganizacional | null>(null);
  const [dependenciasUoToDelete, setDependenciasUoToDelete] = useState<DependenciasUO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tooltip explicativo no cabeçalho (Gap 2)
  const [showConceptsTooltip, setShowConceptsTooltip] = useState(false);

  // Carrega e assina atualizações em tempo real
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = setorService.subscribeSetores(
      (novosSetores, uos) => {
        setSetores(novosSetores);
        setTodasUOs(uos);
        setIsLoading(false);

        // Expande nós de nível 2 por padrão na primeira carga
        setExpandedNodes((prev) => {
          if (prev.size > 0) return prev;
          const initial = new Set<string>();
          uos.forEach((u) => {
            if (u.tipo === 'SEDE' || u.tipo === 'DACO' || u.tipo === 'DECO') {
              initial.add(u.codigo);
            }
          });
          return initial;
        });
      },
      (err) => {
        console.warn('Erro na assinatura de setores:', err);
        const { setores: st, todasUOs: tu } = setorService.getSetoresAtuais();
        setSetores(st);
        setTodasUOs(tu);
        setIsLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Lista de UOs principais elegíveis como pais
  const uosPrincipais = useMemo(() => {
    return todasUOs.filter(
      (u) => (u.tipo === 'SEDE' || u.tipo === 'DACO' || u.tipo === 'DECO') && u.codigo !== 'NAO_CLASSIFICADO'
    );
  }, [todasUOs]);

  // Mapa rápido de todas as UOs por código
  const uosMap = useMemo(() => {
    const map = new Map<string, UnidadeOrganizacional>();
    todasUOs.forEach((u) => map.set(u.codigo.toUpperCase(), u));
    return map;
  }, [todasUOs]);

  // Contagem de colaboradores alocados por UO
  const employeeCountByUo = useMemo(() => {
    return setorService.contarColaboradoresPorSetor(employees);
  }, [employees]);

  // Estrutura hierárquica da árvore (Nível 1 = COMARA, Nível 2 = SEDE/DACO/DECO, Nível 3 = SETOR)
  const { nivel2Uos, setoresPorPai, setoresOrfaos } = useMemo(() => {
    const n2: UnidadeOrganizacional[] = [];
    const porPai = new Map<string, UnidadeOrganizacional[]>();
    const orfaos: UnidadeOrganizacional[] = [];

    // Classifica UOs
    todasUOs.forEach((uo) => {
      if (uo.codigo === 'NAO_CLASSIFICADO') return;

      if (uo.tipo === 'SEDE' || uo.tipo === 'DACO' || uo.tipo === 'DECO') {
        n2.push(uo);
      } else if (uo.tipo === 'SETOR') {
        const paiKey = (uo.pai || '').trim().toUpperCase();
        if (paiKey && paiKey !== 'COMARA') {
          const list = porPai.get(paiKey) || [];
          list.push(uo);
          porPai.set(paiKey, list);
        } else {
          orfaos.push(uo);
        }
      }
    });

    // Ordenação consistente: SEDEs primeiro, depois DACOs, depois DECOs
    const tipoOrdem: Record<string, number> = { SEDE: 1, DACO: 2, DECO: 3 };
    n2.sort((a, b) => {
      const pA = tipoOrdem[a.tipo] || 99;
      const pB = tipoOrdem[b.tipo] || 99;
      if (pA !== pB) return pA - pB;
      return a.siglaExibicao.localeCompare(b.siglaExibicao);
    });

    // Ordena setores internamente por sigla
    porPai.forEach((list) => {
      list.sort((a, b) => a.siglaExibicao.localeCompare(b.siglaExibicao));
    });

    return { nivel2Uos: n2, setoresPorPai: porPai, setoresOrfaos: orfaos };
  }, [todasUOs]);

  // Auto-expansão de nós pais quando uma busca é realizada (Gap 2)
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;

    const paisParaExpandir = new Set<string>();
    todasUOs.forEach((uo) => {
      const match =
        (uo.nome || '').toLowerCase().includes(q) ||
        (uo.siglaExibicao || '').toLowerCase().includes(q) ||
        (uo.codigo || '').toLowerCase().includes(q);

      if (match) {
        if (uo.tipo === 'SETOR' && uo.pai) {
          paisParaExpandir.add(uo.pai.toUpperCase());
        } else if (uo.tipo === 'SEDE' || uo.tipo === 'DACO' || uo.tipo === 'DECO') {
          paisParaExpandir.add(uo.codigo.toUpperCase());
        }
      }
    });

    if (paisParaExpandir.size > 0) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        paisParaExpandir.forEach((p) => next.add(p));
        return next;
      });
    }
  }, [searchQuery, todasUOs]);

  // Função auxiliar para verificar se um nó atende aos filtros atuais
  const isUoMatch = (uo: UnidadeOrganizacional): boolean => {
    // 1. Filtro por Tipo
    if (selectedTipo !== 'TODOS' && uo.tipo !== selectedTipo) {
      return false;
    }

    // 2. Filtro por Status
    if (selectedStatus === 'ATIVO' && !uo.ativa) return false;
    if (selectedStatus === 'INATIVO' && uo.ativa) return false;

    // 3. Busca textual
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const matchNome = (uo.nome || '').toLowerCase().includes(q);
    const matchSigla = (uo.siglaExibicao || '').toLowerCase().includes(q);
    const matchCodigo = (uo.codigo || '').toLowerCase().includes(q);
    const matchDesc = (uo.descricao || '').toLowerCase().includes(q);

    return matchNome || matchSigla || matchCodigo || matchDesc;
  };

  // Contadores globais
  const totalUos = todasUOs.filter((u) => u.codigo !== 'NAO_CLASSIFICADO').length;
  const totalSetores = setores.length;
  const totalNivel2 = nivel2Uos.length;
  const totalAtivas = todasUOs.filter((u) => u.ativa && u.codigo !== 'NAO_CLASSIFICADO').length;
  const totalInativas = totalUos - totalAtivas;

  // Alternar nó expandido/recolhido
  const toggleNode = (codigo: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) {
        next.delete(codigo);
      } else {
        next.add(codigo);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    nivel2Uos.forEach((u) => all.add(u.codigo));
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Ações de criação e edição
  const handleOpenCreateUO = () => {
    setEditingUo(null);
    setModalInitialTipo('SETOR');
    setModalInitialPai(undefined);
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenAddSetorFilho = (parentUo: UnidadeOrganizacional) => {
    setEditingUo(null);
    setModalInitialTipo('SETOR');
    setModalInitialPai(parentUo.codigo);
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditUO = (uo: UnidadeOrganizacional) => {
    setEditingUo(uo);
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const handleSaveUO = async (uoAtualizada: UnidadeOrganizacional, codigoOriginal?: string) => {
    try {
      await setorService.salvarSetor(uoAtualizada, codigoOriginal);
      setFeedbackMsg({
        type: 'success',
        text: `Unidade "${uoAtualizada.siglaExibicao}" salva com sucesso.`
      });
      const { setores: novos, todasUOs: tu } = setorService.getSetoresAtuais();
      setSetores(novos);
      setTodasUOs(tu);
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar UO:', err);
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Erro ao salvar a Unidade Organizacional.'
      });
      throw err;
    }
  };

  const handleToggleStatus = async (uo: UnidadeOrganizacional, novoStatus?: boolean) => {
    try {
      const statusFinal = typeof novoStatus === 'boolean' ? novoStatus : !uo.ativa;
      await setorService.alternarStatusSetor(uo.codigo, statusFinal);
      setFeedbackMsg({
        type: 'success',
        text: `Unidade "${uo.siglaExibicao}" alterada para ${statusFinal ? 'ATIVA' : 'INATIVA'}.`
      });
      const { setores: novos, todasUOs: tu } = setorService.getSetoresAtuais();
      setSetores(novos);
      setTodasUOs(tu);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      console.error('Erro ao alternar status:', err);
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Erro ao alterar status da unidade.'
      });
    }
  };

  // Gap 4: Preparar exclusão com verificação de dependências
  const handleOpenDelete = (uo: UnidadeOrganizacional) => {
    const dep = setorService.verificarDependenciasUO(uo.codigo, employees, todasUOs);
    setUoToDelete(uo);
    setDependenciasUoToDelete(dep);
  };

  const handleConfirmDelete = async () => {
    if (!uoToDelete) return;
    setIsDeleting(true);
    try {
      await setorService.excluirSetor(uoToDelete.codigo, employees, todasUOs);
      setFeedbackMsg({
        type: 'success',
        text: `Unidade "${uoToDelete.siglaExibicao}" removida com sucesso.`
      });
      const { setores: novos, todasUOs: tu } = setorService.getSetoresAtuais();
      setSetores(novos);
      setTodasUOs(tu);
      setUoToDelete(null);
      setDependenciasUoToDelete(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      console.error('Erro ao excluir UO:', err);
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Não foi possível excluir a Unidade Organizacional.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Exportar dados da hierarquia em CSV
  const handleExportCSV = () => {
    const headers = [
      'Nível',
      'Tipo UO',
      'Código',
      'Sigla',
      'Nome da Unidade',
      'UO Pai (Código)',
      'Sede Padrão',
      'Status',
      'Colaboradores Associados',
      'Descrição'
    ];

    const rows: string[][] = [];

    nivel2Uos.forEach((p) => {
      const countP = employeeCountByUo[p.codigo] || employeeCountByUo[p.siglaExibicao] || 0;
      rows.push([
        'Nível 2',
        p.tipo,
        `"${p.codigo}"`,
        `"${p.siglaExibicao}"`,
        `"${(p.nome || '').replace(/"/g, '""')}"`,
        `"COMARA"`,
        `"${p.sedeOuCanteiroPadrao || ''}"`,
        `"${p.ativa ? 'Ativa' : 'Inativa'}"`,
        `"${countP}"`,
        `"${(p.descricao || '').replace(/"/g, '""')}"`
      ]);

      const filhos = setoresPorPai.get(p.codigo.toUpperCase()) || [];
      filhos.forEach((s) => {
        const countS = employeeCountByUo[s.codigo] || employeeCountByUo[s.siglaExibicao] || 0;
        rows.push([
          'Nível 3 (Setor)',
          s.tipo,
          `"${s.codigo}"`,
          `"${s.siglaExibicao}"`,
          `"${(s.nome || '').replace(/"/g, '""')}"`,
          `"${p.codigo}"`,
          `"${s.sedeOuCanteiroPadrao || ''}"`,
          `"${s.ativa ? 'Ativa' : 'Inativa'}"`,
          `"${countS}"`,
          `"${(s.descricao || '').replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `arvore_uos_comara_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Renderização de Badge de Tipo com cores institucionais consistentes
  const renderTipoBadge = (tipo: TipoUnidadeOrganizacional) => {
    switch (tipo) {
      case 'SEDE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            SEDE
          </span>
        );
      case 'DACO':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            DACO
          </span>
        );
      case 'DECO':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            DECO
          </span>
        );
      case 'SETOR':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            SETOR
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner de Feedback */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-xl border text-sm flex items-center justify-between transition-all animate-fadeIn ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button 
            onClick={() => setFeedbackMsg(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dispensar
          </button>
        </div>
      )}

      {/* Cabeçalho com Ícone ⓘ e Tooltip Explicativo (Gap 2) */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 mt-0.5">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold">
                Estrutura Organizacional e Setores (Árvore de UOs)
              </h2>
              {/* Botão com Tooltip ⓘ dos Conceitos */}
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setShowConceptsTooltip(!showConceptsTooltip)}
                  onMouseEnter={() => setShowConceptsTooltip(true)}
                  onMouseLeave={() => setShowConceptsTooltip(false)}
                  className="p-1 rounded-full text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                  title="Conceitos de UOs da COMARA"
                  aria-label="Conceitos de UOs"
                >
                  <Info className="w-4 h-4" />
                </button>
                {showConceptsTooltip && (
                  <div className={`absolute z-30 left-0 sm:left-auto top-full mt-2 w-72 sm:w-80 p-3 rounded-xl border shadow-xl text-xs space-y-2 pointer-events-none animate-fadeIn ${
                    isDark ? 'bg-[#0E1A2E] border-[#243756] text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-md'
                  }`}>
                    <div className="font-bold text-blue-400 border-b pb-1 border-slate-700/50">
                      Conceitos Organizacionais da COMARA
                    </div>
                    <ul className="space-y-1.5 text-[11px] leading-relaxed">
                      <li>
                        <strong className="text-amber-400">DECO:</strong> canteiro de obras (Destacamento de Engenharia).
                      </li>
                      <li>
                        <strong className="text-cyan-400">DACO:</strong> destacamento de apoio operacional.
                      </li>
                      <li>
                        <strong className="text-indigo-400">SEDE:</strong> sede administrativa central (Belém).
                      </li>
                      <li>
                        <strong className="text-emerald-400">SETOR:</strong> subdivisão interna subordinada a uma UO pai.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Hierarquia oficial de unidades e divisões vinculadas para lançamento e lotação contábil
            </p>
          </div>
        </div>

        {/* Ações globais */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            title="Expandir todos os nós da árvore"
            icon={<Maximize2 className="w-3.5 h-3.5" />}
          >
            Expandir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
            title="Recolher nós da árvore"
            icon={<Minimize2 className="w-3.5 h-3.5" />}
          >
            Recolher
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Exportar CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateUO}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Nova UO
          </Button>
        </div>
      </div>

      {/* Cartões de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total de UOs</div>
          <div className="text-2xl font-black mt-1 flex items-baseline gap-2">
            <span>{totalUos}</span>
            <span className="text-[11px] font-normal text-slate-400">({totalAtivas} ativas)</span>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">SEDEs e Destacamentos</div>
          <div className="text-2xl font-black text-indigo-400 mt-1 flex items-baseline gap-2">
            <span>{totalNivel2}</span>
            <span className="text-[11px] font-normal text-slate-400">nível 2</span>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Setores Vinculados</div>
          <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-2">
            <span>{totalSetores}</span>
            <span className="text-[11px] font-normal text-slate-400">nível 3</span>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">UOs Inativas</div>
          <div className="text-2xl font-black text-amber-400 mt-1 flex items-baseline gap-2">
            <span>{totalInativas}</span>
            <span className="text-[11px] font-normal text-slate-400">arquivadas</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Busca textual */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nós na árvore (código, sigla ou nome)..."
              className={`w-full pl-9 pr-3.5 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                isDark ? 'bg-[#0E1A2E] border-[#243756] text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Filtro por Tipo de UO */}
          <div className="sm:w-44">
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                isDark ? 'bg-[#0E1A2E] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="SEDE">Apenas SEDE</option>
              <option value="DACO">Apenas DACO</option>
              <option value="DECO">Apenas DECO</option>
              <option value="SETOR">Apenas SETORES</option>
            </select>
          </div>

          {/* Filtro Status */}
          <div className="sm:w-36">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                isDark ? 'bg-[#0E1A2E] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ATIVO">Apenas Ativas</option>
              <option value="INATIVO">Apenas Inativas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Árvore Hierárquica Colapsável (Gap 2) */}
      <div className={`rounded-2xl border overflow-hidden p-4 sm:p-6 space-y-4 ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm">Construindo árvore de unidades organizacionais...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Nível 1: Raiz COMARA */}
            <div className={`p-4 rounded-xl border transition-all ${
              isDark ? 'bg-[#0E1A2E] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm sm:text-base text-blue-400">COMARA</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        NÍVEL 1 • RAIZ INSTITUCIONAL
                      </span>
                    </div>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Comissão de Aeroportos da Região Amazônica • Organização Militar
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-slate-400">
                  <span>{nivel2Uos.length} unidades de Nível 2 vinculadas</span>
                </div>
              </div>
            </div>

            {/* Nível 2 e Nível 3: SEDE, DACO, DECO e seus SETORES */}
            <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-dashed border-slate-700/50 sm:ml-4">
              {nivel2Uos.map((uoPai) => {
                const isExpanded = expandedNodes.has(uoPai.codigo);
                const setoresFilhos = setoresPorPai.get(uoPai.codigo.toUpperCase()) || [];
                const empCountPai = employeeCountByUo[uoPai.codigo] || employeeCountByUo[uoPai.siglaExibicao] || 0;

                // Avalia visibilidade com base nos filtros
                const paiVisivel = isUoMatch(uoPai);
                const filhosFiltrados = setoresFilhos.filter((s) => isUoMatch(s));
                const temFilhosVisiveis = filhosFiltrados.length > 0;

                // Se o pai não atende e nenhum filho atende, oculta este ramo
                if (!paiVisivel && !temFilhosVisiveis) {
                  return null;
                }

                return (
                  <div key={uoPai.codigo} className="space-y-2">
                    {/* Linha do Nó Pai (Nível 2) */}
                    <div
                      className={`group p-3 sm:p-3.5 rounded-xl border transition-all ${
                        isDark 
                          ? 'bg-[#0E1A2E]/80 border-[#243756] hover:border-blue-500/50' 
                          : 'bg-slate-50/90 border-slate-200 hover:border-blue-300 shadow-2xs'
                      } ${!uoPai.ativa ? 'opacity-60' : ''}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Identificação e Toggle */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {/* Botão de Expandir / Recolher */}
                          <button
                            type="button"
                            onClick={() => toggleNode(uoPai.codigo)}
                            className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                              isDark 
                                ? 'border-[#243756] hover:bg-[#243756] text-slate-300' 
                                : 'border-slate-300 hover:bg-slate-200 text-slate-600'
                            }`}
                            title={isExpanded ? 'Recolher setores' : 'Expandir setores'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          {/* Tipo de UO (SEDE / DACO / DECO) */}
                          {renderTipoBadge(uoPai.tipo)}

                          {/* Sigla e Código */}
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs sm:text-sm tracking-wide">
                              {uoPai.siglaExibicao}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                              ({uoPai.codigo})
                            </span>
                          </div>

                          <span className="text-slate-600 dark:text-slate-500">•</span>

                          {/* Nome da UO */}
                          <span className="text-xs sm:text-sm font-semibold truncate">
                            {uoPai.nome}
                          </span>

                          {/* Sede Territorial */}
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 hidden lg:inline">
                            Sede: {uoPai.sedeOuCanteiroPadrao || 'BE'}
                          </span>
                        </div>

                        {/* Metadados e Ações */}
                        <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
                          {/* Contagem de setores vinculados */}
                          <span className="text-[11px] text-slate-400 font-medium">
                            {setoresFilhos.length} {setoresFilhos.length === 1 ? 'setor' : 'setores'}
                          </span>

                          {/* Contagem de colaboradores associados */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Users className="w-3 h-3" />
                            <span>{empCountPai}</span>
                          </div>

                          {/* Badge de Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(uoPai)}
                            title="Clique para alternar o status"
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                              uoPai.ativa
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-slate-500/15 text-slate-400 border-slate-500/30 hover:bg-slate-500/25'
                            }`}
                          >
                            {uoPai.ativa ? 'Ativa' : 'Inativa'}
                          </button>

                          {/* Ações Inline no Hover */}
                          <div className="flex items-center gap-1">
                            {/* Adicionar Setor Filho (Apenas quando tipo = SEDE, DACO ou DECO) */}
                            <button
                              type="button"
                              onClick={() => handleOpenAddSetorFilho(uoPai)}
                              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                isDark 
                                  ? 'border-[#243756] hover:bg-emerald-500/20 text-emerald-400' 
                                  : 'border-slate-200 hover:bg-emerald-50 text-emerald-600'
                              }`}
                              title={`Adicionar Setor subordinado a ${uoPai.siglaExibicao}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline text-[11px]">Setor</span>
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditUO(uoPai)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isDark 
                                  ? 'border-[#243756] hover:bg-[#243756] text-blue-400 hover:text-white' 
                                  : 'border-slate-200 hover:bg-slate-100 text-blue-600 hover:text-blue-800'
                              }`}
                              title="Editar UO"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Excluir com checagem de dependência */}
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(uoPai)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isDark 
                                  ? 'border-[#243756] hover:bg-red-500/20 text-red-400 hover:text-red-300' 
                                  : 'border-slate-200 hover:bg-red-50 text-red-600 hover:text-red-700'
                              }`}
                              title="Excluir UO"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nível 3: SETORES vinculados a este pai */}
                    {isExpanded && (
                      <div className="pl-6 sm:pl-10 space-y-2 border-l-2 border-dashed border-blue-500/30 ml-3 sm:ml-4 transition-all">
                        {filhosFiltrados.length === 0 ? (
                          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                            isDark ? 'bg-[#0E1A2E]/40 border-[#243756] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}>
                            <div className="flex items-center gap-2">
                              <CornerDownRight className="w-3.5 h-3.5 text-slate-500" />
                              <span>Nenhum setor cadastrado para esta UO (opera via virtual <code>{uoPai.siglaExibicao}/GERAL</code>).</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAddSetorFilho(uoPai)}
                              icon={<Plus className="w-3 h-3" />}
                            >
                              Adicionar Setor
                            </Button>
                          </div>
                        ) : (
                          filhosFiltrados.map((setor) => {
                            const empCountSetor = employeeCountByUo[setor.codigo] || employeeCountByUo[setor.siglaExibicao] || 0;

                            return (
                              <div
                                key={setor.codigo}
                                className={`group p-2.5 sm:p-3 rounded-xl border transition-all ${
                                  isDark 
                                    ? 'bg-[#16243D]/70 border-[#243756] hover:border-slate-600' 
                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                                } ${!setor.ativa ? 'opacity-60' : ''}`}
                              >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                                  {/* Identificação do Setor */}
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    {renderTipoBadge(setor.tipo)}
                                    <span className="font-bold text-xs tracking-wide">
                                      {setor.siglaExibicao}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                                      ({setor.codigo})
                                    </span>
                                    <span className="text-slate-600 dark:text-slate-500">•</span>
                                    <span className="text-xs truncate">
                                      {setor.nome}
                                    </span>
                                    {setor.descricao && (
                                      <span className="text-[11px] text-slate-500 truncate max-w-[200px] hidden xl:inline">
                                        — {setor.descricao}
                                      </span>
                                    )}
                                  </div>

                                  {/* Metadados e Ações */}
                                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                                    {/* Colaboradores */}
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                      <Users className="w-3 h-3" />
                                      <span>{empCountSetor}</span>
                                    </div>

                                    {/* Status */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatus(setor)}
                                      title="Clique para alternar o status do setor"
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                        setor.ativa
                                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                          : 'bg-slate-500/15 text-slate-400 border-slate-500/30 hover:bg-slate-500/25'
                                      }`}
                                    >
                                      {setor.ativa ? 'Ativo' : 'Inativo'}
                                    </button>

                                    {/* Ações */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditUO(setor)}
                                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                          isDark 
                                            ? 'border-[#243756] hover:bg-[#243756] text-blue-400 hover:text-white' 
                                            : 'border-slate-200 hover:bg-slate-100 text-blue-600 hover:text-blue-800'
                                        }`}
                                        title="Editar Setor"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenDelete(setor)}
                                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                          isDark 
                                            ? 'border-[#243756] hover:bg-red-500/20 text-red-400 hover:text-red-300' 
                                            : 'border-slate-200 hover:bg-red-50 text-red-600 hover:text-red-700'
                                        }`}
                                        title="Excluir Setor"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Setores órfãos ou sem vínculo explícito (se houver, para resiliência contábil) */}
              {setoresOrfaos.length > 0 && (
                <div className="pt-4 space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Outros Setores / Vínculos em Ajuste</span>
                  </div>
                  {setoresOrfaos.map((s) => (
                    <div
                      key={s.codigo}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        isDark ? 'bg-[#0E1A2E]/60 border-amber-500/30 text-slate-300' : 'bg-amber-50/50 border-amber-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        {renderTipoBadge(s.tipo)}
                        <span className="font-bold">{s.siglaExibicao}</span>
                        <span>{s.nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEditUO(s)}>
                          Vincular a uma UO Pai
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição de Qualquer Tipo de UO (Gaps 3 e 5) */}
      <SetorFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUO}
        editingSetor={editingUo}
        uosPrincipais={uosPrincipais}
        setoresExistentes={setores}
        todasUOs={todasUOs}
        employees={employees}
        initialTipo={modalInitialTipo}
        initialPai={modalInitialPai}
        theme={theme}
      />

      {/* Modal de Confirmação de Exclusão com Bloqueio de Dependências (Gap 4) */}
      {uoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-lg p-6 rounded-2xl border shadow-2xl space-y-4 ${
            isDark ? 'bg-[#16243D] border-[#243756] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border shrink-0 ${
                dependenciasUoToDelete?.temDependencias
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base">
                  {dependenciasUoToDelete?.temDependencias 
                    ? 'Exclusão Bloqueada: Dependências Ativas' 
                    : `Excluir ${uoToDelete.tipo}: ${uoToDelete.siglaExibicao}?`}
                </h4>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {dependenciasUoToDelete?.temDependencias
                    ? 'Esta unidade possui vínculos cadastrais e não pode ser excluída fisicamente.'
                    : 'Esta ação removerá a unidade do catálogo oficial do sistema.'}
                </p>
              </div>
            </div>

            {/* Informações da UO selecionada */}
            <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
              isDark ? 'bg-[#0E1A2E] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm">
                  {uoToDelete.siglaExibicao} • {uoToDelete.nome}
                </div>
                {renderTipoBadge(uoToDelete.tipo)}
              </div>
              <div className="text-slate-400 font-mono text-[11px]">{uoToDelete.codigo}</div>

              {/* Contagem de Dependências (Gap 4) */}
              <div className="pt-2 border-t border-slate-700/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">UOs filhas subordinadas:</span>
                  <span className={`font-bold ${dependenciasUoToDelete?.totalFilhos ? 'text-amber-400' : 'text-slate-300'}`}>
                    {dependenciasUoToDelete?.totalFilhos || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Colaboradores associados:</span>
                  <span className={`font-bold ${dependenciasUoToDelete?.totalColaboradores ? 'text-amber-400' : 'text-slate-300'}`}>
                    {dependenciasUoToDelete?.totalColaboradores || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Aviso Amigável e Bloqueio se houver dependências (Gap 4) */}
            {dependenciasUoToDelete?.temDependencias ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{dependenciasUoToDelete.mensagemBloqueio}</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Para manter a integridade dos relatórios contábeis e do histórico de lançamentos dos colaboradores vinculados, desative a unidade em vez de excluí-la.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Nenhuma dependência encontrada (0 filhos, 0 colaboradores). Exclusão segura permitida.</span>
              </div>
            )}

            {/* Ações do Modal */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUoToDelete(null);
                  setDependenciasUoToDelete(null);
                }}
                disabled={isDeleting}
              >
                Cancelar
              </Button>

              {/* Se houver dependências, sugere e oferece o botão de DESATIVAR */}
              {dependenciasUoToDelete?.temDependencias ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    await handleToggleStatus(uoToDelete, false);
                    setUoToDelete(null);
                    setDependenciasUoToDelete(null);
                  }}
                  disabled={isDeleting}
                  icon={<Power className="w-3.5 h-3.5" />}
                >
                  Desativar Unidade em vez de Excluir
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  isLoading={isDeleting}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Confirmar Exclusão
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
