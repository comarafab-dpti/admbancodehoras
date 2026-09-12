import React, { useState, useMemo, useEffect } from 'react';
import { Employee, TimeRecord, DashboardFilter, Attachment, AdminRole, ConstructionSite } from '@/src/shared/types';
import { 
  formatHoursDecimal, 
  formatHoursToDays, 
  generateMonthlySummaries 
} from '@/src/shared/utils/calculations';
import { calcularSaldosConsolidados, chaveMatricula } from '@/src/shared/utils/saldo';
import { exportTimeRecordsToLookerCSV, exportFilteredBalancesCSV, triggerFileDownload } from '@/src/shared/utils/csvHandler';
import { DashboardCalendarView } from './DashboardCalendarView';
import { CollaboratorBalancesPrintModal } from './CollaboratorBalancesPrintModal';
import { InfoTooltip } from '@/src/shared/components/InfoTooltip';
import { IconButton } from '@/src/shared/components/IconButton';
import { ErrorBoundary } from '@/src/shared/components/ErrorBoundary';
import { 
  Users, 
  Clock, 
  AlertOctagon, 
  FileSpreadsheet, 
  Download, 
  Search, 
  Filter, 
  Building, 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownRight, 
  FileText, 
  ExternalLink,
  PlusCircle,
  Plus,
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  UploadCloud,
  RotateCcw,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Zap,
  Printer,
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { CompetenciaControle } from '@/src/shared/services/competenciaService';
import { 
  MONTH_NAMES_FULL, 
  getCompetenciaAnterior, 
  getProximaCompetencia, 
  normalizarCanteiroId, 
  statusEfetivoCanteiro,
  calcularCorCompetencia,
  ResultadoCorCompetencia
} from '@/src/shared/services/competenciaEngine';

interface LookerDashboardProps {
  employees: Employee[];
  records: TimeRecord[];
  constructionSites?: ConstructionSite[];
  onOpenNewEntryModal: (matricula?: string, dateIso?: string) => void;
  onOpenEditEntryModal?: (record: TimeRecord) => void;
  onViewEmployeeStatement: (matricula: string) => void;
  onViewAttachment: (attachment: Attachment, empName?: string, recordDate?: string) => void;
  onOpenImportRecordsModal?: () => void;
  onOpenQuickBatchModal?: () => void;
  onOpenSptfDispensa?: () => void;
  onNavigateToEmployees?: () => void;
  onResetData?: () => void;
  onClearData?: () => void;
  onDeleteRecord?: (id: string) => void | Promise<void>;
  userRole?: AdminRole | string;
  theme?: 'dark' | 'light';
  currentCompetencia?: string;
  competenciaControle?: CompetenciaControle | null;
  competenciaAnteriorControle?: CompetenciaControle | null;
  todasCompetenciasControle?: CompetenciaControle[];
  onSelectCompetencia?: (comp: string) => void;
  onOpenCompetenciaModal?: () => void;
  activeCanteiro?: string;
  isSuperAdmin?: boolean;
}

type SortField = 'matricula' | 'nome' | 'sede' | 'saldo';
type SortDirection = 'asc' | 'desc';

export const LookerDashboard: React.FC<LookerDashboardProps> = ({
  employees,
  records,
  constructionSites = [],
  onOpenNewEntryModal,
  onOpenEditEntryModal,
  onViewEmployeeStatement,
  onViewAttachment,
  onOpenImportRecordsModal,
  onOpenQuickBatchModal,
  onOpenSptfDispensa,
  onNavigateToEmployees,
  onResetData,
  onClearData,
  onDeleteRecord,
  userRole,
  theme = 'dark',
  currentCompetencia,
  competenciaControle,
  competenciaAnteriorControle,
  todasCompetenciasControle = [],
  onSelectCompetencia,
  onOpenCompetenciaModal,
  activeCanteiro,
  isSuperAdmin = false,
}) => {
  const isDark = theme === 'dark';
  const isAuxDA = userRole === 'AUX_DA' || (userRole as string) === 'AUXILIAR_DA';
  const isSedeLocked = Boolean(
    activeCanteiro && 
    !isSuperAdmin && 
    userRole !== 'SUPER_ADMIN' && 
    userRole !== 'RH_ADMIN'
  );

  // Estado dos Filtros da Barra Superior
  const [filters, setFilters] = useState<DashboardFilter>({
    dataInicio: '',
    dataFim: '',
    sede: activeCanteiro || 'TODAS',
    funcao: 'TODAS',
    matriculaOrNome: '',
    statusBanco: 'TODOS',
    tipoOcorrencia: 'TODOS',
  });

  // Forçar filtro de sede se o usuário for restrito à sua OU/Canteiro
  useEffect(() => {
    if (isSedeLocked && activeCanteiro) {
      setFilters(prev => ({ ...prev, sede: activeCanteiro }));
    }
  }, [isSedeLocked, activeCanteiro]);

  // Estado de visibilidade dos filtros (ocultável para interface mais limpa)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);

  // Aba ativa: Resumo por Colaborador como padrão
  const [activeTab, setActiveTab] = useState<'colaboradores' | 'calendario' | 'por_sede' | 'extrato'>('colaboradores');

  // Assegurar que se for Aux de DA e estiver na aba por_sede, volte para colaboradores
  useEffect(() => {
    if (isAuxDA && activeTab === 'por_sede') {
      setActiveTab('colaboradores');
    }
  }, [isAuxDA, activeTab]);

  // Estados de Paginação para Colaboradores
  const [empCurrentPage, setEmpCurrentPage] = useState<number>(1);
  const [empPageSize, setEmpPageSize] = useState<number>(25);

  // Estados de Paginação para Lançamentos Individuais
  const [recordsCurrentPage, setRecordsCurrentPage] = useState<number>(1);
  const [recordsPageSize, setRecordsPageSize] = useState<number>(50);

  // Estado para Modal de Impressão da Relação Ordenada de Colaboradores
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Estados de Ordenação da Tabela de Colaboradores
  const [sortField, setSortField] = useState<SortField>('saldo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Reset pagination on filter change
  useEffect(() => {
    setEmpCurrentPage(1);
    setRecordsCurrentPage(1);
  }, [filters]);

  // Listas únicas para dropdowns
  const availableRoles = useMemo(() => {
    const set = new Set(employees.map(e => e.funcao));
    return Array.from(set).sort();
  }, [employees]);

  // Registros filtrados por data para recálculo dinâmico de saldo no período
  const dateFilteredRecords = useMemo(() => {
    if (!filters.dataInicio && !filters.dataFim) return records;
    return records.filter(r => {
      const eventDate = r.dataRegistro || r.data_ocorrencia || '';
      if (filters.dataInicio && eventDate < filters.dataInicio) return false;
      if (filters.dataFim && eventDate > filters.dataFim) return false;
      return true;
    });
  }, [records, filters.dataInicio, filters.dataFim]);

  const balancesByMatricula = useMemo(
    () => calcularSaldosConsolidados(employees, dateFilteredRecords),
    [employees, dateFilteredRecords],
  );

  const getBalance = (matricula: string) => balancesByMatricula.get(chaveMatricula(matricula));
  const emptyBalance = {
    saldoTotalHoras: 0,
    saldoTotalDias: 0,
    saldoInicial: 0,
    totalCreditos: 0,
    totalDebitos: 0,
    totalAtestados: 0,
    totalFaltas: 0,
    totalHorasDescontoFolha: 0,
    totalHorasExtras50: 0,
    totalHorasExtras100: 0,
  };

  // Colaboradores filtrados com balanço consolidado no período
  const filteredEmployeesWithBalance = useMemo(() => {
    return employees
      .filter(emp => {
        // Filtro de Sede
        if (filters.sede !== 'TODAS' && emp.sedeCodigo !== filters.sede) return false;
        // Filtro de Função
        if (filters.funcao !== 'TODAS' && emp.funcao !== filters.funcao) return false;
        // Filtro de Busca (Nome ou Matrícula)
        if (filters.matriculaOrNome) {
          const query = filters.matriculaOrNome.toLowerCase().trim();
          const matMatch = emp.matricula.toLowerCase().includes(query);
          const nameMatch = emp.nome.toLowerCase().includes(query);
          if (!matMatch && !nameMatch) return false;
        }
        return true;
      })
      .map(emp => {
        // Recalcula o saldo consolidado no período selecionado
        const bal = getBalance(emp.matricula);
        if (!bal) return { ...emp, ...emptyBalance, statusBancoCalc: 'ZERADO' as const };
        const { status: _bancoStatus, ...balRest } = bal;
        return {
          ...emp,
          ...balRest,
          statusBancoCalc: bal.status,
        };
      })
      .filter(emp => {
        // Filtro de Status do Banco
        if (filters.statusBanco === 'CREDOR') return emp.saldoTotalHoras > 0.05;
        if (filters.statusBanco === 'DEVEDOR') return emp.saldoTotalHoras < -0.05;
        if (filters.statusBanco === 'ZERADO') return Math.abs(emp.saldoTotalHoras) <= 0.05;
        return true;
      });
  }, [employees, dateFilteredRecords, filters]);

  // Ordenação dos colaboradores consolidados
  const sortedEmployees = useMemo(() => {
    const list = [...filteredEmployeesWithBalance];
    list.sort((a, b) => {
      let comp = 0;
      if (sortField === 'matricula') {
        const numA = parseInt(a.matricula.replace(/\D/g, ''), 10);
        const numB = parseInt(b.matricula.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          comp = numA - numB;
        } else {
          comp = a.matricula.localeCompare(b.matricula);
        }
      } else if (sortField === 'nome') {
        comp = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
      } else if (sortField === 'sede') {
        comp = (a.sede || '').localeCompare(b.sede || '');
      } else if (sortField === 'saldo') {
        comp = a.saldoTotalHoras - b.saldoTotalHoras;
      }
      return sortDirection === 'asc' ? comp : -comp;
    });
    return list;
  }, [filteredEmployeesWithBalance, sortField, sortDirection]);

  // Paginação da Tabela de Colaboradores
  const totalEmpPages = Math.ceil(sortedEmployees.length / empPageSize) || 1;
  const safeEmpCurrentPage = Math.min(Math.max(empCurrentPage, 1), totalEmpPages);

  const paginatedEmployees = useMemo(() => {
    const start = (safeEmpCurrentPage - 1) * empPageSize;
    return sortedEmployees.slice(start, start + empPageSize);
  }, [sortedEmployees, safeEmpCurrentPage, empPageSize]);

  // Handler de Ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'saldo' ? 'desc' : 'asc');
    }
  };

  // Filtragem ultra-reativa e performática dos registros brutos
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const emp = employees.find(e => e.matricula === r.matricula);
      const eventDate = r.dataRegistro || r.data_ocorrencia || '';
      
      // Filtro de data do evento (DD/MM/AAAA ou ISO)
      if (filters.dataInicio && eventDate < filters.dataInicio) return false;
      if (filters.dataFim && eventDate > filters.dataFim) return false;

      // Filtro de Sede
      const recordSede = r.employeeSede || emp?.sede;
      if (filters.sede !== 'TODAS' && recordSede !== filters.sede) return false;

      // Filtro de Função
      const recordFuncao = r.employeeFuncao || emp?.funcao;
      if (filters.funcao !== 'TODAS' && recordFuncao !== filters.funcao) return false;

      // Filtro de Busca (Nome ou Matrícula)
      if (filters.matriculaOrNome) {
        const query = filters.matriculaOrNome.toLowerCase().trim();
        const matMatch = r.matricula.toLowerCase().includes(query);
        const nameMatch = (r.employeeName || emp?.nome || '').toLowerCase().includes(query);
        if (!matMatch && !nameMatch) return false;
      }

      // Filtro de Status do Banco
      if (filters.statusBanco !== 'TODOS') {
        const bal = getBalance(r.matricula);
        const empSaldo = bal?.saldoTotalHoras || 0;
        if (filters.statusBanco === 'CREDOR' && !(empSaldo > 0.05)) return false;
        if (filters.statusBanco === 'DEVEDOR' && !(empSaldo < -0.05)) return false;
        if (filters.statusBanco === 'ZERADO' && !(Math.abs(empSaldo) <= 0.05)) return false;
      }

      // Filtro de Tipo de Ocorrência
      if (filters.tipoOcorrencia !== 'TODOS' && r.tipoOcorrencia !== filters.tipoOcorrencia) {
        return false;
      }

      return true;
    });
  }, [records, employees, filters, dateFilteredRecords]);

  // Paginação dos registros brutos
  const totalRecordsPages = Math.ceil(filteredRecords.length / recordsPageSize) || 1;
  const safeRecordsCurrentPage = Math.min(Math.max(recordsCurrentPage, 1), totalRecordsPages);

  const paginatedRecords = useMemo(() => {
    const start = (safeRecordsCurrentPage - 1) * recordsPageSize;
    return filteredRecords.slice(start, start + recordsPageSize);
  }, [filteredRecords, safeRecordsCurrentPage, recordsPageSize]);

  // Dados de Competência Contábil para o 5º Card do Dashboard
  const compAtual = currentCompetencia || new Date().toISOString().slice(0, 7);
  const compAnterior = getCompetenciaAnterior(compAtual);
  const compProxima = getProximaCompetencia(compAtual);
  const [anoStr, mesStr] = compAtual.split('-');
  const mesIndex = parseInt(mesStr, 10) - 1;
  const mesNomeCompleto = MONTH_NAMES_FULL[mesIndex] || mesStr;
  const statusCompetencia = competenciaControle?.status || 'ABERTO';

  // Status de bloqueio do Canteiro
  const normalizedCanteiro = normalizarCanteiroId(activeCanteiro);
  const statusCanteiro = normalizedCanteiro 
    ? statusEfetivoCanteiro(competenciaAnteriorControle?.statusCanteiros, normalizedCanteiro) 
    : 'ABERTO';
  const canteiroLiberado = isSuperAdmin || statusCanteiro === 'FECHADO';

  // Coleta dos meses com lançamentos para conferência contábil de competências passadas
  const mesesComLancamentos = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      const comp = r.competencia || (r.dataRegistro ? r.dataRegistro.slice(0, 7) : null);
      if (comp) set.add(comp);
    });
    return Array.from(set);
  }, [records]);

  // Apuração da cor visual do card (Regra SPTF: Fechado = Vermelho, Aberto com pendência anterior = Amarelo, Aberto regular = Verde)
  const estadoCorCompetencia = useMemo(() => {
    return calcularCorCompetencia({
      competenciaAtual: compAtual,
      statusCompetenciaAtual: statusCompetencia,
      statusCompetenciaAnterior: competenciaAnteriorControle?.status,
      mesesControle: todasCompetenciasControle,
      mesesComLancamentos,
    });
  }, [compAtual, statusCompetencia, competenciaAnteriorControle, todasCompetenciasControle, mesesComLancamentos]);

  // Métricas Globais Looker Studio (KPIs)
  const kpis = useMemo(() => {
    const totalAtivos = employees.filter(e => e.status === 'Ativo').length;
    
    let saldoGeralHoras = 0;
    let totalAtestados = 0;
    let totalFaltas = 0;
    let totalHe50 = 0;
    let totalHe100 = 0;
    let colaboradoresCredores = 0;
    let colaboradoresDevedores = 0;

    employees.forEach(emp => {
      const bal = getBalance(emp.matricula);
      if (!bal) return;
      saldoGeralHoras += bal.saldoTotalHoras;
      totalAtestados += bal.totalAtestados;
      totalFaltas += bal.totalFaltas;
      totalHe50 += bal.totalHorasExtras50;
      totalHe100 += bal.totalHorasExtras100;
      if (bal.saldoTotalHoras > 0.05) colaboradoresCredores++;
      else if (bal.saldoTotalHoras < -0.05) colaboradoresDevedores++;
    });

    const saldoGeralDias = Number((saldoGeralHoras / 8).toFixed(2));

    return {
      totalAtivos,
      saldoGeralHoras: Number(saldoGeralHoras.toFixed(2)),
      saldoGeralDias,
      totalAtestados,
      totalFaltas,
      totalHe50,
      totalHe100,
      colaboradoresCredores,
      colaboradoresDevedores,
    };
  }, [employees, dateFilteredRecords]);

  // Agrupamento por Sede
  const branchSummary = useMemo(() => {
    const map: Record<string, { sede: string; saldoHoras: number; colaboradores: number; atestados: number; faltas: number }> = {
      KO: { sede: 'KO (Coari)', saldoHoras: 0, colaboradores: 0, atestados: 0, faltas: 0 },
      BE: { sede: 'BE (Belém)', saldoHoras: 0, colaboradores: 0, atestados: 0, faltas: 0 },
      MN: { sede: 'MN (Manaus)', saldoHoras: 0, colaboradores: 0, atestados: 0, faltas: 0 },
    };

    employees.forEach(emp => {
      const s = emp.sedeCodigo || 'Não informado';
      if (!map[s]) {
        map[s] = { sede: s, saldoHoras: 0, colaboradores: 0, atestados: 0, faltas: 0 };
      }
      map[s].colaboradores++;
      const bal = getBalance(emp.matricula);
      if (!bal) return;
      map[s].saldoHoras += bal.saldoTotalHoras;
      map[s].atestados += bal.totalAtestados;
      map[s].faltas += bal.totalFaltas;
    });

    return Object.values(map);
  }, [employees, dateFilteredRecords]);

  // Exportações Rápidas
  const handleExportLookerCSV = () => {
    const csvContent = exportTimeRecordsToLookerCSV(filteredRecords, employees);
    triggerFileDownload(csvContent, `extrato_lancamentos_filtrados_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportDevedores = () => {
    const devedores = filteredEmployeesWithBalance.filter(e => e.saldoTotalHoras < -0.05);
    const csvContent = exportFilteredBalancesCSV(devedores, 'RELATORIO_COLABORADORES_DEVEDORES');
    triggerFileDownload(csvContent, `relatorio_devedores_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportCredoresCriticos = () => {
    const criticos = filteredEmployeesWithBalance.filter(e => e.saldoTotalHoras >= 40.0);
    const csvContent = exportFilteredBalancesCSV(criticos, 'RELATORIO_CREDORES_CRITICOS_40H_MAIS');
    triggerFileDownload(csvContent, `relatorio_credores_criticos_40h_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner com Indicador de Conexão e Exportações Rápidas */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl shadow-xs border transition-colors ${
        isDark 
          ? 'bg-[#16243D] text-white border-[#243756]' 
          : 'bg-white text-slate-900 border-slate-200'
      }`}>
        <div>
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1.5 font-mono border ${
              isDark 
                ? 'bg-[#243756] text-blue-400 border-[#335075]' 
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Sincronização Ativa
            </span>
            <InfoTooltip 
              theme={theme}
              content="Cálculo SPTF em tempo real: Seg-Sex 1.0x • Sáb 1.5x (50%) • Dom/Feriados 2.0x (100%) • Faltas -8.0h. Integrado com Google BigQuery e Looker Studio."
            />
          </div>
          <h1 className={`text-lg font-bold mt-1.5 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Painel Executivo de Gestão do Banco de Horas
          </h1>
        </div>

        {/* Ações Rápidas & Exportações Looker com Tooltips Despoluídos */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onOpenQuickBatchModal && (
            <IconButton
              id="btn-dash-lancamento-rapido"
              icon={Plus}
              variant="primary"
              size="md"
              tooltip="Novo Lançamento Diário ou em Lote"
              aria-label="Novo Lançamento"
              onClick={onOpenQuickBatchModal}
            />
          )}

          {onOpenSptfDispensa && (
            <IconButton
              id="btn-dash-nova-dispensa-sptf"
              icon={FileText}
              variant="success"
              size="md"
              tooltip="Emitir Guia Oficial de Dispensa de SPTF (2 Vias A4)"
              aria-label="Emitir Dispensa SPTF"
              onClick={() => onOpenSptfDispensa && onOpenSptfDispensa()}
            />
          )}

          {/* Botão de Expansão / Ocultação de Filtros com Badge de Filtro Ativo */}
          <IconButton
            icon={Filter}
            variant={isFiltersExpanded || (filters.sede !== 'TODAS' || filters.funcao !== 'TODAS' || filters.statusBanco !== 'TODOS' || filters.matriculaOrNome || filters.tipoOcorrencia !== 'TODOS' || filters.dataInicio || filters.dataFim) ? 'subtle' : 'secondary'}
            size="md"
            tooltip={isFiltersExpanded ? 'Ocultar Filtros Globais' : 'Expandir Filtros Globais (Sede, Função, Período)'}
            aria-label="Filtrar Painel"
            badge={(filters.sede !== 'TODAS' || filters.funcao !== 'TODAS' || filters.statusBanco !== 'TODOS' || !!filters.matriculaOrNome || filters.tipoOcorrencia !== 'TODOS' || !!filters.dataInicio || !!filters.dataFim)}
            badgeColor="blue"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          />

          <IconButton
            icon={Download}
            variant="secondary"
            size="md"
            tooltip="Exportar Extrato Geral dos Lançamentos Filtrados (CSV)"
            aria-label="Exportar CSV Extrato"
            onClick={handleExportLookerCSV}
          />

          <IconButton
            icon={AlertOctagon}
            variant="danger"
            size="md"
            tooltip="Exportar Relação de Colaboradores Devedores (CSV)"
            aria-label="Exportar Devedores CSV"
            onClick={handleExportDevedores}
          />

          <IconButton
            icon={Sparkles}
            variant="warning"
            size="md"
            tooltip="Exportar Colaboradores com Saldo Crítico (≥ 40h de Crédito)"
            aria-label="Exportar Credores Críticos CSV"
            onClick={handleExportCredoresCriticos}
          />
        </div>
      </div>

      {/* PAINEL DE FILTROS GLOBAIS (EXPANSÍVEL) */}
      {isFiltersExpanded && (
        <div className={`p-4 rounded-2xl shadow-xs border transition-all duration-200 space-y-3 animate-in fade-in zoom-in-98 ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2.5 ${isDark ? 'border-[#243756]' : 'border-slate-100'}`}>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider">
              <Filter className="w-4 h-4 text-[#3B82F6]" />
              <span className={isDark ? 'text-[#E2E8F0]' : 'text-slate-800'}>Filtros Globais</span>
              <InfoTooltip 
                theme={theme}
                content="Filtre simultaneamente por colaborador, lotação de canteiro, cargo, status positivo/negativo ou período de datas do evento."
              />
            </div>

            <div className="flex items-center gap-3">
              <a 
                href="https://lookerstudio.google.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-blue-500 hover:text-blue-600 hover:underline"
                title="Abrir dashboard no Google Looker Studio"
              >
                <span>Conexão Looker Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {(filters.sede !== 'TODAS' || filters.funcao !== 'TODAS' || filters.statusBanco !== 'TODOS' || filters.matriculaOrNome || filters.tipoOcorrencia !== 'TODOS' || filters.dataInicio || filters.dataFim) && (
                <button
                  onClick={() => setFilters({
                    dataInicio: '',
                    dataFim: '',
                    sede: 'TODAS',
                    funcao: 'TODAS',
                    matriculaOrNome: '',
                    statusBanco: 'TODOS',
                    tipoOcorrencia: 'TODOS',
                  })}
                  className="text-xs text-blue-500 hover:text-blue-600 font-semibold transition-colors active:scale-[0.98] cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>

          {/* Grid de Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* 1. Busca por Nome/Matrícula */}
            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Colaborador / MAT
              </label>
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 ${isDark ? 'text-[#64748B]' : 'text-slate-400'}`} />
                <input
                  type="text"
                  placeholder="Buscar nome ou MAT..."
                  value={filters.matriculaOrNome}
                  onChange={(e) => setFilters({ ...filters, matriculaOrNome: e.target.value })}
                  className={`w-full pl-8 pr-2.5 py-1.5 rounded-xl border text-xs font-mono transition-colors focus:outline-hidden focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] placeholder-[#64748B]' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* 2. Sede */}
            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Sede / Canteiro {isSedeLocked && <span className="text-[9px] lowercase font-normal text-blue-400">(fixo na sua OU)</span>}
              </label>
              <select
                value={isSedeLocked ? (activeCanteiro || '') : filters.sede}
                onChange={(e) => {
                  if (!isSedeLocked) {
                    setFilters({ ...filters, sede: e.target.value });
                  }
                }}
                disabled={isSedeLocked}
                className={`w-full px-2 py-1.5 rounded-xl border text-xs font-mono font-medium transition-colors focus:outline-hidden focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] disabled:opacity-85 disabled:cursor-not-allowed ${
                  isDark 
                    ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' 
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                {isSedeLocked ? (
                  <option value={activeCanteiro}>
                    {activeCanteiro} (Sua Unidade / OU)
                  </option>
                ) : (
                  <>
                    <option value="TODAS">Todas as Sedes / Canteiros</option>
                    {Array.isArray(constructionSites) && constructionSites.length > 0 ? (
                      constructionSites.map((site) => {
                        const code = (site.code || site.codigo || site.branch || site.sede || '').toUpperCase();
                        const name = site.name || site.nome || `Canteiro ${code}`;
                        return (
                          <option key={site.id || code} value={code}>
                            {code} ({name})
                          </option>
                        );
                      })
                    ) : (
                      <>
                        <option value="KO">KO (Coari)</option>
                        <option value="BE">BE (Belém)</option>
                        <option value="MN">MN (Manaus)</option>
                      </>
                    )}
                  </>
                )}
              </select>
            </div>

            {/* 3. Função */}
            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Função
              </label>
              <select
                value={filters.funcao}
                onChange={(e) => setFilters({ ...filters, funcao: e.target.value })}
                className={`w-full px-2 py-1.5 rounded-xl border text-xs font-mono transition-colors focus:outline-hidden focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] ${
                  isDark 
                    ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' 
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="TODAS">Todas as Funções</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* 4. Status do Banco */}
            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Status do Banco
              </label>
              <select
                value={filters.statusBanco}
                onChange={(e) => setFilters({ ...filters, statusBanco: e.target.value as any })}
                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-colors focus:outline-hidden focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] ${
                  isDark 
                    ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' 
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="TODOS">Todos os Saldos</option>
                <option value="CREDOR">🟢 Credores (&gt; 0h)</option>
                <option value="DEVEDOR">🔴 Devedores (&lt; 0h)</option>
                <option value="ZERADO">⚪ Zerados (= 0h)</option>
              </select>
            </div>

            {/* 5. Tipo de Ocorrência */}
            <div>
              <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Tipo de Ocorrência
              </label>
              <select
                value={filters.tipoOcorrencia}
                onChange={(e) => setFilters({ ...filters, tipoOcorrencia: e.target.value })}
                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-colors focus:outline-hidden focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] ${
                  isDark 
                    ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' 
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="TODOS">Todos os Tipos</option>
                <option value="TRABALHO">Horas Trabalhadas</option>
                <option value="FALTA_INJUSTIFICADA">Faltas ('F' / 'D')</option>
                <option value="ATESTADO_MEDICO">Atestados Médicos ('AT')</option>
                <option value="COMPENSACAO">Folgas Compensatórias</option>
                <option value="FERIAS">Férias</option>
                <option value="LICENCA">Licenças</option>
              </select>
            </div>

            {/* 6. Intervalo de Datas do Evento */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  De
                </label>
                <input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                  className={`w-full px-1.5 py-1.5 rounded-xl border text-[11px] font-mono transition-colors focus:outline-hidden focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' 
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  Até
                </label>
                <input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                  className={`w-full px-1.5 py-1.5 rounded-xl border text-[11px] font-mono transition-colors focus:outline-hidden focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' 
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER DE BASE ZERADA / PRONTA PARA IMPORTAÇÃO */}
      {employees.length === 0 && (
        <div className={`p-6 sm:p-8 rounded-2xl border transition-all text-center space-y-4 shadow-sm ${
          isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto border border-blue-500/20">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold">Base Pronta para Importação</h3>
            <p className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Base limpa. Importe seus colaboradores e histórico via CSV para iniciar a gestão.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onNavigateToEmployees && (
              <button
                onClick={onNavigateToEmployees}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>1. Importar Colaboradores (CSV)</span>
              </button>
            )}
            {onOpenImportRecordsModal && (
              <button
                onClick={onOpenImportRecordsModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-98 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>2. Importar Lançamentos de Horas (CSV)</span>
              </button>
            )}
            {onResetData && (
              <button
                onClick={onResetData}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all active:scale-[0.98] cursor-pointer ${
                  isDark 
                    ? 'bg-[#243756] text-[#94A3B8] hover:text-white border-[#335075]' 
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-300'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Recarregar Dados de Teste (Demo)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* CARDS DE MÉTRICAS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* KPI 1: Saldo Acumulado Geral */}
          <div className={`p-5 rounded-2xl border shadow-xs transition-all ${
            isDark 
              ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-bold uppercase font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                  Saldo Acumulado
                </p>
                <InfoTooltip 
                  theme={theme}
                  content="Soma líquida de todas as horas do banco após aplicação de multiplicadores SPTF (Seg-Sex 1.0x, Sáb 1.5x, Dom/Fer 2.0x, Falta -8h)."
                />
              </div>
              <div className={`p-1.5 rounded-lg ${
                kpis.saldoGeralHoras >= 0 
                  ? isDark ? 'bg-emerald-950/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                  : isDark ? 'bg-red-950/40 text-red-400' : 'bg-red-50 text-red-600'
              }`}>
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-mono font-light ${
              kpis.saldoGeralHoras >= 0 
                ? isDark ? 'text-green-400' : 'text-emerald-600' 
                : isDark ? 'text-red-400' : 'text-red-600'
            }`}>
              {formatHoursDecimal(kpis.saldoGeralHoras)}
            </h2>
            <p className={`text-[10px] mt-1.5 font-mono ${isDark ? 'text-green-400/80' : 'text-emerald-700'}`}>
              ≈ {formatHoursToDays(kpis.saldoGeralHoras)} (jornada 8h)
            </p>
          </div>

          {/* KPI 2: Colaboradores Ativos */}
          <div className={`p-5 rounded-2xl border shadow-xs transition-all ${
            isDark 
              ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-bold uppercase font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                  Colaboradores
                </p>
                <InfoTooltip 
                  theme={theme}
                  content="Quantidade de colaboradores com contrato ativo na base. Divididos entre quem possui horas a favor (credores) ou a compensar (devedores)."
                />
              </div>
              <div className={`p-1.5 rounded-lg ${isDark ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <Users className="w-4 h-4" />
              </div>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-mono font-light ${isDark ? 'text-[#E2E8F0]' : 'text-gray-900'}`}>
              {kpis.totalAtivos}
            </h2>
            <p className={`text-[10px] mt-1.5 font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
              <span className={isDark ? 'text-green-400' : 'text-emerald-600 font-semibold'}>{kpis.colaboradoresCredores}</span> credores • <span className={isDark ? 'text-red-400' : 'text-red-600 font-semibold'}>{kpis.colaboradoresDevedores}</span> devedores
            </p>
          </div>

          {/* KPI 3: Atestados (AT) */}
          <div className={`p-5 rounded-2xl border shadow-xs transition-all ${
            isDark 
              ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-bold uppercase font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                  Atestados (AT)
                </p>
                <InfoTooltip 
                  theme={theme}
                  content="Lançamentos de atestados médicos homologados com comprovante arquivado no Google Drive. Justificam o dia sem gerar débito no banco."
                />
              </div>
              <div className={`p-1.5 rounded-lg ${isDark ? 'bg-yellow-950/40 text-yellow-400' : 'bg-amber-50 text-amber-600'}`}>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-mono font-light ${isDark ? 'text-yellow-500' : 'text-amber-600'}`}>
              {kpis.totalAtestados}
            </h2>
            <p className={`text-[10px] mt-1.5 font-mono ${isDark ? 'text-yellow-500/80' : 'text-amber-700'}`}>
              Sáb {(kpis.totalHe50).toFixed(1)}h • Dom {(kpis.totalHe100).toFixed(1)}h adicionais
            </p>
          </div>

          {/* KPI 4: Faltas Injustificadas */}
          <div className={`p-5 rounded-2xl border shadow-xs transition-all ${
            isDark 
              ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-bold uppercase font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                  Faltas ('F' / 'D')
                </p>
                <InfoTooltip 
                  theme={theme}
                  content="Ausências sem justificativa legal homologada. Geram débito de 8.0h por ocorrência conforme SPTF Art. 59."
                />
              </div>
              <div className={`p-1.5 rounded-lg ${isDark ? 'bg-red-950/40 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <AlertOctagon className="w-4 h-4" />
              </div>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-mono font-light ${isDark ? 'text-red-500' : 'text-red-600'}`}>
              {kpis.totalFaltas.toString().padStart(2, '0')}
            </h2>
            <p className={`text-[10px] mt-1.5 font-mono ${isDark ? 'text-red-500/80' : 'text-red-700'}`}>
              Débito total de -{(kpis.totalFaltas * 8).toFixed(1)}h
            </p>
          </div>

          {/* KPI 5: Competência Contábil & Fechamento SPTF */}
          <div className={`p-5 rounded-2xl border shadow-xs transition-all flex flex-col justify-between ${
            estadoCorCompetencia.cor === 'VERMELHO'
              ? isDark 
                ? 'bg-[#16243D] border-rose-900/60 hover:border-rose-700/80 ring-1 ring-rose-500/20'
                : 'bg-white border-rose-300 hover:border-rose-400 ring-1 ring-rose-200'
              : estadoCorCompetencia.cor === 'AMARELO'
              ? isDark
                ? 'bg-[#16243D] border-amber-500/70 hover:border-amber-400 ring-1 ring-amber-500/30'
                : 'bg-white border-amber-400 hover:border-amber-500 ring-1 ring-amber-300/40'
              : isDark
                ? 'bg-[#16243D] border-emerald-500/60 hover:border-emerald-400 ring-1 ring-emerald-500/20'
                : 'bg-white border-emerald-300 hover:border-emerald-400 ring-1 ring-emerald-200'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-bold uppercase font-mono ${
                    estadoCorCompetencia.cor === 'VERMELHO'
                      ? isDark ? 'text-rose-400' : 'text-rose-700'
                      : estadoCorCompetencia.cor === 'AMARELO'
                      ? isDark ? 'text-amber-400' : 'text-amber-700'
                      : isDark ? 'text-emerald-400' : 'text-emerald-700'
                  }`}>
                    Competência
                  </p>
                  <InfoTooltip 
                    theme={theme}
                    content="Controle contábil mensal do SPTF: Vermelho quando fechado; Amarelo quando aberto com pendência no mês anterior ou meses passados; Verde quando aberto com todas as competências passadas devidamente fechadas."
                  />
                </div>
                <div className={`p-1.5 rounded-lg border ${
                  estadoCorCompetencia.cor === 'VERMELHO'
                    ? isDark ? 'bg-rose-950/50 text-rose-400 border-rose-800/60' : 'bg-rose-50 text-rose-600 border-rose-200'
                    : estadoCorCompetencia.cor === 'AMARELO'
                    ? isDark ? 'bg-amber-950/50 text-amber-400 border-amber-800/60' : 'bg-amber-50 text-amber-600 border-amber-200'
                    : isDark ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                }`}>
                  {estadoCorCompetencia.cor === 'VERMELHO' ? (
                    <Lock className="w-4 h-4" />
                  ) : estadoCorCompetencia.cor === 'AMARELO' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
              </div>

              {/* Seletor / Navegação de Mês */}
              <div className="flex items-center justify-between gap-1 my-1">
                {onSelectCompetencia ? (
                  <button
                    type="button"
                    id="btn-kpi-prev-competencia"
                    onClick={() => onSelectCompetencia(compAnterior)}
                    title={`Mês anterior (${compAnterior})`}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-slate-700/50 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                ) : <div className="w-4" />}

                <div className="text-center flex-1 min-w-0">
                  <h2 className={`text-base sm:text-lg font-mono font-medium truncate ${isDark ? 'text-[#E2E8F0]' : 'text-gray-900'}`}>
                    {mesNomeCompleto} / {anoStr}
                  </h2>
                  <p className={`text-[10px] font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                    ({compAtual})
                  </p>
                </div>

                {onSelectCompetencia ? (
                  <button
                    type="button"
                    id="btn-kpi-next-competencia"
                    onClick={() => onSelectCompetencia(compProxima)}
                    title={`Próximo mês (${compProxima})`}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-slate-700/50 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : <div className="w-4" />}
              </div>
            </div>

            {/* Status e Botão de Gestão */}
            <div className="mt-2 pt-2 border-t border-slate-700/20">
              {/* Alerta de pendência quando amarelo */}
              {estadoCorCompetencia.cor === 'AMARELO' && estadoCorCompetencia.temPendenciaAnterior && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono mb-2 border ${
                  isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-900'
                }`} title={`Competência anterior (${estadoCorCompetencia.mesesAnterioresAbertos.join(', ')}) pendente de homologação`}>
                  <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400" />
                  <span className="truncate">
                    {estadoCorCompetencia.mesesAnterioresAbertos.length === 1
                      ? `Mês anterior (${estadoCorCompetencia.mesesAnterioresAbertos[0]}) em aberto`
                      : `${estadoCorCompetencia.mesesAnterioresAbertos.length} meses passados em aberto`}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-1 text-[10px] font-mono mb-2">
                <span className={`inline-flex items-center gap-1 font-bold uppercase px-1.5 py-0.5 rounded border ${
                  estadoCorCompetencia.cor === 'VERMELHO'
                    ? isDark ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-rose-100 text-rose-700 border-rose-200'
                    : estadoCorCompetencia.cor === 'AMARELO'
                    ? isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-100 text-amber-800 border-amber-300'
                    : isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}>
                  {estadoCorCompetencia.cor === 'VERMELHO' ? (
                    <>
                      <Lock className="w-2.5 h-2.5 shrink-0" />
                      <span>Fechado</span>
                    </>
                  ) : estadoCorCompetencia.cor === 'AMARELO' ? (
                    <>
                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                      <span>{statusCompetencia === 'REABERTO' ? 'Reaberto' : 'Pendente Anterior'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                      <span>Aberto</span>
                    </>
                  )}
                </span>

                <span className={`text-[9px] font-semibold truncate ${
                  canteiroLiberado
                    ? isDark ? 'text-emerald-400/90' : 'text-emerald-600'
                    : isDark ? 'text-rose-400/90' : 'text-rose-600'
                }`} title={`Canteiro: ${normalizedCanteiro || 'TODAS'}`}>
                  {canteiroLiberado ? '✓ Liberado' : '⚠ Bloqueado'}
                </span>
              </div>

              {onOpenCompetenciaModal && (
                <button
                  type="button"
                  id="btn-kpi-gerenciar-competencia"
                  onClick={onOpenCompetenciaModal}
                  className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1.5 border active:scale-[0.98] cursor-pointer ${
                    estadoCorCompetencia.cor === 'VERMELHO'
                      ? isDark
                        ? 'bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/50'
                        : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                      : estadoCorCompetencia.cor === 'AMARELO'
                      ? isDark
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                      : isDark
                        ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-xs shadow-blue-600/20'
                        : 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-xs'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{estadoCorCompetencia.cor === 'VERMELHO' ? 'Ver Homologação' : 'Homologar / Fechar'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

      {/* DASHBOARD TAB NAVIGATION & CONTENT */}
      <div className={`rounded-2xl border flex flex-col overflow-hidden shadow-sm transition-colors ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-gray-200'
      }`}>
        {/* Tab Controls */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 border-b gap-2 ${
          isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center space-x-1.5 overflow-x-auto">
            {/* Aba 1: Resumo por Colaborador */}
            <button
              onClick={() => setActiveTab('colaboradores')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all active:scale-[0.98] flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'colaboradores'
                  ? isDark ? 'bg-[#243756] text-white border border-[#335075] shadow-xs' : 'bg-white text-blue-700 border border-gray-300 shadow-xs'
                  : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-500" />
              Resumo por Colaborador ({filteredEmployeesWithBalance.length})
            </button>

            {/* Aba 2: Visão Calendário Mensal */}
            <button
              onClick={() => setActiveTab('calendario')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all active:scale-[0.98] flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'calendario'
                  ? isDark ? 'bg-[#243756] text-white border border-[#335075] shadow-xs' : 'bg-white text-blue-700 border border-gray-300 shadow-xs'
                  : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              Visão Calendário
            </button>

            {/* Aba 3: Resumo por Sede - Oculto para Aux de DA */}
            {!isAuxDA && (
              <button
                onClick={() => setActiveTab('por_sede')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all active:scale-[0.98] flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'por_sede'
                    ? isDark ? 'bg-[#243756] text-white border border-[#335075] shadow-xs' : 'bg-white text-blue-700 border border-gray-300 shadow-xs'
                    : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-amber-500" />
                Resumo por Sede
              </button>
            )}

            {/* Aba 4: Lançamentos Individuais */}
            <button
              onClick={() => setActiveTab('extrato')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all active:scale-[0.98] flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'extrato'
                  ? isDark ? 'bg-[#243756] text-white border border-[#335075] shadow-xs' : 'bg-white text-blue-700 border border-gray-300 shadow-xs'
                  : isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
              Lançamentos Individuais ({filteredRecords.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Botão de Impressão da Relação Ordenada */}
            <button
              id="btn-print-dashboard-table"
              onClick={() => setIsPrintModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shadow-xs ${
                isDark
                  ? 'bg-[#1E2E4A] hover:bg-[#2A4068] text-blue-300 border-[#335075] hover:border-blue-400'
                  : 'bg-white hover:bg-blue-50/80 text-blue-700 border-slate-300 hover:border-blue-400'
              }`}
              title={`Imprimir relação na ordem atual (${
                sortField === 'saldo' 
                  ? (sortDirection === 'asc' ? 'Mais Devedores primeiro' : 'Mais Credores primeiro') 
                  : `Ordenado por ${sortField.toUpperCase()}`
              })`}
            >
              <Printer className="w-3.5 h-3.5 text-blue-500" />
              <span>Imprimir</span>
            </button>

            <span className={`text-[10px] font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
              {activeTab === 'colaboradores' && (
                <>Exibindo <strong className={isDark ? 'text-[#E2E8F0]' : 'text-gray-900'}>{filteredEmployeesWithBalance.length}</strong> colaboradores</>
              )}
              {activeTab === 'calendario' && (
                <>Visão Matricial de Apontamentos por Dia</>
              )}
              {activeTab === 'extrato' && (
                <>Exibindo <strong className={isDark ? 'text-[#E2E8F0]' : 'text-gray-900'}>{filteredRecords.length}</strong> lançamentos</>
              )}
              {activeTab === 'por_sede' && (
                <>Exibindo <strong className={isDark ? 'text-[#E2E8F0]' : 'text-gray-900'}>{branchSummary.length}</strong> sedes operacionais</>
              )}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: RELAÇÃO CONSOLIDADA DE COLABORADORES (TABELA PRINCIPAL)            */}
        {/* ========================================================================= */}
        {activeTab === 'colaboradores' && (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              {filteredEmployeesWithBalance.length === 0 ? (
                <div className={`text-center py-16 text-xs font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                  <Users className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-[#64748B]' : 'text-gray-400'}`} />
                  <p className={`font-semibold ${isDark ? 'text-[#E2E8F0]' : 'text-gray-800'}`}>Nenhum colaborador encontrado para os filtros selecionados.</p>
                  <p className={`mt-1 ${isDark ? 'text-[#64748B]' : 'text-gray-400'}`}>Ajuste a busca, sede, função ou período de datas no painel acima.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className={`sticky top-0 ${isDark ? 'bg-[#0F1B33]' : 'bg-gray-50'}`}>
                    <tr className={`text-[10px] uppercase font-bold border-b font-mono tracking-wider ${
                      isDark ? 'text-[#94A3B8] border-[#243756]' : 'text-gray-600 border-gray-200'
                    }`}>
                      {/* 1. MATRÍCULA (Esquerda) */}
                      <th className="py-3.5 px-5 text-left">
                        <button
                          onClick={() => handleSort('matricula')}
                          className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors active:scale-[0.98] uppercase font-bold cursor-pointer"
                          title="Clique para ordenar por Matrícula"
                        >
                          <span>MATRÍCULA</span>
                          {sortField === 'matricula' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      </th>

                      {/* 2. NOME (Esquerda) */}
                      <th className="py-3.5 px-5 text-left">
                        <button
                          onClick={() => handleSort('nome')}
                          className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors active:scale-[0.98] uppercase font-bold cursor-pointer"
                          title="Clique para ordenar por Nome"
                        >
                          <span>NOME</span>
                          {sortField === 'nome' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      </th>

                      {/* 3. SEDE (Centro) */}
                      <th className="py-3.5 px-5 text-center">
                        <button
                          onClick={() => handleSort('sede')}
                          className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors active:scale-[0.98] uppercase font-bold cursor-pointer"
                          title="Clique para ordenar por Sede"
                        >
                          <span>SEDE</span>
                          {sortField === 'sede' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      </th>

                      {/* 4. SALDO (Centro) */}
                      <th className="py-3.5 px-5 text-center">
                        <button
                          onClick={() => handleSort('saldo')}
                          className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors active:scale-[0.98] uppercase font-bold cursor-pointer"
                          title="Clique para ordenar por Saldo em Horas"
                        >
                          <span>SALDO</span>
                          {sortField === 'saldo' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      </th>

                      {/* 5. AÇÃO (EXTRATO) */}
                      <th className="py-3.5 px-5 text-right">
                        <span>AÇÃO</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`text-xs font-mono divide-y ${
                    isDark ? 'divide-[#243756] text-[#E2E8F0]' : 'divide-gray-200 text-gray-800'
                  }`}>
                    {paginatedEmployees.map((emp) => {
                      const isCredor = emp.saldoTotalHoras > 0.05;
                      const isDevedor = emp.saldoTotalHoras < -0.05;
                      const isZerado = !isCredor && !isDevedor;

                      return (
                        <tr 
                          key={emp.id || emp.matricula} 
                          className={`transition-colors ${isDark ? 'hover:bg-[#1E3252]' : 'hover:bg-blue-50/40'}`}
                        >
                          {/* 1. MATRÍCULA: Alinhado à esquerda */}
                          <td className="py-3.5 px-5 whitespace-nowrap text-left font-mono font-semibold">
                            <span className={`px-2 py-0.5 rounded text-xs border ${
                              isDark 
                                ? 'bg-[#243756] text-blue-400 border-[#335075]' 
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              #{emp.matricula}
                            </span>
                          </td>

                          {/* 2. NOME: Nome do colaborador + Badge com a Função/Cargo abaixo */}
                          <td className="py-3.5 px-5 font-sans text-left">
                            <div className="flex items-center gap-3">
                              {emp.avatarUrl || emp.url_foto_perfil ? (
                                <img
                                  src={emp.avatarUrl || emp.url_foto_perfil}
                                  alt={emp.nome}
                                  className={`w-8 h-8 rounded-full object-cover border shrink-0 ${
                                    isDark ? 'border-[#335075]' : 'border-gray-300'
                                  }`}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isDark 
                                    ? 'bg-[#243756] border-[#335075] text-blue-400' 
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}>
                                  {emp.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                </div>
                              )}
                              <div>
                                <button
                                  onClick={() => onViewEmployeeStatement(emp.matricula)}
                                  className={`font-semibold text-xs sm:text-sm hover:text-[#3B82F6] hover:underline text-left block transition-colors active:scale-[0.98] cursor-pointer ${
                                    isDark ? 'text-[#E2E8F0]' : 'text-gray-900'
                                  }`}
                                  title="Clique para abrir o extrato deste colaborador"
                                >
                                  {emp.nome}
                                </button>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-medium border ${
                                    isDark 
                                      ? 'bg-[#0F1B33] text-[#94A3B8] border-[#243756]' 
                                      : 'bg-gray-100 text-gray-700 border-gray-200'
                                  }`}>
                                    {emp.funcao || 'Operacional'}
                                  </span>
                                  {emp.status && (
                                    <span className={`text-[9px] font-mono font-medium px-1 rounded ${
                                      emp.status === 'Ativo'
                                        ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                                        : isDark ? 'text-rose-400' : 'text-rose-700'
                                    }`}>
                                      • {emp.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 3. SEDE: Badge da Sede (KO, BE, MN, etc.) - Centralizado */}
                          <td className="py-3.5 px-5 whitespace-nowrap text-center">
                            <span className={`px-2.5 py-1 border rounded-lg text-xs font-bold font-mono inline-block shadow-2xs ${
                              emp.sedeCodigo === 'KO'
                                ? isDark ? 'bg-blue-950/60 text-blue-300 border-blue-800/50' : 'bg-blue-50 text-blue-800 border-blue-200'
                                : emp.sedeCodigo === 'BE'
                                ? isDark ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isDark ? 'bg-purple-950/60 text-purple-300 border-purple-800/50' : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}>
                              {emp.sedeCodigo || 'Não informado'}
                            </span>
                          </td>

                          {/* 4. SALDO: Saldo total acumulado em horas - Destacado e centralizado */}
                          <td className="py-3.5 px-5 whitespace-nowrap text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className={`font-mono font-bold text-sm sm:text-base px-2.5 py-0.5 rounded-lg border ${
                                isCredor 
                                  ? isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isDevedor 
                                  ? isDark ? 'bg-rose-950/40 text-rose-400 border-rose-800/50' : 'bg-rose-50 text-rose-700 border-rose-200'
                                  : isDark ? 'bg-[#243756] text-[#94A3B8] border-[#335075]' : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}>
                                {formatHoursDecimal(emp.saldoTotalHoras)}
                              </span>
                              <span className={`text-[10px] font-mono mt-0.5 ${
                                isCredor 
                                  ? isDark ? 'text-emerald-400/80' : 'text-emerald-600'
                                  : isDevedor 
                                  ? isDark ? 'text-rose-400/80' : 'text-rose-600'
                                  : isDark ? 'text-[#94A3B8]' : 'text-gray-500'
                              }`}>
                                ≈ {formatHoursToDays(emp.saldoTotalHoras)}
                              </span>
                            </div>
                          </td>

                          {/* 5. AÇÃO (EXTRATO): Ação compacta com Tooltip */}
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <IconButton
                              icon={Eye}
                              variant="subtle"
                              size="sm"
                              tooltip={`Abrir Extrato Completo de ${emp.nome}`}
                              aria-label={`Extrato de ${emp.nome}`}
                              onClick={() => onViewEmployeeStatement(emp.matricula)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginação da Tabela de Colaboradores */}
            {filteredEmployeesWithBalance.length > 0 && (
              <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono ${
                isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={isDark ? 'text-[#94A3B8]' : 'text-gray-600'}>Linhas por página:</span>
                  <select
                    value={empPageSize}
                    onChange={(e) => {
                      setEmpPageSize(Number(e.target.value));
                      setEmpCurrentPage(1);
                    }}
                    className={`px-2 py-1 rounded border text-xs font-mono ${
                      isDark ? 'bg-[#16243D] border-[#243756] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className={`text-[11px] ml-2 ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                    Mostrando {Math.min((safeEmpCurrentPage - 1) * empPageSize + 1, sortedEmployees.length)} - {Math.min(safeEmpCurrentPage * empPageSize, sortedEmployees.length)} de {sortedEmployees.length}
                  </span>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setEmpCurrentPage(1)}
                    disabled={safeEmpCurrentPage === 1}
                    className={`p-1.5 rounded border transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    title="Primeira Página"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEmpCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={safeEmpCurrentPage === 1}
                    className={`p-1.5 rounded border transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className={`px-2 text-xs font-semibold ${isDark ? 'text-[#E2E8F0]' : 'text-gray-800'}`}>
                    Pág. {safeEmpCurrentPage} de {totalEmpPages}
                  </span>

                  <button
                    onClick={() => setEmpCurrentPage(prev => Math.min(prev + 1, totalEmpPages))}
                    disabled={safeEmpCurrentPage >= totalEmpPages}
                    className={`p-1.5 rounded border transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEmpCurrentPage(totalEmpPages)}
                    disabled={safeEmpCurrentPage >= totalEmpPages}
                    className={`p-1.5 rounded border transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    title="Última Página"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: VISÃO CALENDÁRIO MENSAL MATRIX                                     */}
        {/* ========================================================================= */}
        {activeTab === 'calendario' && (
          <div className="p-5">
            <ErrorBoundary fallbackTitle="Erro ao renderizar a matriz de calendário">
              <DashboardCalendarView
                employees={employees}
                records={records}
                onOpenNewEntryModal={onOpenNewEntryModal}
                onOpenEditEntryModal={onOpenEditEntryModal}
                onViewEmployeeStatement={onViewEmployeeStatement}
                onOpenQuickBatchModal={onOpenQuickBatchModal}
                onDeleteRecord={onDeleteRecord}
                theme={theme}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: RESUMO POR SEDE                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'por_sede' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {branchSummary.map((b) => (
                <div key={b.sede} className={`p-5 border rounded-xl space-y-3 transition-colors ${
                  isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <Building className="w-4 h-4" />
                      </div>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-[#E2E8F0]' : 'text-gray-900'}`}>Sede {b.sede}</h4>
                    </div>
                    <span className={`text-xs font-mono font-semibold px-2 py-0.5 border rounded ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#94A3B8]' : 'bg-white border-gray-200 text-gray-600'
                    }`}>
                      {b.colaboradores} colaboradores
                    </span>
                  </div>

                  <div className={`pt-2 border-t space-y-2 text-xs font-mono ${isDark ? 'border-[#243756]' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={isDark ? 'text-[#94A3B8]' : 'text-gray-500'}>Saldo Líquido da Base:</span>
                      <span className={`font-bold text-sm ${
                        b.saldoHoras >= 0 
                          ? isDark ? 'text-green-400' : 'text-emerald-600' 
                          : isDark ? 'text-red-400' : 'text-red-600'
                      }`}>
                        {formatHoursDecimal(b.saldoHoras)} ({formatHoursToDays(b.saldoHoras)})
                      </span>
                    </div>
                    <div className={`flex items-center justify-between ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                      <span>Total de Atestados:</span>
                      <span className={`font-semibold ${isDark ? 'text-yellow-400' : 'text-amber-600'}`}>{b.atestados}</span>
                    </div>
                    <div className={`flex items-center justify-between ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                      <span>Total de Faltas:</span>
                      <span className={`font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{b.faltas} (-{b.faltas * 8}h)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: LANÇAMENTOS INDIVIDUAIS (LISTA BRUTA)                              */}
        {/* ========================================================================= */}
        {activeTab === 'extrato' && (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              {filteredRecords.length === 0 ? (
                <div className={`text-center py-16 text-xs font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                  <FileText className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-[#64748B]' : 'text-gray-400'}`} />
                  <p className={`font-semibold ${isDark ? 'text-[#E2E8F0]' : 'text-gray-800'}`}>Nenhum registro encontrado para os filtros selecionados.</p>
                  <p className={`mt-1 ${isDark ? 'text-[#64748B]' : 'text-gray-400'}`}>Ajuste os filtros acima ou crie um novo lançamento diário.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className={`sticky top-0 ${isDark ? 'bg-[#0F1B33]' : 'bg-gray-50'}`}>
                    <tr className={`text-[10px] uppercase font-bold border-b font-mono tracking-wider ${
                      isDark ? 'text-[#94A3B8] border-[#243756]' : 'text-gray-600 border-gray-200'
                    }`}>
                      <th className="py-3 px-5">Data & Dia</th>
                      <th className="py-3 px-5">Matrícula</th>
                      <th className="py-3 px-5">Colaborador</th>
                      <th className="py-3 px-5">Sede</th>
                      <th className="py-3 px-5">Ocorrência</th>
                      <th className="py-3 px-5 text-right">Bruto (h)</th>
                      <th className="py-3 px-5 text-center">Mult.</th>
                      <th className="py-3 px-5 text-right">Saldo Líquido</th>
                      <th className="py-3 px-5 text-center">Drive</th>
                      <th className="py-3 px-5">Observação</th>
                      <th className="py-3 px-5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className={`text-xs font-mono divide-y ${
                    isDark ? 'divide-[#243756] text-[#E2E8F0]' : 'divide-gray-200 text-gray-800'
                  }`}>
                    {paginatedRecords.map((r) => {
                      const emp = employees.find(e => e.matricula === r.matricula);
                      const empName = r.employeeName || emp?.nome || 'Colaborador';
                      const empSede = r.employeeSede || emp?.sede || 'KO';
                      const empFuncao = r.employeeFuncao || emp?.funcao || '';

                      return (
                        <tr key={r.id} className={`transition-colors ${isDark ? 'hover:bg-[#1E3252]' : 'hover:bg-gray-50'}`}>
                          {/* Data & Dia */}
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <div className={`font-medium ${isDark ? 'text-[#E2E8F0]' : 'text-gray-900'}`}>{r.dataRegistro}</div>
                            <div className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                              {r.diaSemanaNome}
                              {r.eFeriado && (
                                <span className={`px-1 py-0.2 rounded text-[9px] border ${
                                  isDark 
                                    ? 'bg-purple-950/60 text-purple-300 border-purple-800/40' 
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`} title={r.nomeFeriado || 'Feriado'}>
                                  FERIADO
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Matrícula */}
                          <td className={`py-3.5 px-5 whitespace-nowrap ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                            #{r.matricula}
                          </td>

                          {/* Colaborador */}
                          <td className="py-3.5 px-5 font-sans">
                            <div className="flex items-center gap-2.5">
                              {emp?.avatarUrl || emp?.url_foto_perfil ? (
                                <img
                                  src={emp.avatarUrl || emp.url_foto_perfil}
                                  alt={empName}
                                  className={`w-7 h-7 rounded-full object-cover border shrink-0 ${
                                    isDark ? 'border-[#335075]' : 'border-gray-300'
                                  }`}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                  isDark 
                                    ? 'bg-[#243756] border-[#335075] text-blue-400' 
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}>
                                  {empName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                </div>
                              )}
                              <div>
                                <button
                                  onClick={() => onViewEmployeeStatement(r.matricula)}
                                  className={`font-medium hover:text-[#3B82F6] hover:underline text-left block text-xs cursor-pointer ${
                                    isDark ? 'text-[#E2E8F0]' : 'text-gray-900'
                                  }`}
                                >
                                  {empName}
                                </button>
                                <span className={`text-[10px] font-mono ${isDark ? 'text-[#64748B]' : 'text-gray-400'}`}>{empFuncao}</span>
                              </div>
                            </div>
                          </td>

                          {/* Sede */}
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 border rounded text-[10px] font-bold ${
                              isDark 
                                ? 'bg-[#243756] text-[#E2E8F0] border-[#335075]' 
                                : 'bg-gray-100 text-gray-800 border-gray-300'
                            }`}>
                              {empSede}
                            </span>
                          </td>

                          {/* Tipo de Ocorrência */}
                          <td className="py-3.5 px-5 whitespace-nowrap font-mono">
                            {r.tipoOcorrencia === 'TRABALHO' && (
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                                isDark 
                                  ? 'bg-blue-900/40 text-blue-400 border-blue-800/40' 
                                  : 'bg-blue-50 text-blue-700 border-blue-200 font-medium'
                              }`}>
                                TRABALHO
                              </span>
                            )}
                            {r.tipoOcorrencia === 'FALTA_INJUSTIFICADA' && (
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                                isDark 
                                  ? 'bg-red-900/40 text-red-400 border-red-800/40' 
                                  : 'bg-red-50 text-red-700 border-red-200 font-medium'
                              }`}>
                                FALTA (-8h)
                              </span>
                            )}
                            {r.tipoOcorrencia === 'ATESTADO_MEDICO' && (
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                                isDark 
                                  ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800/40' 
                                  : 'bg-amber-50 text-amber-800 border-amber-200 font-medium'
                              }`}>
                                ATESTADO (AT)
                              </span>
                            )}
                            {r.tipoOcorrencia === 'COMPENSACAO' && (
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                                isDark 
                                  ? 'bg-amber-900/40 text-amber-400 border-amber-800/40' 
                                  : 'bg-orange-50 text-orange-800 border-orange-200 font-medium'
                              }`}>
                                FOLGA COMP.
                              </span>
                            )}
                            {r.tipoOcorrencia === 'FERIAS' && (
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                                isDark 
                                  ? 'bg-indigo-900/40 text-indigo-400 border-indigo-800/40' 
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium'
                              }`}>
                                FÉRIAS
                              </span>
                            )}
                            {r.tipoOcorrencia === 'LICENCA' && (
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${
                                isDark 
                                  ? 'bg-teal-900/40 text-teal-400 border-teal-800/40' 
                                  : 'bg-teal-50 text-teal-700 border-teal-200 font-medium'
                              }`}>
                                LICENÇA
                              </span>
                            )}
                          </td>

                          {/* Horas Brutas */}
                          <td className={`py-3.5 px-5 text-right whitespace-nowrap ${isDark ? 'text-[#94A3B8]' : 'text-gray-600'}`}>
                            {r.horasBrutas > 0 ? `${r.horasBrutas.toFixed(1)}h` : '- -'}
                          </td>

                          {/* Multiplicador */}
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              r.multiplicador === 2.0 
                                ? isDark ? 'bg-purple-900/40 text-purple-300 border-purple-800/40' : 'bg-purple-50 text-purple-700 border-purple-200'
                                : r.multiplicador === 1.5 
                                ? isDark ? 'bg-amber-900/40 text-amber-300 border-amber-800/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                                : r.multiplicador === 1.0 
                                ? isDark ? 'bg-[#243756] text-[#94A3B8] border-[#335075]' : 'bg-gray-100 text-gray-700 border-gray-300'
                                : 'bg-transparent text-gray-400 border-transparent'
                            }`}>
                              {r.multiplicador > 0 ? `${r.multiplicador.toFixed(1)}x` : 'ISENTO'}
                            </span>
                          </td>

                          {/* Saldo Calculado */}
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <span className={`font-bold text-xs ${
                              r.saldoCalculado > 0 
                                ? isDark ? 'text-green-400' : 'text-emerald-600' 
                                : r.saldoCalculado < 0 
                                ? isDark ? 'text-red-400' : 'text-red-600' 
                                : isDark ? 'text-[#94A3B8]' : 'text-gray-500'
                            }`}>
                              {formatHoursDecimal(r.saldoCalculado)}
                            </span>
                          </td>

                          {/* Comprovante Drive */}
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            {r.comprovante ? (
                              <IconButton
                                icon={FileText}
                                variant="success"
                                size="xs"
                                tooltip="Visualizar Comprovante / Anexo no Google Drive"
                                aria-label="Visualizar Anexo Drive"
                                onClick={() => onViewAttachment(r.comprovante!, empName, r.dataRegistro)}
                              />
                            ) : (
                              <span className={isDark ? 'text-[#64748B] text-[11px]' : 'text-gray-300 text-[11px]'}>—</span>
                            )}
                          </td>

                          {/* Observação */}
                          <td className={`py-3.5 px-5 max-w-xs truncate text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`} title={r.observacao}>
                            {r.observacao || '—'}
                          </td>

                          {/* Ação */}
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <IconButton
                              icon={Eye}
                              variant="subtle"
                              size="xs"
                              tooltip={`Abrir Extrato de ${empName}`}
                              aria-label={`Extrato de ${empName}`}
                              onClick={() => onViewEmployeeStatement(r.matricula)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginação dos Registros Brutos */}
            {filteredRecords.length > 0 && (
              <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono ${
                isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={isDark ? 'text-[#94A3B8]' : 'text-gray-600'}>Linhas por página:</span>
                  <select
                    value={recordsPageSize}
                    onChange={(e) => {
                      setRecordsPageSize(Number(e.target.value));
                      setRecordsCurrentPage(1);
                    }}
                    className={`px-2 py-1 rounded border text-xs font-mono ${
                      isDark ? 'bg-[#16243D] border-[#243756] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-800'
                    }`}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className={`text-[11px] ml-2 ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                    Mostrando {Math.min((safeRecordsCurrentPage - 1) * recordsPageSize + 1, filteredRecords.length)} - {Math.min(safeRecordsCurrentPage * recordsPageSize, filteredRecords.length)} de {filteredRecords.length}
                  </span>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setRecordsCurrentPage(1)}
                    disabled={safeRecordsCurrentPage === 1}
                    className={`p-1.5 rounded border transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    title="Primeira Página"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRecordsCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={safeRecordsCurrentPage === 1}
                    className={`p-1.5 rounded border transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className={`px-2 text-xs font-semibold ${isDark ? 'text-[#E2E8F0]' : 'text-gray-800'}`}>
                    Pág. {safeRecordsCurrentPage} de {totalRecordsPages}
                  </span>

                  <button
                    onClick={() => setRecordsCurrentPage(prev => Math.min(prev + 1, totalRecordsPages))}
                    disabled={safeRecordsCurrentPage >= totalRecordsPages}
                    className={`p-1.5 rounded border transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRecordsCurrentPage(totalRecordsPages)}
                    disabled={safeRecordsCurrentPage >= totalRecordsPages}
                    className={`p-1.5 rounded border transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark ? 'bg-[#243756] border-[#335075] text-[#E2E8F0]' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                    title="Última Página"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer info in tab container */}
        <div className={`p-3.5 border-t flex justify-between items-center text-xs ${
          isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex gap-2 items-center">
            <div className="w-2 h-2 bg-[#3B82F6] rounded-full animate-pulse"></div>
            <span className={`text-[10px] font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
              Processamento em tempo real (SPTF Engine)
            </span>
          </div>
          <span className={`text-[10px] font-mono ${isDark ? 'text-[#64748B]' : 'text-gray-400'}`}>
            Base sincronizada Cloud Firestore
          </span>
        </div>
      </div>

      {/* MODAL DE IMPRESSÃO DA RELAÇÃO ORDENADA DE COLABORADORES */}
      <CollaboratorBalancesPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        employees={sortedEmployees}
        sortField={sortField}
        sortDirection={sortDirection}
        filters={filters}
        theme={theme}
      />
    </div>
  );
};
