import React, { useState, useEffect, useMemo } from 'react';
import { AuditLog, AuditActionType, ConstructionSite, Branch } from '@/src/shared/types';
import { dbService } from '@/src/shared/services/dbService';
import { orderBy, where } from '@/src/shared/services/db';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { ComaraLogo } from '@/src/shared/components/ComaraLogo';
import { InfoTooltip } from '@/src/shared/components/InfoTooltip';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  Clock, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Activity,
  Layers,
  Database,
  ArrowUpDown,
  Eye,
  X,
  FileSpreadsheet,
  BadgeCheck
} from 'lucide-react';

interface AuditTrailViewProps {
  constructionSites?: ConstructionSite[];
  theme?: 'dark' | 'light';
  currentUserEmail?: string;
  userRole?: string;
}

const PAGE_SIZE = 50;

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  constructionSites = [],
  theme = 'dark',
  currentUserEmail = '',
  userRole = 'RH_ADMIN',
}) => {
  const isDark = theme === 'dark';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCanteiro, setSelectedCanteiro] = useState<string>('TODOS');
  const [selectedTipoAcao, setSelectedTipoAcao] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedLogModal, setSelectedLogModal] = useState<AuditLog | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [serverTotal, setServerTotal] = useState(0);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Carrega somente a página atual; a trilha não precisa de canal Realtime.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const constraints: any[] = [orderBy('timestamp', 'desc')];
    if (selectedCanteiro !== 'TODOS') constraints.push(where('canteiroId', '==', selectedCanteiro));
    if (selectedTipoAcao !== 'TODOS') constraints.push(where('tipoAcao', '==', selectedTipoAcao));
    if (startDate) constraints.push(where('timestamp', '>=', startDate));
    if (endDate) constraints.push(where('timestamp', '<=', `${endDate}T23:59:59`));
    if (debouncedSearchQuery.trim()) constraints.push(where('usuarioNome', 'ilike', `%${debouncedSearchQuery.trim()}%`));

    dbService.getCollectionPage('logs_auditoria', currentPage, PAGE_SIZE, constraints)
      .then((result) => {
        if (cancelled) return;
        setLogs(result.snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const userNome = data.usuarioNome || data.nomeUsuario || 'Operador';
          const act = data.tipoAcao || data.acao || 'ACAO_SISTEMA';
          return {
            id: docSnap.id, usuarioId: data.usuarioId || '', usuarioNome: userNome, nomeUsuario: userNome,
            usuarioPerfil: data.usuarioPerfil || 'OPERADOR', tipoAcao: act, acao: act, detalhes: data.detalhes || '',
            detalhesJson: data.detalhesJson, canteiroId: data.canteiroId || 'TODOS', timestamp: data.timestamp || '',
            ipOrigem: data.ipOrigem, recursoId: data.recursoId, dadosAnteriores: data.dadosAnteriores, dadosNovos: data.dadosNovos,
          } as AuditLog;
        }));
        setServerTotal(result.total);
        setIsLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Erro ao carregar página de auditoria:', error);
          setLogs([]);
          setServerTotal(0);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [currentPage, selectedCanteiro, selectedTipoAcao, startDate, endDate, debouncedSearchQuery]);

  // Lista de canteiros disponíveis para filtro
  const canteiroOptions = useMemo(() => {
    const list = new Set<string>();
    list.add('TODOS');
    list.add('KO');
    list.add('BE');
    list.add('MN');
    constructionSites.forEach(s => {
      if (s.code) list.add(s.code.toUpperCase());
      if (s.branch) list.add(s.branch.toUpperCase());
    });
    logs.forEach(l => {
      if (l.canteiroId) list.add(l.canteiroId.toUpperCase());
    });
    return Array.from(list);
  }, [constructionSites, logs]);

  // Tipos de ações padronizadas para filtro
  const actionTypeOptions: { value: string; label: string }[] = [
    { value: 'TODOS', label: 'Todas as Categorias' },
    { value: 'LANCAMENTO_HORAS', label: 'Lançamento de Horas' },
    { value: 'EDICAO_LANCAMENTO', label: 'Edição de Lançamento' },
    { value: 'EXCLUSAO_REGISTRO', label: 'Exclusão de Registro' },
    { value: 'EMISSAO_DISPENSA', label: 'Emissão de Dispensa SPTF' },
    { value: 'CANCELAMENTO_DISPENSA', label: 'Cancelamento de Dispensa' },
    { value: 'ALTERACAO_FUNCAO', label: 'Alteração de Função / Chefia' },
    { value: 'ALTERACAO_SENHA', label: 'Alteração de Senha' },
    { value: 'PASSAGEM_BASTAO', label: 'Passagem de Bastão' },
    { value: 'IMPORTACAO_FOLHA', label: 'Importação de Folha' },
    { value: 'ALTERACAO_PERMISSAO_ADMIN', label: 'Alteração de Permissões RBAC' },
  ];

  // Helper de formatação de badges de ação
  const getActionBadge = (tipo: string) => {
    const norm = (tipo || '').toUpperCase();
    if (norm.includes('DISPENSA')) {
      return {
        label: 'Dispensa SPTF',
        bgColor: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <FileText className="w-3 h-3" />
      };
    }
    if (norm.includes('EXCLUSAO') || norm.includes('CANCELAMENTO') || norm.includes('LIMPEZA')) {
      return {
        label: norm.includes('EXCLUSAO') ? 'Exclusão' : 'Cancelamento',
        bgColor: isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <AlertTriangle className="w-3 h-3" />
      };
    }
    if (norm.includes('HORAS') || norm.includes('LANCAMENTO')) {
      return {
        label: norm.includes('EDICAO') ? 'Edição Horas' : 'Banco de Horas',
        bgColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <Clock className="w-3 h-3" />
      };
    }
    if (norm.includes('BASTAO') || norm.includes('FUNCAO') || norm.includes('CANTEIRO')) {
      return {
        label: 'Chefia / Gestão',
        bgColor: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-200',
        icon: <Building2 className="w-3 h-3" />
      };
    }
    if (norm.includes('FOLHA') || norm.includes('CONTRACHEQUE')) {
      return {
        label: 'Folha Pagamento',
        bgColor: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200',
        icon: <Layers className="w-3 h-3" />
      };
    }
    return {
      label: tipo || 'Operação',
      bgColor: isDark ? 'bg-slate-500/10 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-700 border-slate-200',
      icon: <Activity className="w-3 h-3" />
    };
  };

  // Helper de Perfil
  const getProfileBadge = (perfil?: string) => {
    const p = (perfil || 'OPERADOR').toUpperCase();
    if (p === 'SUPER_ADMIN') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">SUPER ADMIN (TI)</span>;
    }
    if (p === 'RH_ADMIN' || p === 'GESTOR_RH') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">RH SEDE</span>;
    }
    if (p.includes('CHEFE') || p.includes('ENCARREGADO')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">{p.replace('_', ' ')}</span>;
    }
    if (p === 'AUX_DA') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">AUXILIAR DA</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">{p}</span>;
  };

  // Filtros aplicados
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Filtro Canteiro
      if (selectedCanteiro !== 'TODOS') {
        const cLog = (log.canteiroId || '').toUpperCase();
        const sel = selectedCanteiro.toUpperCase();
        if (cLog !== sel && cLog !== 'TODOS') return false;
      }

      // 2. Filtro Tipo Ação
      if (selectedTipoAcao !== 'TODOS') {
        const tLog = (log.tipoAcao || log.acao || '').toUpperCase();
        const sel = selectedTipoAcao.toUpperCase();
        if (tLog !== sel && !tLog.includes(sel)) return false;
      }

      // 3. Filtro Período
      if (startDate) {
        const logDate = (log.timestamp || '').substring(0, 10);
        if (logDate < startDate) return false;
      }
      if (endDate) {
        const logDate = (log.timestamp || '').substring(0, 10);
        if (logDate > endDate) return false;
      }

      // 4. Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const uNome = (log.usuarioNome || log.nomeUsuario || '').toLowerCase();
        const uId = (log.usuarioId || '').toLowerCase();
        const det = (log.detalhes || '').toLowerCase();
        const act = (log.tipoAcao || log.acao || '').toLowerCase();
        const cant = (log.canteiroId || '').toLowerCase();

        return uNome.includes(q) || uId.includes(q) || det.includes(q) || act.includes(q) || cant.includes(q);
      }

      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [logs, selectedCanteiro, selectedTipoAcao, startDate, endDate, searchQuery, sortOrder]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    let dispensasCount = 0;
    let horasCount = 0;
    let chefiasCount = 0;
    let folhaCount = 0;

    logs.forEach(l => {
      const act = (l.tipoAcao || l.acao || '').toUpperCase();
      if (act.includes('DISPENSA')) dispensasCount++;
      else if (act.includes('HORAS') || act.includes('LANCAMENTO')) horasCount++;
      else if (act.includes('BASTAO') || act.includes('FUNCAO') || act.includes('CANTEIRO') || act.includes('PERMISSAO')) chefiasCount++;
      else if (act.includes('FOLHA') || act.includes('CONTRACHEQUE')) folhaCount++;
    });

    return {
      total: logs.length,
      dispensasCount,
      horasCount,
      chefiasCount,
      folhaCount
    };
  }, [logs]);

  // Paginação (50 registros por página conforme requisitos)
  const totalPages = Math.ceil(serverTotal / PAGE_SIZE) || 1;
  const paginatedLogs = useMemo(() => {
    return filteredLogs;
  }, [filteredLogs]);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCanteiro, selectedTipoAcao, startDate, endDate, searchQuery]);

  // Exportar para CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('Não há registros para exportar com os filtros atuais.');
      return;
    }

    const headers = ['Timestamp', 'Data/Hora Formatada', 'Usuário Nome', 'Usuário E-mail/ID', 'Perfil', 'Canteiro', 'Tipo de Ação', 'Detalhes'];
    const rows = filteredLogs.map(l => [
      `"${l.timestamp}"`,
      `"${new Date(l.timestamp).toLocaleString('pt-BR')}"`,
      `"${(l.usuarioNome || l.nomeUsuario || '').replace(/"/g, '""')}"`,
      `"${(l.usuarioId || '').replace(/"/g, '""')}"`,
      `"${(l.usuarioPerfil || '').replace(/"/g, '""')}"`,
      `"${(l.canteiroId || 'TODOS').replace(/"/g, '""')}"`,
      `"${(l.tipoAcao || l.acao || '').replace(/"/g, '""')}"`,
      `"${(l.detalhes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `COMARA_Auditoria_Logs_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formatar Data e Hora
  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return ts;
    }
  };

  return (
    <div id="view-audit-trail" className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. CABEÇALHO INSTITUCIONAL DA AUDITORIA */}
      <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold">
                  GOVERNANÇA & SEGURANÇA DA INFORMAÇÃO
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  IMUTÁVEL • LGPD
                </span>
              </div>
              <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Trilha de Auditoria & Logs de Segurança
              </h1>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Logs imutáveis e rastreáveis (LGPD) <InfoTooltip theme={isDark ? 'dark' : 'light'} content="Rastreamento e auditoria em tempo real de emissões de dispensas, lançamentos de horas, trocas de chefias e importações de folha." />
              </p>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
            <button
              onClick={handleExportCSV}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
                isDark 
                  ? 'bg-[#243756] hover:bg-[#335075] text-[#E2E8F0] border-[#335075]' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
              title="Exportar registros filtrados para planilha CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
                isDark 
                  ? 'bg-[#243756] hover:bg-[#335075] text-[#E2E8F0] border-[#335075]' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
              title="Imprimir relatório de auditoria"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* 2. CARDS DE ESTATÍSTICAS RÁPIDAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#243756]/60">
          <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0F1B33]/70 border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold">Total de Ações</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.total.toLocaleString('pt-BR')}</span>
              <span className="text-[10px] text-indigo-400 font-mono font-medium">Registradas</span>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0F1B33]/70 border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold">Banco de Horas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-blue-400">{stats.horasCount.toLocaleString('pt-BR')}</span>
              <span className="text-[10px] text-blue-400/80 font-mono font-medium">Lançamentos</span>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0F1B33]/70 border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold">Dispensas SPTF</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-400">{stats.dispensasCount.toLocaleString('pt-BR')}</span>
              <span className="text-[10px] text-emerald-400/80 font-mono font-medium">Guias 2 Vias</span>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0F1B33]/70 border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
            <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold">Chefias & Folha</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-amber-400">{(stats.chefiasCount + stats.folhaCount).toLocaleString('pt-BR')}</span>
              <span className="text-[10px] text-amber-400/80 font-mono font-medium">Gestão/Folha</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS AVANÇADOS */}
      <div className={`p-4 rounded-2xl border ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Busca Textual */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por usuário, matrícula, detalhes ou canteiro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-8 py-2 text-xs rounded-xl border transition-colors outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                isDark 
                  ? 'bg-[#0F1B33] border-[#243756] text-white placeholder-gray-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro: Canteiro */}
          <div>
            <select
              value={selectedCanteiro}
              onChange={(e) => setSelectedCanteiro(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl border transition-colors outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                isDark 
                  ? 'bg-[#0F1B33] border-[#243756] text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="TODOS">Todos os Canteiros / Sedes</option>
              {canteiroOptions.filter(c => c !== 'TODOS').map((c) => (
                <option key={c} value={c}>Canteiro / Sede: {c}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Tipo de Ação */}
          <div>
            <select
              value={selectedTipoAcao}
              onChange={(e) => setSelectedTipoAcao(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl border transition-colors outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                isDark 
                  ? 'bg-[#0F1B33] border-[#243756] text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {actionTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Período Data Inicial */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Data Inicial"
              className={`w-1/2 px-2 py-2 text-xs rounded-xl border transition-colors outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                isDark 
                  ? 'bg-[#0F1B33] border-[#243756] text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Data Final"
              className={`w-1/2 px-2 py-2 text-xs rounded-xl border transition-colors outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
                isDark 
                  ? 'bg-[#0F1B33] border-[#243756] text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Indicador de Filtros Ativos */}
        {(selectedCanteiro !== 'TODOS' || selectedTipoAcao !== 'TODOS' || startDate || endDate || searchQuery) && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#243756]/60 text-xs">
            <span className="text-[#94A3B8]">
              Exibindo <strong className={isDark ? 'text-white' : 'text-slate-900'}>{filteredLogs.length}</strong> de {logs.length} registros filtrados
            </span>
            <button
              onClick={() => {
                setSelectedCanteiro('TODOS');
                setSelectedTipoAcao('TODOS');
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* 4. TABELA PRINCIPAL DE LOGS (SOMENTE LEITURA & PAGINADA A 50 ITENS) */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="p-4 border-b border-[#243756]/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Coleção Firestore: <code className="font-mono text-indigo-400">logs_auditoria</code>
            </span>
            <span className="text-[10px] font-mono text-[#94A3B8]">
              ({PAGE_SIZE} por página)
            </span>
          </div>

          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition-colors active:scale-[0.98] cursor-pointer ${
              isDark ? 'bg-[#0F1B33] border-[#243756] text-gray-300 hover:bg-[#243756]' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="Ordenar por data/hora"
          >
            <ArrowUpDown className="w-3 h-3 text-indigo-400" />
            <span>{sortOrder === 'desc' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}</span>
          </button>
        </div>

        {/* Loading ou Tabela */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <span className="text-xs text-[#94A3B8] font-mono">Carregando trilha de auditoria do Firestore...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheck className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-40" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Nenhum log de auditoria encontrado</h3>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-md mx-auto">
              Não há registros para os filtros selecionados ou nenhuma alteração foi registrada recentemente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b text-[11px] font-mono uppercase tracking-wider font-semibold ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <th className="py-3 px-4 w-44">Data / Hora</th>
                  <th className="py-3 px-4 w-52">Operador</th>
                  <th className="py-3 px-4 w-32">Canteiro</th>
                  <th className="py-3 px-4 w-44">Tipo de Ação</th>
                  <th className="py-3 px-4">Detalhes da Ação</th>
                  <th className="py-3 px-4 w-20 text-center">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#243756]/60">
                {paginatedLogs.map((log) => {
                  const badge = getActionBadge(log.tipoAcao || log.acao || '');
                  const userNome = log.usuarioNome || log.nomeUsuario || 'Operador';
                  const userEmail = log.usuarioId || '';
                  const canteiro = log.canteiroId || 'TODOS';

                  return (
                    <tr 
                      key={log.id} 
                      className={`transition-colors ${
                        isDark ? 'hover:bg-[#1B2D4A]/70 text-[#E2E8F0]' : 'hover:bg-slate-50/80 text-slate-800'
                      }`}
                    >
                      {/* 1. Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* 2. Operador & Perfil */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-xs truncate max-w-[200px]" title={userNome}>
                          {userNome}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {getProfileBadge(log.usuarioPerfil)}
                          <span className="text-[10px] font-mono text-[#94A3B8] truncate max-w-[100px]" title={userEmail}>
                            {userEmail.split('@')[0]}
                          </span>
                        </div>
                      </td>

                      {/* 3. Canteiro */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                          canteiro === 'KO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          canteiro === 'BE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          canteiro === 'MN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        }`}>
                          {canteiro}
                        </span>
                      </td>

                      {/* 4. Tipo de Ação */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badge.bgColor}`}>
                          {badge.icon}
                          <span className="truncate">{badge.label}</span>
                        </span>
                      </td>

                      {/* 5. Detalhes */}
                      <td className="py-3 px-4 text-xs font-sans">
                        <div className="leading-relaxed break-words line-clamp-2" title={log.detalhes}>
                          {log.detalhes || 'Sem detalhes informados.'}
                        </div>
                      </td>

                      {/* 6. Ação: Ver Mais Detalhes JSON */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedLogModal(log)}
                          className={`p-1.5 rounded-lg border transition-colors active:scale-[0.98] cursor-pointer ${
                            isDark ? 'bg-[#0F1B33] hover:bg-[#243756] border-[#243756] text-gray-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                          }`}
                          title="Visualizar registro completo de auditoria"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. CONTROLES DE PAGINAÇÃO (MÁXIMO 50 POR PÁGINA) */}
        {!isLoading && filteredLogs.length > 0 && (
          <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
            isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50'
          }`}>
            <span className="text-[#94A3B8] text-[11px] font-mono">
              Página <strong className={isDark ? 'text-white' : 'text-slate-900'}>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredLogs.length} logs totais)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDark ? 'bg-[#16243D] border-[#243756] text-white hover:bg-[#243756]' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="px-2 font-mono font-bold text-xs text-indigo-400">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDark ? 'bg-[#16243D] border-[#243756] text-white hover:bg-[#243756]' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <span>Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. MODAL: DETALHES COMPLETOS DO REGISTRO DE AUDITORIA */}
      {selectedLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 ${
            isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
              isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Documento de Auditoria</h3>
                  <p className="text-[11px] font-mono text-[#94A3B8]">ID: {selectedLogModal.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogModal(null)}
                className="p-1.5 rounded-lg hover:bg-gray-500/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold">Data / Hora</span>
                  <span className="font-mono text-xs font-bold mt-1 block">{formatTimestamp(selectedLogModal.timestamp)}</span>
                </div>

                <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold">Canteiro / Sede</span>
                  <span className="font-mono text-xs font-bold mt-1 text-indigo-400 block">{selectedLogModal.canteiroId}</span>
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold">Operador Responsável</span>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <div className="font-bold text-xs">{selectedLogModal.usuarioNome || selectedLogModal.nomeUsuario}</div>
                    <div className="text-[11px] font-mono text-[#94A3B8]">{selectedLogModal.usuarioId}</div>
                  </div>
                  {getProfileBadge(selectedLogModal.usuarioPerfil)}
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold">Descrição da Ação</span>
                <p className="mt-1 text-xs leading-relaxed font-sans">{selectedLogModal.detalhes}</p>
              </div>

              {selectedLogModal.detalhesJson && (
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-mono uppercase text-[#94A3B8] block font-semibold mb-1">Metadados Estruturados (JSON)</span>
                  <pre className="p-2.5 rounded-lg bg-black/40 text-[10px] font-mono text-emerald-400 overflow-x-auto">
                    {JSON.stringify(selectedLogModal.detalhesJson, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className={`p-4 border-t flex justify-end ${
              isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50'
            }`}>
              <button
                onClick={() => setSelectedLogModal(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors active:scale-[0.98] cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
