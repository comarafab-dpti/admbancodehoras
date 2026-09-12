import React, { useState, useMemo } from 'react';
import { Employee, Branch, InsalubrityRecord, GrauInsalubridade, SystemConfig, ConstructionSite, AdminRole } from '@/src/shared/types';
import { dbService } from '@/src/shared/services/dbService';
import { orderBy, where } from '@/src/shared/services/db';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { InsalubritySimpleMatrixView } from './InsalubritySimpleMatrixView';
import { InsalubrityConversionModal } from './InsalubrityConversionModal';
import { InfoTooltip } from '@/src/shared/components/InfoTooltip';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Pencil,
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Building2, 
  User, 
  HardHat, 
  Activity, 
  Sparkles, 
  Info, 
  X, 
  FileSpreadsheet, 
  Download, 
  Flame, 
  Droplets, 
  Layers, 
  HelpCircle, 
  TrendingUp, 
  Settings2, 
  Table,
  ArrowRightLeft
} from 'lucide-react';

interface InsalubrityManagementProps {
  employees: Employee[];
  insalubrityRecords: InsalubrityRecord[];
  onSaveRecord: (record: InsalubrityRecord) => Promise<void>;
  onSaveBatchRecords?: (records: InsalubrityRecord[]) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onUpdateEmployeeGrauFixa?: (empId: string, grau: GrauInsalubridade) => Promise<void>;
  onUpdateEmployees?: (employees: Employee[]) => Promise<void> | void;
  onNavigateToReports?: () => void;
  onFetchPeriod?: (startDate: string, endDate: string, forceRefresh?: boolean) => Promise<InsalubrityRecord[]>;
  systemConfig?: SystemConfig;
  onUpdateSystemConfig?: (cfg: SystemConfig) => Promise<void>;
  constructionSites?: ConstructionSite[];
  currentUserEmail?: string;
  userRole?: string;
  theme?: 'dark' | 'light';
}

const ATIVIDADES_TIPICAS_COMARA = [
  { nome: 'Aplicação e espalhamento de emulsão asfáltica / massa a quente', grau: '40%' as const, desc: 'Contato com hidrocarbonetos aromáticos e alcatrão (Anexo 13)' },
  { nome: 'Operação de britador e moagem de agregados (Poeira mineral)', grau: '20%' as const, desc: 'Poeiras minerais e particulados respiráveis (Anexo 12)' },
  { nome: 'Manutenção de maquinário pesado (Óleos e graxas minerais)', grau: '20%' as const, desc: 'Manipulação de lubrificantes e desengraxantes (Anexo 13)' },
  { nome: 'Pintura de sinalização de pista a pistola com solventes', grau: '20%' as const, desc: 'Vapores orgânicos e névoas de solvente (Anexo 11/13)' },
  { nome: 'Trabalho contínuo em câmara frigorífica de víveres', grau: '20%' as const, desc: 'Exposição ao frio artificial sem proteção integral (Anexo 9)' },
  { nome: 'Limpeza de caixas de decantação, esgoto e fossas sépticas', grau: '40%' as const, desc: 'Agentes biológicos e galerias sanitárias (Anexo 14)' },
  { nome: 'Operação de compactadores de solo e britadores (Vibração e Ruído)', grau: '20%' as const, desc: 'Exposição a ruído de impacto e vibrações contínuas (Anexo 1/8)' },
  { nome: 'Manipulação de cimento em betoneiras e silos em pó', grau: '20%' as const, desc: 'Poeiras alcalinas de cimento e cal (Anexo 13)' },
];

export const InsalubrityManagement: React.FC<InsalubrityManagementProps> = ({
  employees,
  insalubrityRecords,
  onSaveRecord,
  onSaveBatchRecords,
  onDeleteRecord,
  onUpdateEmployeeGrauFixa,
  onUpdateEmployees,
  onNavigateToReports,
  onFetchPeriod,
  systemConfig,
  onUpdateSystemConfig,
  constructionSites = [],
  currentUserEmail = 'coari.comara@gmail.com',
  userRole,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const isAuxDA = userRole === 'AUX_DA' || userRole === 'AUXILIAR_DA';

  // Modo de visualização: 'SIMPLES' (Matriz Planilha) vs 'COMPLETA' (Apontamentos e Fichas)
  const [currentMode, setCurrentMode] = useState<'SIMPLES' | 'COMPLETA'>(
    isAuxDA ? 'SIMPLES' : (systemConfig?.insalubrityMode || 'SIMPLES')
  );

  React.useEffect(() => {
    if (isAuxDA && currentMode !== 'SIMPLES') {
      setCurrentMode('SIMPLES');
    }
  }, [isAuxDA, currentMode]);

  // Sub-view no Modo Completo: 'ATIVIDADES' | 'FIXA' | 'GUIA_NR15'
  const [activeSubTab, setActiveSubTab] = useState<'ATIVIDADES' | 'FIXA' | 'GUIA_NR15'>('ATIVIDADES');
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);

  const handleToggleMode = async (newMode: 'SIMPLES' | 'COMPLETA') => {
    setCurrentMode(newMode);
    if (onUpdateSystemConfig && systemConfig) {
      try {
        await onUpdateSystemConfig({
          ...systemConfig,
          insalubrityMode: newMode,
        });
      } catch (err) {
        console.error('Erro ao atualizar modo nas configurações:', err);
      }
    }
  };

  // Filters for Atividades table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('TODAS');
  const [selectedGrau, setSelectedGrau] = useState<string>('TODOS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [recordPage, setRecordPage] = useState(1);
  const [pagedRecords, setPagedRecords] = useState<InsalubrityRecord[]>([]);
  const [pagedRecordTotal, setPagedRecordTotal] = useState(0);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  React.useEffect(() => {
    let cancelled = false;
    const constraints: any[] = [orderBy('dataEvento', 'desc')];
    if (selectedBranch !== 'TODAS') constraints.push(where('sede', '==', selectedBranch));
    if (startDate) constraints.push(where('dataEvento', '>=', startDate));
    if (endDate) constraints.push(where('dataEvento', '<=', endDate));
    const search = debouncedSearchQuery.trim().toUpperCase();
    if (search) constraints.push(where('matricula', '==', search));

    setIsPageLoading(true);
    dbService.getCollectionPage('insalubridade_records', recordPage, 50, constraints)
      .then((result) => {
        if (cancelled) return;
        setPagedRecords(result.snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id, matricula: data.matricula || '', nomeColaborador: data.nomeColaborador || '',
            sede: data.sede || 'SEDE', funcao: data.funcao || 'Operacional', dataEvento: data.dataEvento || '',
            atividadeDesempenhada: data.atividadeDesempenhada || '', grauExposicao: data.grauExposicao || '20%',
            quantidadeHorasDias: Number(data.quantidadeHorasDias || 1), unidade: data.unidade || 'DIAS',
            responsavelLancamento: data.responsavelLancamento || '', observacoes: data.observacoes || '',
            criadoEm: data.criadoEm || '', criadoPorEmail: data.criadoPorEmail,
          } as InsalubrityRecord;
        }));
        setPagedRecordTotal(result.total);
        setIsPageLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setPagedRecords([]); setPagedRecordTotal(0); setIsPageLoading(false); }
      });
    return () => { cancelled = true; };
  }, [recordPage, debouncedSearchQuery, selectedBranch, startDate, endDate]);

  React.useEffect(() => setRecordPage(1), [debouncedSearchQuery, selectedBranch, startDate, endDate]);

  // Modal: Novo / Editar Lançamento de Atividade
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InsalubrityRecord | null>(null);
  const [formMatricula, setFormMatricula] = useState('');
  const [formDataEvento, setFormDataEvento] = useState(new Date().toISOString().split('T')[0]);
  const [formAtividade, setFormAtividade] = useState('');
  const [formGrau, setFormGrau] = useState<'10%' | '20%' | '40%'>('20%');
  const [formQuantidade, setFormQuantidade] = useState<number>(8);
  const [formUnidade, setFormUnidade] = useState<'HORAS' | 'DIAS'>('HORAS');
  const [formResponsavel, setFormResponsavel] = useState('Encarregado de Campo');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleOpenNewModal = () => {
    setEditingRecord(null);
    setFormMatricula('');
    setFormDataEvento(new Date().toISOString().split('T')[0]);
    setFormAtividade('');
    setFormGrau('20%');
    setFormQuantidade(8);
    setFormUnidade('HORAS');
    setFormResponsavel('Encarregado de Campo');
    setFormObservacoes('');
    setFormFeedback(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rec: InsalubrityRecord) => {
    setEditingRecord(rec);
    setFormMatricula(rec.matricula);
    setFormDataEvento(rec.dataEvento || new Date().toISOString().split('T')[0]);
    setFormAtividade(rec.atividadeDesempenhada || '');
    setFormGrau((rec.grauExposicao as any) || '20%');
    setFormQuantidade(Number(rec.quantidadeHorasDias) || 8);
    setFormUnidade(rec.unidade || 'HORAS');
    setFormResponsavel(rec.responsavelLancamento || 'Encarregado de Campo');
    setFormObservacoes(rec.observacoes || '');
    setFormFeedback(null);
    setIsModalOpen(true);
  };

  // Selected Employee Helper for Form
  const selectedEmployeeInForm = useMemo(() => {
    if (!formMatricula) return null;
    const clean = formMatricula.trim().toUpperCase();
    return employees.find(
      (e) => e.matricula.trim().toUpperCase() === clean ||
             e.matricula.replace(/^0+/, '').toUpperCase() === clean.replace(/^0+/, '')
    ) || null;
  }, [formMatricula, employees]);

  // Statistics
  const stats = useMemo(() => {
    if (!employees || employees.length === 0) {
      return {
        fixedCount: {
          isento: 0,
          g10: 0,
          g20: 0,
          g40: 0,
          totalComAdicional: 0,
        },
        totalAtividadesLancadas: 0,
        totalHorasAtividade: 0,
        totalDiasAtividade: 0,
      };
    }

    const registeredMatriculas = new Set(employees.map(e => e.matricula.trim().toUpperCase()));
    const validInsalubrityRecords = insalubrityRecords.filter(r => 
      registeredMatriculas.has((r.matricula || '').trim().toUpperCase())
    );

    const fixedCount = {
      isento: employees.filter(e => !e.grauInsalubridadeFixa || e.grauInsalubridadeFixa === 'ISENTO').length,
      g10: employees.filter(e => e.grauInsalubridadeFixa === '10%').length,
      g20: employees.filter(e => e.grauInsalubridadeFixa === '20%').length,
      g40: employees.filter(e => e.grauInsalubridadeFixa === '40%').length,
      totalComAdicional: employees.filter(e => e.grauInsalubridadeFixa && e.grauInsalubridadeFixa !== 'ISENTO').length,
    };

    const totalAtividadesLancadas = validInsalubrityRecords.length;
    const totalHorasAtividade = validInsalubrityRecords
      .filter(r => r.unidade === 'HORAS')
      .reduce((acc, curr) => acc + (Number(curr.quantidadeHorasDias) || 0), 0);
    const totalDiasAtividade = validInsalubrityRecords
      .filter(r => r.unidade === 'DIAS')
      .reduce((acc, curr) => acc + (Number(curr.quantidadeHorasDias) || 0), 0);

    return {
      fixedCount,
      totalAtividadesLancadas,
      totalHorasAtividade,
      totalDiasAtividade,
    };
  }, [employees, insalubrityRecords]);

  // Filtered Records for Atividades
  const filteredRecords = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const registeredMatriculas = new Set(employees.map(e => e.matricula.trim().toUpperCase()));

    return pagedRecords.filter((rec) => {
      if (!registeredMatriculas.has((rec.matricula || '').trim().toUpperCase())) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = rec.nomeColaborador.toLowerCase().includes(q);
        const matchMat = rec.matricula.toLowerCase().includes(q);
        const matchAtiv = rec.atividadeDesempenhada.toLowerCase().includes(q);
        const matchResp = rec.responsavelLancamento.toLowerCase().includes(q);
        if (!matchName && !matchMat && !matchAtiv && !matchResp) return false;
      }

      // Branch
      if (selectedBranch !== 'TODAS' && rec.sede !== selectedBranch) {
        return false;
      }

      // Grau
      if (selectedGrau !== 'TODOS' && rec.grauExposicao !== selectedGrau) {
        return false;
      }

      // Dates
      if (startDate && rec.dataEvento < startDate) return false;
      if (endDate && rec.dataEvento > endDate) return false;

      return true;
    });
  }, [employees, pagedRecords, searchQuery, selectedBranch, selectedGrau, startDate, endDate]);

  // Handle Form Submit
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    if (!selectedEmployeeInForm) {
      setFormFeedback({ type: 'error', text: 'Selecione um colaborador válido para registrar o evento.' });
      return;
    }

    if (!formAtividade.trim()) {
      setFormFeedback({ type: 'error', text: 'Informe a atividade insalubre desempenhada.' });
      return;
    }

    if (formQuantidade <= 0) {
      setFormFeedback({ type: 'error', text: 'A quantidade de horas/dias deve ser maior que zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const recToSave: InsalubrityRecord = {
        id: editingRecord ? editingRecord.id : `ins-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        matricula: selectedEmployeeInForm.matricula,
        nomeColaborador: selectedEmployeeInForm.nome,
        sede: selectedEmployeeInForm.sedeCodigo || selectedEmployeeInForm.sede_atual || selectedEmployeeInForm.sede || 'KO',
        funcao: selectedEmployeeInForm.funcao || selectedEmployeeInForm.cargo || 'Operacional',
        dataEvento: formDataEvento,
        atividadeDesempenhada: formAtividade.trim(),
        grauExposicao: formGrau,
        quantidadeHorasDias: Number(formQuantidade),
        unidade: formUnidade,
        responsavelLancamento: formResponsavel.trim() || 'Encarregado de Campo',
        observacoes: formObservacoes.trim(),
        criadoEm: editingRecord ? editingRecord.criadoEm : new Date().toISOString(),
        criadoPorEmail: editingRecord ? editingRecord.criadoPorEmail : currentUserEmail,
        ...(editingRecord ? { atualizadoEm: new Date().toISOString(), atualizadoPorEmail: currentUserEmail } : {})
      };

      await onSaveRecord(recToSave);
      setFormFeedback({
        type: 'success',
        text: editingRecord
          ? 'Lançamento de insalubridade corrigido e atualizado com sucesso!'
          : 'Atividade insalubre lançada com sucesso no Firestore!'
      });
      setTimeout(() => {
        setIsModalOpen(false);
        setEditingRecord(null);
        setFormAtividade('');
        setFormObservacoes('');
        setFormFeedback(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setFormFeedback({ type: 'error', text: err?.message || 'Falha ao salvar lançamento de insalubridade.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente remover o registro de atividade insalubre de "${name}"?`)) {
      try {
        await onDeleteRecord(id);
      } catch (err: any) {
        alert(`Erro ao excluir: ${err?.message || 'Falha na exclusão'}`);
      }
    }
  };

  // Quick select activity preset
  const handleSelectPreset = (preset: typeof ATIVIDADES_TIPICAS_COMARA[0]) => {
    setFormAtividade(preset.nome);
    setFormGrau(preset.grau);
  };

  // Helper for badge colors
  const getGrauBadge = (grau: string) => {
    switch (grau) {
      case '40%':
        return isDark 
          ? 'bg-red-500/15 text-red-400 border border-red-500/30' 
          : 'bg-red-50 text-red-700 border border-red-200';
      case '20%':
        return isDark 
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
          : 'bg-amber-50 text-amber-700 border border-amber-200';
      case '10%':
        return isDark 
          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' 
          : 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return isDark 
          ? 'bg-gray-800 text-gray-400 border border-gray-700' 
          : 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{isPageLoading ? 'Carregando registros...' : `${pagedRecordTotal.toLocaleString('pt-BR')} registros`}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={recordPage <= 1} onClick={() => setRecordPage((page) => page - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Anterior</button>
          <span>Página {recordPage} de {Math.max(1, Math.ceil(pagedRecordTotal / 50))}</span>
          <button type="button" disabled={recordPage >= Math.max(1, Math.ceil(pagedRecordTotal / 50))} onClick={() => setRecordPage((page) => page + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Próxima</button>
        </div>
      </div>
      {/* RENDERIZAÇÃO CONDICIONAL POR MODO */}
      {currentMode === 'SIMPLES' || isAuxDA ? (
        <InsalubritySimpleMatrixView
          employees={employees}
          insalubrityRecords={insalubrityRecords}
          onSaveRecord={onSaveRecord}
          onSaveBatchRecords={onSaveBatchRecords}
          onDeleteRecord={onDeleteRecord}
          onUpdateEmployees={onUpdateEmployees}
          onFetchPeriod={onFetchPeriod}
          constructionSites={constructionSites}
          currentUserEmail={currentUserEmail}
          userRole={userRole as AdminRole}
          theme={theme}
          onSwitchToCompleteMode={isAuxDA ? undefined : () => handleToggleMode('COMPLETA')}
          onOpenConversionModal={() => setIsConversionModalOpen(true)}
          onNavigateToReports={onNavigateToReports}
        />
      ) : (
        <>
          {/* ------------------------------------------------------------- */}
          {/* 1. CABEÇALHO DO MÓDULO */}
          {/* ------------------------------------------------------------- */}
          <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                <HardHat className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className={`text-lg sm:text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Gestão de Insalubridade
                  </h1>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    NR-15 • COMARA
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    Fixa vs Por Atividade
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Adicionais fixos e apontamentos <InfoTooltip theme={isDark ? 'dark' : 'light'} content="Controle de adicionais fixos contratuais e apontamentos de atividades insalubres em canteiros de obras" />
              </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {onNavigateToReports && (
                <button
                  onClick={onNavigateToReports}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Relatórios Executivos</span>
                </button>
              )}

              <button
                onClick={handleOpenNewModal}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-amber-600/20 active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Lançar Atividade Insalubre</span>
              </button>
            </div>
          </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. CARDS DE INDICADORES / METRICAS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total com Adicional Fixo */}
        <div className={`p-5 rounded-2xl border ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-bold ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>INSALUBRIDADE FIXA</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {stats.fixedCount.totalComAdicional}
            </span>
            <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              colaboradores
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">40%: {stats.fixedCount.g40}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">20%: {stats.fixedCount.g20}</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">10%: {stats.fixedCount.g10}</span>
          </div>
        </div>

        {/* Card 2: Colaboradores Isentos */}
        <div className={`p-5 rounded-2xl border ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-bold ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>ISENTOS DE ADICIONAL FIXO</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {stats.fixedCount.isento}
            </span>
            <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              de {employees.length} efetivo total
            </span>
          </div>
          <p className={`text-[11px] mt-3 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            Apenas recebem quando houver lançamento por atividade
          </p>
        </div>

        {/* Card 3: Eventos Pontuais Lançados */}
        <div className={`p-5 rounded-2xl border ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-bold ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>EVENTOS DE ATIVIDADE</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {stats.totalAtividadesLancadas}
            </span>
            <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              apontamentos
            </span>
          </div>
          <p className={`text-[11px] mt-3 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            Registros pontuais de serviços com agentes nocivos
          </p>
        </div>

        {/* Card 4: Volume Exposto em Horas/Dias */}
        <div className={`p-5 rounded-2xl border ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={`font-bold ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>TEMPO EXPOSTO APONTADO</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              {stats.totalHorasAtividade}h
            </span>
            <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              + {stats.totalDiasAtividade} dias
            </span>
          </div>
          <p className={`text-[11px] mt-3 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            Cálculo proporcional para folha de pagamento
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. NAVEGAÇÃO DE SUB-ABAS */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 border-b pb-3">
        <button
          onClick={() => setActiveSubTab('ATIVIDADES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'ATIVIDADES'
              ? isDark 
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
                : 'bg-amber-50 text-amber-700 border border-amber-200'
              : isDark 
                ? 'text-[#94A3B8] hover:bg-[#16243D]' 
                : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Apontamentos por Atividade ({stats.totalAtividadesLancadas})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('FIXA')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'FIXA'
              ? isDark 
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
              : isDark 
                ? 'text-[#94A3B8] hover:bg-[#16243D]' 
                : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Insalubridade Fixa em Ficha ({stats.fixedCount.totalComAdicional})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('GUIA_NR15')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'GUIA_NR15'
              ? isDark 
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' 
                : 'bg-purple-50 text-purple-700 border border-purple-200'
              : isDark 
                ? 'text-[#94A3B8] hover:bg-[#16243D]' 
                : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Guia Técnico NR-15 (COMARA)</span>
        </button>
      </div>

      {/* ============================================================= */}
      {/* SUB-VIEW 1: APONTAMENTOS POR ATIVIDADE                         */}
      {/* ============================================================= */}
      {activeSubTab === 'ATIVIDADES' && (
        <div className="space-y-4">
          {/* Filtros Bar */}
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center justify-between ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            <div className="relative w-full md:w-80">
              <Search className={`w-4 h-4 absolute left-3 top-3 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar por colaborador, matrícula ou atividade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-hidden transition-colors ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                }`}
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              {/* Sede */}
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className={`px-3 py-2 rounded-xl border text-xs outline-hidden ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="TODAS">Sede / Canteiro: Todas</option>
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
                    <option value="SP">SP (São Paulo)</option>
                    <option value="RJ">RJ (Rio de Janeiro)</option>
                  </>
                )}
              </select>

              {/* Grau */}
              <select
                value={selectedGrau}
                onChange={(e) => setSelectedGrau(e.target.value)}
                className={`px-3 py-2 rounded-xl border text-xs outline-hidden ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="TODOS">Grau: Todos</option>
                <option value="40%">40% (Máximo)</option>
                <option value="20%">20% (Médio)</option>
                <option value="10%">10% (Mínimo)</option>
              </select>

              {/* Data Início */}
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Data Inicial"
                className={`px-2.5 py-2 rounded-xl border text-xs outline-hidden ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />

              {/* Data Fim */}
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="Data Final"
                className={`px-2.5 py-2 rounded-xl border text-xs outline-hidden ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />

              {(searchQuery || selectedBranch !== 'TODAS' || selectedGrau !== 'TODOS' || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedBranch('TODAS');
                    setSelectedGrau('TODOS');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors active:scale-[0.98] cursor-pointer ${
                    isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Lançamentos */}
          <div className={`rounded-2xl border overflow-hidden shadow-xs ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b font-bold uppercase tracking-wider text-[11px] ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    <th className="p-3.5">Data Evento</th>
                    <th className="p-3.5">Colaborador / Matrícula</th>
                    <th className="p-3.5">Sede / Função</th>
                    <th className="p-3.5">Atividade Desempenhada</th>
                    <th className="p-3.5 text-center">Grau NR-15</th>
                    <th className="p-3.5 text-center">Tempo Exposto</th>
                    <th className="p-3.5">Responsável</th>
                    <th className="p-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#243756]' : 'divide-slate-200'}`}>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="max-w-xs mx-auto space-y-2">
                          <AlertTriangle className="w-8 h-8 text-amber-500/40 mx-auto" />
                          <p className={`font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                            Nenhum apontamento encontrado
                          </p>
                          <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                            Use o botão "Lançar Atividade Insalubre" para registrar novos serviços de canteiro.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec) => (
                      <tr 
                        key={rec.id} 
                        className={`transition-colors ${
                          isDark ? 'hover:bg-[#1B2D4A]' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="p-3.5 font-mono whitespace-nowrap">
                          {rec.dataEvento.split('-').reverse().join('/')}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold">{rec.nomeColaborador}</div>
                          <div className={`font-mono text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                            Mat: {rec.matricula}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                              isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {rec.sede}
                            </span>
                            <span className="truncate max-w-[140px]" title={rec.funcao}>
                              {rec.funcao}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-200 dark:text-slate-200">
                            {rec.atividadeDesempenhada}
                          </div>
                          {rec.observacoes && (
                            <div className={`text-[11px] mt-0.5 truncate max-w-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`} title={rec.observacoes}>
                              Obs: {rec.observacoes}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full font-mono font-bold text-xs ${getGrauBadge(rec.grauExposicao)}`}>
                            {rec.grauExposicao}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold whitespace-nowrap">
                          {rec.quantidadeHorasDias} {rec.unidade === 'HORAS' ? 'h' : 'dias'}
                        </td>
                        <td className="p-3.5 text-[11px] text-[#94A3B8]">
                          {rec.responsavelLancamento}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(rec)}
                              title="Editar / Corrigir lançamento de insalubridade"
                              className={`p-1.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer ${
                                isDark ? 'text-amber-400 hover:bg-amber-500/10' : 'text-amber-600 hover:bg-amber-50'
                              }`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(rec.id, rec.nomeColaborador)}
                              title="Excluir lançamento"
                              className={`p-1.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer ${
                                isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SUB-VIEW 2: COLABORADORES COM ADICIONAL FIXO                  */}
      {/* ============================================================= */}
      {activeSubTab === 'FIXA' && (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            <div>
              <h3 className="font-bold text-sm">Quadro de Insalubridade Fixa (Em Ficha Funcional)</h3>
              <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Colaboradores com percentual fixo contratual garantido em folha de pagamento
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
              isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              Total: {stats.fixedCount.totalComAdicional} com adicional
            </span>
          </div>

          <div className={`rounded-2xl border overflow-hidden shadow-xs ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b font-bold uppercase tracking-wider text-[11px] ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    <th className="p-3.5">Matrícula</th>
                    <th className="p-3.5">Colaborador</th>
                    <th className="p-3.5">Sede</th>
                    <th className="p-3.5">Função / Cargo</th>
                    <th className="p-3.5 text-center">Grau Fixo Atual</th>
                    <th className="p-3.5 text-center">Status</th>
                    {onUpdateEmployeeGrauFixa && <th className="p-3.5 text-center">Ação Rápida</th>}
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#243756]' : 'divide-slate-200'}`}>
                  {employees
                    .filter(e => e.grauInsalubridadeFixa && e.grauInsalubridadeFixa !== 'ISENTO')
                    .map((emp) => (
                      <tr key={emp.id} className={isDark ? 'hover:bg-[#1B2D4A]' : 'hover:bg-slate-50'}>
                        <td className="p-3.5 font-mono font-bold">{emp.matricula}</td>
                        <td className="p-3.5 font-bold">{emp.nome}</td>
                        <td className="p-3.5 font-mono">{emp.sedeCodigo || 'Não informado'}</td>
                        <td className="p-3.5">{emp.funcao || emp.cargo}</td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full font-mono font-bold text-xs ${getGrauBadge(emp.grauInsalubridadeFixa || 'ISENTO')}`}>
                            {emp.grauInsalubridadeFixa}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            emp.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                        {onUpdateEmployeeGrauFixa && (
                          <td className="p-3.5 text-center">
                            <select
                              value={emp.grauInsalubridadeFixa || 'ISENTO'}
                              onChange={(e) => onUpdateEmployeeGrauFixa(emp.id, e.target.value as GrauInsalubridade)}
                              className={`px-2 py-1 rounded-lg border text-[11px] outline-hidden ${
                                isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                              }`}
                            >
                              <option value="ISENTO">ISENTO</option>
                              <option value="10%">10% (Mínimo)</option>
                              <option value="20%">20% (Médio)</option>
                              <option value="40%">40% (Máximo)</option>
                            </select>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SUB-VIEW 3: GUIA TÉCNICO NR-15 COMARA                         */}
      {/* ============================================================= */}
      {activeSubTab === 'GUIA_NR15' && (
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Matriz de Atividades Típicas em Canteiros da COMARA (NR-15)</span>
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Referência operacional para encarregados, chefes de canteiro e equipe de segurança do trabalho
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {ATIVIDADES_TIPICAS_COMARA.map((ativ, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-2.5 ${
                    isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="font-bold text-xs">{ativ.nome}</h4>
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-xs shrink-0 ${getGrauBadge(ativ.grau)}`}>
                        {ativ.grau}
                      </span>
                    </div>
                    <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                      {ativ.desc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFormAtividade(ativ.nome);
                      setFormGrau(ativ.grau);
                      setIsModalOpen(true);
                    }}
                    className={`text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer pt-1 border-t ${
                      isDark ? 'border-[#243756]' : 'border-slate-200'
                    }`}
                  >
                    <span>Lançar esta atividade agora</span>
                    <span>➔</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: NOVO LANÇAMENTO DE ATIVIDADE INSALUBRE                  */}
      {/* ============================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono">
          <div className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col ${
            isDark ? 'bg-[#16243D] border-[#243756] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header */}
            <div className={`p-5 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-xs">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingRecord ? 'Editar Apontamento de Atividade Insalubre' : 'Apontamento de Atividade Insalubre'}
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                    {editingRecord ? `Correção do registro ID #${editingRecord.id}` : 'Lançamento pontual por demanda / serviço especial'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer ${
                  isDark ? 'hover:bg-[#243756] text-gray-400' : 'hover:bg-slate-200 text-slate-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmitRecord} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
              {/* Feedback Message */}
              {formFeedback && (
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                  formFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {formFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{formFeedback.text}</span>
                </div>
              )}

              {/* 1. Seleção do Colaborador */}
              <div>
                <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                  1. COLABORADOR EXECUTOR *
                </label>
                <select
                  value={formMatricula}
                  onChange={(e) => setFormMatricula(e.target.value)}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-hidden ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                  }`}
                >
                  <option value="">-- Selecione o Colaborador por Matrícula / Nome --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.matricula}>
                      {emp.matricula} - {emp.nome} ({emp.sedeCodigo || 'Não informado'} • {emp.funcao || emp.cargo})
                    </option>
                  ))}
                </select>

                {selectedEmployeeInForm && (
                  <div className={`mt-2 p-2.5 rounded-xl border text-[11px] flex items-center justify-between ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <span>Sede: <strong>{selectedEmployeeInForm.sedeCodigo || selectedEmployeeInForm.sede_atual || selectedEmployeeInForm.sede}</strong></span>
                    <span>Função: <strong>{selectedEmployeeInForm.funcao || selectedEmployeeInForm.cargo}</strong></span>
                    <span>Fixo em Ficha: <strong>{selectedEmployeeInForm.grauInsalubridadeFixa || 'ISENTO'}</strong></span>
                  </div>
                )}
              </div>

              {/* 2. Data do Evento */}
              <div>
                <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                  2. DATA DA EXECUÇÃO DO SERVIÇO *
                </label>
                <input
                  type="date"
                  value={formDataEvento}
                  onChange={(e) => setFormDataEvento(e.target.value)}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-hidden ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* 3. Atividade Desempenhada com Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`font-bold ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    3. ATIVIDADE / AGENTE NOCIVO DESEMPENHADO *
                  </label>
                  <span className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`}>
                    Sugestões rápidas abaixo
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="Ex: Aplicação de emulsão asfáltica a quente na pista"
                  value={formAtividade}
                  onChange={(e) => setFormAtividade(e.target.value)}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-hidden ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                  }`}
                />

                {/* Presets buttons */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ATIVIDADES_TIPICAS_COMARA.slice(0, 4).map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-colors active:scale-[0.98] cursor-pointer ${
                        formAtividade === p.nome
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : isDark 
                            ? 'bg-[#0F1B33] text-gray-400 border-[#243756] hover:text-white' 
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                      }`}
                    >
                      + {p.nome.split(' (')[0].slice(0, 30)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Grau e Quantidade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    4. GRAU NR-15 *
                  </label>
                  <select
                    value={formGrau}
                    onChange={(e) => setFormGrau(e.target.value as any)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-xs outline-hidden font-bold ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="10%">10% (Mínimo)</option>
                    <option value="20%">20% (Médio)</option>
                    <option value="40%">40% (Máximo)</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    5. QUANTIDADE *
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formQuantidade}
                    onChange={(e) => setFormQuantidade(parseFloat(e.target.value) || 0)}
                    required
                    className={`w-full px-3 py-2.5 rounded-xl border text-xs outline-hidden font-bold ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    6. UNIDADE *
                  </label>
                  <select
                    value={formUnidade}
                    onChange={(e) => setFormUnidade(e.target.value as any)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-xs outline-hidden font-bold ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="HORAS">HORAS (h)</option>
                    <option value="DIAS">DIAS (diária)</option>
                  </select>
                </div>
              </div>

              {/* 5. Responsável e Observações */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    7. RESPONSÁVEL PELO APONTAMENTO
                  </label>
                  <input
                    type="text"
                    value={formResponsavel}
                    onChange={(e) => setFormResponsavel(e.target.value)}
                    placeholder="Encarregado de Campo / Técnico Seg."
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-hidden ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    8. OBSERVAÇÕES (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    value={formObservacoes}
                    onChange={(e) => setFormObservacoes(e.target.value)}
                    placeholder="Ex: Trecho Pista Cabeceira 08"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-hidden ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2.5 rounded-xl border font-bold transition-colors active:scale-[0.98] cursor-pointer ${
                    isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all shadow-md shadow-amber-600/20 active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Gravando...' : editingRecord ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
      {/* Modal de Conversão Simples -> Avançado */}
      {isConversionModalOpen && onSaveBatchRecords && (
        <InsalubrityConversionModal
          isOpen={isConversionModalOpen}
          onClose={() => setIsConversionModalOpen(false)}
          insalubrityRecords={insalubrityRecords}
          employees={employees}
          currentUserEmail={currentUserEmail}
          userRole={userRole as AdminRole}
          theme={theme}
          onSaveConvertedBatch={async (updatedList) => {
            await onSaveBatchRecords(updatedList);
          }}
          onSwitchToAdvancedView={() => {
            setCurrentMode('COMPLETA');
          }}
        />
      )}
    </div>
  );
};
