import React, { useState, useMemo, useEffect, useId } from 'react';
import { Employee, TimeRecord, OccurrenceType, Branch } from '@/src/shared/types';
import { calculateSPTFBalance, formatHoursDecimal } from '@/src/shared/utils/calculations';
import { dbService } from '@/src/shared/services/dbService';
import { storageService } from '@/src/shared/services/storageService';
import { InfoTooltip } from '@/src/shared/components/InfoTooltip';
import { 
  Zap, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  X, 
  AlertCircle, 
  AlertTriangle,
  Building2, 
  Sparkles,
  ArrowRight,
  UserCheck,
  Layers,
  Users,
  CheckSquare,
  Square,
  FileText,
  Database,
  Loader2,
  Table,
  Plus,
  RefreshCw,
  Info
} from 'lucide-react';

interface QuickBatchEntryModalProps {
  isOpen: boolean;
  onClose?: () => void;
  employees: Employee[];
  onSaveRecord?: (record: TimeRecord) => void;
  onSaveBatch?: (records: TimeRecord[]) => void;
  onSave?: (records: TimeRecord[] | TimeRecord) => void;
  onSuccess?: () => void;
  refreshData?: () => void;
  userRole?: string;
  theme?: 'dark' | 'light';
}

type BatchMode = 'MULTI_SELECAO' | 'GRADE_DIARIA' | 'FLUXO_RAPIDO';

interface RowBatchItem {
  matricula: string;
  nome: string;
  funcao: string;
  sede: string;
  tipo: OccurrenceType;
  horas: number;
  incluir: boolean;
  observacao: string;
}

export const QuickBatchEntryModal: React.FC<QuickBatchEntryModalProps> = ({
  isOpen,
  onClose,
  employees = [],
  onSaveRecord,
  onSaveBatch,
  onSave,
  onSuccess,
  refreshData,
  userRole,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const isAuxDA = userRole === 'AUX_DA' || userRole === 'AUXILIAR_DA';
  const modalId = useId();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Modo de operação
  const [activeMode, setActiveMode] = useState<BatchMode>('MULTI_SELECAO');

  // Assegurar que se for Aux de DA, força o modo Multi-Seleção
  React.useEffect(() => {
    if (isAuxDA && activeMode !== 'MULTI_SELECAO') {
      setActiveMode('MULTI_SELECAO');
    }
  }, [isAuxDA, activeMode]);

  // Estados comuns
  const [dataRegistro, setDataRegistro] = useState(todayStr);
  const [tipoOcorrencia, setTipoOcorrencia] = useState<OccurrenceType>('TRABALHO');
  const [horasBrutas, setHorasBrutas] = useState<number>(2.0);
  const [observacao, setObservacao] = useState('');
  const [eFeriadoManual, setEFeriadoManual] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Estados Modo Multi-Seleção
  const [selectedMatriculas, setSelectedMatriculas] = useState<string[]>([]);
  const [filterSede, setFilterSede] = useState<string>('TODAS');
  const [filterFuncao, setFilterFuncao] = useState<string>('TODAS');
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');

  // Estados Modo Grade Diária Operacional
  const [gridRows, setGridRows] = useState<Record<string, { tipo: OccurrenceType; horas: number; incluir: boolean; observacao: string }>>({});
  const [gridInitialized, setGridInitialized] = useState(false);

  // Estados Modo Fluxo Rápido Consecutivo
  const [matriculaQuery, setMatriculaQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [recentLogs, setRecentLogs] = useState<string[]>([]);
  const [consecutiveCount, setConsecutiveCount] = useState(0);

  // Tratamento de callbacks seguro
  const safeInvoke = (fn: any, ...args: any[]) => {
    if (typeof fn === 'function') {
      try {
        fn(...args);
      } catch (err) {
        console.warn('Alerta no disparo de callback:', err);
      }
    }
  };

  const handleClose = () => {
    setFeedback(null);
    setSelectedEmployee(null);
    setMatriculaQuery('');
    safeInvoke(onClose);
  };

  // Listener para fechamento por tecla Escape (Acessibilidade U-002)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Garante array seguro de colaboradores
  const safeEmployees = useMemo(() => {
    if (!Array.isArray(employees)) return [];
    return employees.filter((emp): emp is Employee => Boolean(emp && (emp.matricula || emp.id)));
  }, [employees]);

  // Funções / Sedes disponíveis para filtros
  const availableSedes = useMemo(() => {
    const s = new Set<string>();
    safeEmployees.forEach((e) => {
      if (e.sedeCodigo) s.add(e.sedeCodigo);
    });
    return Array.from(s).sort();
  }, [safeEmployees]);

  const availableFuncoes = useMemo(() => {
    const f = new Set<string>();
    safeEmployees.forEach((e) => {
      if (e.funcao) f.add(e.funcao);
    });
    return Array.from(f).sort();
  }, [safeEmployees]);

  // Lista filtrada para multi-seleção
  const filteredEmployeesForSelection = useMemo(() => {
    return safeEmployees.filter((emp) => {
      const empSede = emp.sedeCodigo || '';
      const empFuncao = emp.funcao || 'Operacional';
      const empNome = emp.nome || '';
      const empMat = emp.matricula || '';

      if (filterSede !== 'TODAS' && empSede !== filterSede) return false;
      if (filterFuncao !== 'TODAS' && empFuncao !== filterFuncao) return false;
      if (searchEmployeeQuery.trim()) {
        const q = searchEmployeeQuery.toLowerCase().trim();
        const mMat = empMat.toLowerCase().includes(q);
        const mNom = empNome.toLowerCase().includes(q);
        const mFun = empFuncao.toLowerCase().includes(q);
        if (!mMat && !mNom && !mFun) return false;
      }
      return true;
    });
  }, [safeEmployees, filterSede, filterFuncao, searchEmployeeQuery]);

  // Inicializa a grade quando os filtros mudam ou no modo GRADE_DIARIA
  const currentGridList: RowBatchItem[] = useMemo(() => {
    return filteredEmployeesForSelection.map((emp) => {
      const mat = (emp.matricula || emp.id || '').toString();
      const existing = gridRows[mat];
      return {
        matricula: mat,
        nome: emp.nome || 'Sem Nome',
        funcao: emp.funcao || 'Operacional',
        sede: emp.sedeCodigo || '',
        tipo: existing?.tipo || tipoOcorrencia,
        horas: existing !== undefined ? existing.horas : (tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : horasBrutas),
        incluir: existing !== undefined ? existing.incluir : true,
        observacao: existing?.observacao || '',
      };
    });
  }, [filteredEmployeesForSelection, gridRows, tipoOcorrencia, horasBrutas]);

  // Toggle de seleção individual
  const toggleSelectMatricula = (mat: string) => {
    setSelectedMatriculas((prev) =>
      prev.includes(mat) ? prev.filter((m) => m !== mat) : [...prev, mat]
    );
  };

  // Selecionar todos os filtrados
  const handleSelectAllFiltered = () => {
    const allFilteredMats = filteredEmployeesForSelection.map((e) => e.matricula || e.id || '');
    const allSelected = allFilteredMats.length > 0 && allFilteredMats.every((m) => selectedMatriculas.includes(m));
    if (allSelected) {
      setSelectedMatriculas((prev) => prev.filter((m) => !allFilteredMats.includes(m)));
    } else {
      setSelectedMatriculas((prev) => Array.from(new Set([...prev, ...allFilteredMats])));
    }
  };

  // Auto-complete para o Modo Fluxo Rápido
  const matchingEmployeesQuick = useMemo(() => {
    if (!matriculaQuery.trim() || safeEmployees.length === 0) return [];
    const q = matriculaQuery.toLowerCase().trim();
    return safeEmployees.filter((emp) => {
      const mat = (emp.matricula || emp.id || '').toString().toLowerCase();
      const nom = (emp.nome || '').toLowerCase();
      return mat.includes(q) || nom.includes(q);
    });
  }, [safeEmployees, matriculaQuery]);

  const handleSelectQuickEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setMatriculaQuery(emp.matricula || emp.id || '');
    setFeedback(null);
  };

  // Cálculo prévio para Modo 1 (Multi-seleção)
  const previewCalc = useMemo(() => {
    const sampleSede = filterSede !== 'TODAS' ? (filterSede as Branch) : 'KO';
    return calculateSPTFBalance(
      tipoOcorrencia,
      tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : (tipoOcorrencia === 'ACABOU_BANHOU' ? 0.0 : horasBrutas),
      dataRegistro,
      eFeriadoManual,
      sampleSede
    );
  }, [tipoOcorrencia, horasBrutas, dataRegistro, eFeriadoManual, filterSede]);

  // -------------------------------------------------------------
  // GRAVAÇÃO UNIVERSAL DE LANÇAMENTOS EM LOTE
  // -------------------------------------------------------------
  const persistBatchRecords = async (recordsToSave: TimeRecord[]): Promise<boolean> => {
    if (recordsToSave.length === 0) {
      setFeedback({ type: 'error', text: 'Nenhum lançamento para gravar.' });
      return false;
    }

    setIsSubmitting(true);
    try {
      // 1. Tenta salvar via onSaveBatch / handler principal
      if (typeof onSaveBatch === 'function') {
        await onSaveBatch(recordsToSave);
      } else {
        // Fallback direto com banco de dados e Storage
        await dbService.importTimeRecordsBatch(recordsToSave);
        storageService.addTimeRecordsBatch(recordsToSave);
      }

      // 2. Dispara callbacks secundários defensivos
      safeInvoke(onSave, recordsToSave);
      safeInvoke(onSuccess);
      safeInvoke(refreshData);

      return true;
    } catch (err: any) {
      console.error('Erro ao gravar lote de lançamentos:', err);
      setFeedback({
        type: 'error',
        text: `Lote não gravado no banco de dados: ${err?.message || 'Falha na comunicação com o banco'}.`,
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // MODO 1: Salvar Multi-Seleção
  // -------------------------------------------------------------
  const handleSaveMultiBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (selectedMatriculas.length === 0) {
      setFeedback({ type: 'error', text: 'Selecione ao menos 1 colaborador da lista abaixo.' });
      return;
    }

    if (horasBrutas <= 0 && tipoOcorrencia === 'TRABALHO') {
      setFeedback({ type: 'error', text: 'Informe uma quantidade válida de horas trabalhadas (ex: 2h, 4h, 8h).' });
      return;
    }

    const recordsToSave: TimeRecord[] = [];
    const nowIso = new Date().toISOString();

    const selectedEmployeeObjects = safeEmployees.filter((emp) =>
      selectedMatriculas.includes(emp.matricula || emp.id || '')
    );

    const defaultObs = tipoOcorrencia === 'ACABOU_BANHOU'
      ? 'Acabou Banhou - Missão cumprida, liberação sem débito em banco de horas.'
      : `Lote RH (${tipoOcorrencia} em ${dataRegistro})`;

    for (const emp of selectedEmployeeObjects) {
      const effectiveSede: Branch = emp.sedeCodigo || '';
      const calc = calculateSPTFBalance(
        tipoOcorrencia,
        tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : (tipoOcorrencia === 'ACABOU_BANHOU' ? 0.0 : horasBrutas),
        dataRegistro,
        eFeriadoManual,
        effectiveSede
      );

      const docId = `rec-batch-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const newRec: TimeRecord = {
        id: docId,
        matricula: (emp.matricula || emp.id || '').toString().trim().toUpperCase(),
        employeeName: emp.nome || 'Colaborador',
        employeeSede: effectiveSede,
        employeeFuncao: emp.funcao || 'Operacional',
        employeeAvatarUrl: emp.url_foto_perfil || emp.avatarUrl || '',
        dataRegistro,
        data_ocorrencia: dataRegistro,
        tipoOcorrencia,
        horasBrutas: tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : (tipoOcorrencia === 'ACABOU_BANHOU' ? 0.0 : horasBrutas),
        multiplicador: calc.multiplicador,
        saldoCalculado: calc.saldoCalculado,
        horasDescontoFolha: calc.horasDescontoFolha,
        destinoLancamento: calc.destinoLancamento,
        saldo_remanescente: calc.saldoCalculado !== 0 ? Math.abs(calc.saldoCalculado) : 0,
        status_compensacao: calc.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO',
        eFeriado: calc.eFeriado,
        nomeFeriado: calc.nomeFeriado || '',
        diaSemana: calc.diaSemana,
        diaSemanaNome: calc.diaSemanaNome,
        observacao: observacao.trim() || defaultObs,
        criadoEm: nowIso,
      };

      recordsToSave.push(newRec);
    }

    const success = await persistBatchRecords(recordsToSave);
    if (success) {
      setFeedback({
        type: 'success',
        text: `Lote de ${recordsToSave.length} lançamentos sincronizado com sucesso!`,
      });
      setSelectedMatriculas([]);
      setTimeout(() => {
        handleClose();
      }, 1000);
    }
  };

  // -------------------------------------------------------------
  // MODO 2: Salvar Grade Diária Operacional
  // -------------------------------------------------------------
  const handleSaveGridBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const activeRows = currentGridList.filter((r) => r.incluir);
    if (activeRows.length === 0) {
      setFeedback({ type: 'error', text: 'Nenhum colaborador com caixa "Incluir" marcada na grade.' });
      return;
    }

    const recordsToSave: TimeRecord[] = [];
    const nowIso = new Date().toISOString();

    for (const row of activeRows) {
      const emp = safeEmployees.find((e) => (e.matricula || e.id) === row.matricula);
      const effectiveSede: Branch = (emp?.sedeCodigo || emp?.sede_atual || emp?.sede || row.sede || 'KO') as Branch;
      const isAcabouBanhou = row.tipo === 'ACABOU_BANHOU';
      const calc = calculateSPTFBalance(
        row.tipo,
        row.tipo === 'FALTA_INJUSTIFICADA' ? 8.0 : (isAcabouBanhou ? 0.0 : row.horas),
        dataRegistro,
        eFeriadoManual,
        effectiveSede
      );

      const docId = `rec-grid-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const newRec: TimeRecord = {
        id: docId,
        matricula: row.matricula.trim().toUpperCase(),
        employeeName: row.nome,
        employeeSede: effectiveSede,
        employeeFuncao: row.funcao,
        employeeAvatarUrl: emp?.url_foto_perfil || emp?.avatarUrl || '',
        dataRegistro,
        data_ocorrencia: dataRegistro,
        tipoOcorrencia: row.tipo,
        horasBrutas: row.tipo === 'FALTA_INJUSTIFICADA' ? 8.0 : (isAcabouBanhou ? 0.0 : row.horas),
        multiplicador: calc.multiplicador,
        saldoCalculado: calc.saldoCalculado,
        horasDescontoFolha: calc.horasDescontoFolha,
        destinoLancamento: calc.destinoLancamento,
        saldo_remanescente: calc.saldoCalculado !== 0 ? Math.abs(calc.saldoCalculado) : 0,
        status_compensacao: calc.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO',
        eFeriado: calc.eFeriado,
        nomeFeriado: calc.nomeFeriado || '',
        diaSemana: calc.diaSemana,
        diaSemanaNome: calc.diaSemanaNome,
        observacao: (row.observacao || (isAcabouBanhou ? 'Acabou Banhou - Missão cumprida, liberação sem débito em banco de horas.' : `Grade Operacional (${row.tipo})`)).trim(),
        criadoEm: nowIso,
      };

      recordsToSave.push(newRec);
    }

    const success = await persistBatchRecords(recordsToSave);
    if (success) {
      setFeedback({
        type: 'success',
        text: `Grade operacional de ${recordsToSave.length} apontamentos gravada com sucesso!`,
      });
      setTimeout(() => {
        handleClose();
      }, 1000);
    }
  };

  // -------------------------------------------------------------
  // MODO 3: Salvar Fluxo Rápido Consecutivo (1 a 1 com Enter)
  // -------------------------------------------------------------
  const handleSaveQuickSingle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFeedback(null);

    const emp = selectedEmployee || safeEmployees.find(
      (em) => (em.matricula || em.id || '').toString().toUpperCase() === matriculaQuery.trim().toUpperCase()
    );

    if (!emp) {
      setFeedback({ type: 'error', text: 'Informe ou selecione uma matrícula/colaborador válido.' });
      return;
    }

    if (horasBrutas <= 0 && tipoOcorrencia === 'TRABALHO') {
      setFeedback({ type: 'error', text: 'Informe a quantidade de horas brutas.' });
      return;
    }

    const effectiveSede: Branch = emp.sedeCodigo || '';
    const isAcabouBanhou = tipoOcorrencia === 'ACABOU_BANHOU';
    const calc = calculateSPTFBalance(
      tipoOcorrencia,
      tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : (isAcabouBanhou ? 0.0 : horasBrutas),
      dataRegistro,
      eFeriadoManual,
      effectiveSede
    );

    const docId = `rec-quick-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    const newRecord: TimeRecord = {
      id: docId,
      matricula: (emp.matricula || emp.id || '').toString().trim().toUpperCase(),
      employeeName: emp.nome || 'Colaborador',
      employeeSede: effectiveSede,
      employeeFuncao: emp.funcao || 'Operacional',
      employeeAvatarUrl: emp.url_foto_perfil || emp.avatarUrl || '',
      dataRegistro,
      data_ocorrencia: dataRegistro,
      tipoOcorrencia,
      horasBrutas: tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : (isAcabouBanhou ? 0.0 : horasBrutas),
      multiplicador: calc.multiplicador,
      saldoCalculado: calc.saldoCalculado,
      horasDescontoFolha: calc.horasDescontoFolha,
      destinoLancamento: calc.destinoLancamento,
      saldo_remanescente: calc.saldoCalculado !== 0 ? Math.abs(calc.saldoCalculado) : 0,
      status_compensacao: calc.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO',
      eFeriado: calc.eFeriado,
      nomeFeriado: calc.nomeFeriado || '',
      diaSemana: calc.diaSemana,
      diaSemanaNome: calc.diaSemanaNome,
      observacao: (observacao.trim() || (isAcabouBanhou ? 'Acabou Banhou - Missão cumprida, liberação sem débito em banco de horas.' : `Lançamento Rápido (${effectiveSede})`)),
      criadoEm: nowIso,
    };

    const success = await persistBatchRecords([newRecord]);
    if (success) {
      setConsecutiveCount((prev) => prev + 1);
      const shortName = (emp.nome || 'Colaborador').split(' ')[0] || emp.nome;
      const logText = `${newRecord.matricula} (${shortName}) - ${dataRegistro}: ${
        calc.saldoCalculado > 0 ? '+' : ''
      }${calc.saldoCalculado.toFixed(1)}h [${effectiveSede}]`;
      setRecentLogs((prev) => [logText, ...prev.slice(0, 4)]);

      // Limpar campo para a próxima matrícula mantendo data/tipo/horas para agilidade máxima
      setSelectedEmployee(null);
      setMatriculaQuery('');
      setFeedback({ type: 'success', text: `Apontamento de ${emp.nome} registrado! Pode digitar a próxima matrícula.` });
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
      id={`quick-batch-modal-${modalId}`}
    >
      <div 
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[94vh] ${
          isDark ? 'bg-[#16243D] border-[#243756] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* ========================================================= */}
        {/* 1. CABEÇALHO DO MODAL                                     */}
        {/* ========================================================= */}
        <div className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Lançamento Rápido em Lote SPTF
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-500 border border-blue-500/20 font-mono font-semibold">
                  Múltiplos Apontamentos
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Lançamento em lote com cálculo CLT <InfoTooltip theme={isDark ? 'dark' : 'light'} content="Cadastre horas para múltiplos colaboradores ou equipes de canteiro simultaneamente com cálculo CLT automático." />
              </p>
            </div>
          </div>
          <button
            id="btn-close-batch-modal"
            onClick={handleClose}
            aria-label="Fechar Modal de Lançamento em Lote"
            className={`p-1.5 rounded-xl border transition-colors active:scale-[0.98] cursor-pointer ${
              isDark ? 'border-[#243756] hover:bg-[#243756] text-[#94A3B8]' : 'border-slate-200 hover:bg-slate-100 text-slate-500'
            }`}
            title="Fechar Modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. BARRA DE ABAS DE OPERAÇÃO                             */}
        {/* ========================================================= */}
        <div className={`px-4 py-2 border-b flex flex-wrap items-center gap-1.5 shrink-0 ${
          isDark ? 'bg-[#101217] border-[#243756]' : 'bg-slate-100/80 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => {
              setActiveMode('MULTI_SELECAO');
              setFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
              activeMode === 'MULTI_SELECAO'
                ? 'bg-blue-600 text-white shadow-xs'
                : isDark ? 'text-[#94A3B8] hover:text-white hover:bg-[#243756]' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>1. Seleção por Equipe / Canteiro</span>
            {selectedMatriculas.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-mono">
                {selectedMatriculas.length}
              </span>
            )}
          </button>

          {/* Modo 2: Grade Diária Operacional - Oculto para Aux de DA */}
          {!isAuxDA && (
            <button
              type="button"
              onClick={() => {
                setActiveMode('GRADE_DIARIA');
                setFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
                activeMode === 'GRADE_DIARIA'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-[#94A3B8] hover:text-white hover:bg-[#243756]' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>2. Grade Diária Operacional</span>
            </button>
          )}

          {/* Modo 3: Fluxo Rápido - Oculto para Aux de DA */}
          {!isAuxDA && (
            <button
              type="button"
              onClick={() => {
                setActiveMode('FLUXO_RAPIDO');
                setFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
                activeMode === 'FLUXO_RAPIDO'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-[#94A3B8] hover:text-white hover:bg-[#243756]' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>3. Fluxo Rápido (1 a 1 com Enter)</span>
              {consecutiveCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                  +{consecutiveCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div className={`mx-5 mt-3 p-3 rounded-xl border flex items-center gap-2 text-xs shrink-0 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-red-950/40 border-red-800/60 text-red-300'
              : 'bg-blue-950/40 border-blue-800/60 text-blue-300'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 text-blue-400" />
            )}
            <span className="flex-1">{feedback.text}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. CORPO DO MODAL (CONTEÚDO DINÂMICO CONFORME ABA)       */}
        {/* ========================================================= */}
        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
          
          {/* AVISO QUANDO BASE DE COLABORADORES ESTIVER VAZIA */}
          {safeEmployees.length === 0 && (
            <div className={`p-6 rounded-2xl border text-center space-y-3 ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <Users className="w-8 h-8 text-blue-500 mx-auto opacity-70" />
              <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Nenhum Colaborador Cadastrado
              </h3>
              <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                Para realizar lançamentos em lote, primeiro cadastre ou importe colaboradores via CSV na aba "Colaboradores".
              </p>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODO 1: SELEÇÃO POR EQUIPE / CANTEIRO COM CHECKBOXES     */}
          {/* ========================================================= */}
          {activeMode === 'MULTI_SELECAO' && safeEmployees.length > 0 && (
            <form onSubmit={handleSaveMultiBatch} className="space-y-4">
              
              {/* Painel de Parâmetros do Lançamento */}
              <div className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-3 gap-3 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Data da Ocorrência *
                  </label>
                  <input
                    type="date"
                    required
                    value={dataRegistro}
                    onChange={(e) => setDataRegistro(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 border font-mono text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Tipo de Ocorrência *
                  </label>
                  <select
                    value={tipoOcorrencia}
                    onChange={(e) => {
                      const newType = e.target.value as OccurrenceType;
                      setTipoOcorrencia(newType);
                      if (newType === 'ACABOU_BANHOU') {
                        setHorasBrutas(0);
                        if (!observacao) {
                          setObservacao('Acabou Banhou - Missão cumprida, liberação sem débito em banco de horas.');
                        }
                      }
                    }}
                    className={`w-full rounded-lg px-3 py-2 border font-mono text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  >
                    <option value="ACABOU_BANHOU">✨ ACABOU BANHOU: Missão Cumprida (Sem Débito / Não Desconta)</option>
                    <option value="TRABALHO">TRABALHO: Horas Extras / Sobreaviso (Crédito)</option>
                    <option value="COMPENSACAO">COMPENSAÇÃO: Folga / Saída (Débito)</option>
                    <option value="DISPENSA_OPERACIONAL">DISPENSA OPERACIONAL (Débito)</option>
                    <option value="FALTA_JUSTIFICADA">FALTA JUSTIFICADA (Neutro)</option>
                    <option value="ATESTADO_MEDICO">ATESTADO MÉDICO (Neutro)</option>
                    <option value="FERIAS">FÉRIAS (Neutro)</option>
                    <option value="LICENCA">LICENÇA (Neutro)</option>
                    <option value="FALTA_INJUSTIFICADA">FALTA SEM JUSTIFICATIVA (Desconto Folha)</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Horas Brutas {tipoOcorrencia === 'TRABALHO' ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    disabled={tipoOcorrencia === 'FALTA_INJUSTIFICADA' || tipoOcorrencia === 'FERIAS' || tipoOcorrencia === 'ATESTADO_MEDICO' || tipoOcorrencia === 'ACABOU_BANHOU'}
                    value={tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : (tipoOcorrencia === 'ACABOU_BANHOU' ? 0.0 : horasBrutas)}
                    onChange={(e) => setHorasBrutas(parseFloat(e.target.value) || 0)}
                    className={`w-full rounded-lg px-3 py-2 border font-mono text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50'
                    }`}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Observação do Lote {tipoOcorrencia === 'ACABOU_BANHOU' ? '(Preenchida Automaticamente)' : '(Opcional)'}
                  </label>
                  <input
                    type="text"
                    placeholder={tipoOcorrencia === 'ACABOU_BANHOU' ? 'Acabou Banhou - Missão cumprida, liberação sem débito...' : 'Ex: Mutirão de pavimentação na pista de pouso de Coari...'}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 border text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                {/* Prévia do cálculo SPTF */}
                <div className={`sm:col-span-3 p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2 ${
                  isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-500">Regra SPTF:</span>
                    {tipoOcorrencia === 'ACABOU_BANHOU' ? (
                      <span className="text-cyan-400 font-semibold">Acabou Banhou • Missão Cumprida • Não desconta do banco de horas</span>
                    ) : (
                      <span>{previewCalc.diaSemanaNome}{previewCalc.eFeriado ? ` (${previewCalc.nomeFeriado || 'Feriado'})` : ''} • Multiplicador {previewCalc.multiplicador}x</span>
                    )}
                  </div>
                  <div className="font-mono font-bold">
                    {tipoOcorrencia === 'ACABOU_BANHOU' ? (
                      <span className="text-cyan-400">Saldo Neutro: 0.0h (Sem Débito)</span>
                    ) : previewCalc.destinoLancamento === 'FOLHA_PAGAMENTO' ? (
                      <span className="text-amber-500">Desconto em Folha: -{previewCalc.horasDescontoFolha.toFixed(1)}h</span>
                    ) : previewCalc.saldoCalculado > 0 ? (
                      <span className="text-emerald-500">Crédito Banco: +{previewCalc.saldoCalculado.toFixed(1)}h</span>
                    ) : previewCalc.saldoCalculado < 0 ? (
                      <span className="text-rose-500">Débito Banco: {previewCalc.saldoCalculado.toFixed(1)}h</span>
                    ) : (
                      <span className="text-slate-400">Neutro (0.0h)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Filtros e Seleção da Equipe */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Selecione os Colaboradores
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                      selectedMatriculas.length > 0
                        ? 'bg-blue-600 text-white font-bold'
                        : isDark ? 'bg-[#0F1B33] text-[#94A3B8]' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {selectedMatriculas.length} selecionado(s) de {filteredEmployeesForSelection.length} filtrados
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors active:scale-[0.98] cursor-pointer ${
                        isDark ? 'border-[#335075] hover:bg-[#243756] text-blue-400' : 'border-blue-200 hover:bg-blue-50 text-blue-700'
                      }`}
                    >
                      {filteredEmployeesForSelection.length > 0 && filteredEmployeesForSelection.every(e => selectedMatriculas.includes(e.matricula || e.id || ''))
                        ? 'Desmarcar Todos Filtrados'
                        : 'Selecionar Todos Filtrados'}
                    </button>
                    {selectedMatriculas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedMatriculas([])}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer ${
                          isDark ? 'text-[#94A3B8] hover:text-white' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Limpar Seleção
                      </button>
                    )}
                  </div>
                </div>

                {/* Barra de Filtro Rápido */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative sm:col-span-1">
                    <input
                      type="text"
                      placeholder="Buscar por nome, matrícula ou função..."
                      value={searchEmployeeQuery}
                      onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                      className={`w-full rounded-lg pl-8 pr-3 py-1.5 border text-xs focus:outline-hidden ${
                        isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                    <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`} />
                  </div>

                  <div>
                    <select
                      value={filterSede}
                      onChange={(e) => setFilterSede(e.target.value)}
                      className={`w-full rounded-lg px-2.5 py-1.5 border text-xs focus:outline-hidden ${
                        isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    >
                      <option value="TODAS">Todas as Sedes / Canteiros</option>
                      {availableSedes.map((s) => (
                        <option key={s} value={s}>Canteiro/Sede: {s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={filterFuncao}
                      onChange={(e) => setFilterFuncao(e.target.value)}
                      className={`w-full rounded-lg px-2.5 py-1.5 border text-xs focus:outline-hidden ${
                        isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    >
                      <option value="TODAS">Todas as Funções</option>
                      {availableFuncoes.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lista com Checkboxes */}
                <div className={`border rounded-xl max-h-60 overflow-y-auto divide-y shadow-inner ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] divide-[#243756]' : 'bg-white border-slate-200 divide-slate-100'
                }`}>
                  {filteredEmployeesForSelection.length === 0 ? (
                    <div className={`p-6 text-center ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                      Nenhum colaborador encontrado para os filtros selecionados.
                    </div>
                  ) : (
                    filteredEmployeesForSelection.map((emp) => {
                      const mat = (emp.matricula || emp.id || '').toString();
                      const isSelected = selectedMatriculas.includes(mat);
                      const initial = (emp.nome || 'C')[0] || '?';

                      return (
                        <label
                          key={emp.id || mat}
                          className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors active:scale-[0.98] ${
                            isSelected
                              ? isDark ? 'bg-blue-950/40 border-l-2 border-blue-500' : 'bg-blue-50/80 border-l-2 border-blue-500'
                              : isDark ? 'hover:bg-[#16243D]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectMatricula(mat)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            {emp.url_foto_perfil || emp.avatarUrl ? (
                              <img
                                src={emp.url_foto_perfil || emp.avatarUrl}
                                alt={emp.nome || 'Colaborador'}
                                className="w-6 h-6 rounded-full object-cover border"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                                {initial}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {emp.nome || 'Colaborador Sem Nome'}
                                </span>
                                <span className={`font-mono text-[10px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                  #{mat}
                                </span>
                              </div>
                              <div className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                                {emp.funcao || 'Operacional'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span className={`px-2 py-0.5 rounded ${
                              isDark ? 'bg-[#16243D] text-slate-300 border border-[#335075]' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              Canteiro: {emp.canteiroExecucaoId || emp.sedeCodigo || 'Não informado'}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Ações Inferiores */}
              <div className={`pt-3 border-t flex items-center justify-between ${
                isDark ? 'border-[#243756]' : 'border-slate-200'
              }`}>
                <span className={`text-[11px] font-mono ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  {selectedMatriculas.length} registro(s) pronto(s) para gravação.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors active:scale-[0.98] cursor-pointer ${
                      isDark ? 'border-[#243756] hover:bg-[#243756] text-[#94A3B8]' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || selectedMatriculas.length === 0}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#3B82F6] hover:bg-blue-600 transition-all active:scale-[0.98] shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sincronizando Lote...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>Gravar Lote ({selectedMatriculas.length} Colaboradores)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* MODO 2: GRADE DIÁRIA OPERACIONAL (TABELA EM LOTE)        */}
          {/* ========================================================= */}
          {activeMode === 'GRADE_DIARIA' && safeEmployees.length > 0 && (
            <form onSubmit={handleSaveGridBatch} className="space-y-4">
              {/* Barra Superior da Grade: Data & Filtros */}
              <div className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-4 gap-3 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Data da Grade *
                  </label>
                  <input
                    type="date"
                    required
                    value={dataRegistro}
                    onChange={(e) => setDataRegistro(e.target.value)}
                    className={`w-full rounded-lg px-3 py-1.5 border font-mono text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Filtrar Canteiro/Sede
                  </label>
                  <select
                    value={filterSede}
                    onChange={(e) => setFilterSede(e.target.value)}
                    className={`w-full rounded-lg px-2.5 py-1.5 border text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  >
                    <option value="TODAS">Todas as Sedes / Canteiros</option>
                    {availableSedes.map((s) => (
                      <option key={s} value={s}>Canteiro/Sede: {s}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Buscar Colaborador
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filtrar por nome, matrícula ou função..."
                      value={searchEmployeeQuery}
                      onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                      className={`w-full rounded-lg pl-8 pr-3 py-1.5 border text-xs focus:outline-hidden ${
                        isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                    <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`} />
                  </div>
                </div>
              </div>

              {/* Tabela Interativa de Grade Diária */}
              <div className={`border rounded-xl overflow-hidden shadow-inner max-h-72 overflow-y-auto ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
              }`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`sticky top-0 z-10 text-[10px] uppercase font-bold tracking-wider border-b ${
                    isDark ? 'bg-[#16243D] border-[#243756] text-[#94A3B8]' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}>
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Incluir</th>
                      <th className="py-2.5 px-3">Colaborador</th>
                      <th className="py-2.5 px-3">Canteiro</th>
                      <th className="py-2.5 px-3 w-44">Ocorrência</th>
                      <th className="py-2.5 px-3 w-20 text-center">Horas</th>
                      <th className="py-2.5 px-3">Observação</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#243756]' : 'divide-slate-100'}`}>
                    {currentGridList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={`py-6 text-center ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Nenhum colaborador encontrado com os filtros ativos.
                        </td>
                      </tr>
                    ) : (
                      currentGridList.map((row) => {
                        const isChecked = row.incluir;
                        return (
                          <tr 
                            key={row.matricula}
                            className={`transition-colors ${
                              isChecked
                                ? isDark ? 'hover:bg-[#16243D]' : 'hover:bg-slate-50'
                                : isDark ? 'opacity-40 bg-[#0A0C0F]' : 'opacity-40 bg-slate-50'
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setGridRows((prev) => ({
                                    ...prev,
                                    [row.matricula]: {
                                      tipo: row.tipo,
                                      horas: row.horas,
                                      incluir: e.target.checked,
                                      observacao: row.observacao,
                                    },
                                  }));
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {row.nome}
                              </div>
                              <div className="font-mono text-[10px] text-blue-500">
                                #{row.matricula} • {row.funcao}
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px]">
                              <span className={`px-1.5 py-0.5 rounded ${
                                isDark ? 'bg-[#16243D] text-slate-300' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {row.sede}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                disabled={!isChecked}
                                value={row.tipo}
                                onChange={(e) => {
                                  const newTipo = e.target.value as OccurrenceType;
                                  setGridRows((prev) => ({
                                    ...prev,
                                    [row.matricula]: {
                                      tipo: newTipo,
                                      horas: newTipo === 'FALTA_INJUSTIFICADA' ? 8.0 : (newTipo === 'ACABOU_BANHOU' ? 0.0 : row.horas),
                                      incluir: row.incluir,
                                      observacao: newTipo === 'ACABOU_BANHOU' && !row.observacao ? 'Acabou Banhou - Missão cumprida' : row.observacao,
                                    },
                                  }));
                                }}
                                className={`w-full rounded-md px-2 py-1 border text-[11px] font-mono focus:outline-hidden ${
                                  isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                                }`}
                              >
                                <option value="ACABOU_BANHOU">✨ ACABOU BANHOU (0h)</option>
                                <option value="TRABALHO">TRABALHO (Crédito)</option>
                                <option value="COMPENSACAO">COMPENSAÇÃO (Débito)</option>
                                <option value="DISPENSA_OPERACIONAL">DISPENSA (Débito)</option>
                                <option value="ATESTADO_MEDICO">ATESTADO (0h)</option>
                                <option value="FALTA_JUSTIFICADA">FALTA JUST. (0h)</option>
                                <option value="FERIAS">FÉRIAS (0h)</option>
                                <option value="FALTA_INJUSTIFICADA">FALTA INJUST. (Folha)</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="0.5"
                                min="0.5"
                                max="24"
                                disabled={!isChecked || row.tipo === 'FALTA_INJUSTIFICADA' || row.tipo === 'ATESTADO_MEDICO' || row.tipo === 'ACABOU_BANHOU'}
                                value={row.tipo === 'FALTA_INJUSTIFICADA' ? 8.0 : (row.tipo === 'ACABOU_BANHOU' ? 0.0 : row.horas)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setGridRows((prev) => ({
                                    ...prev,
                                    [row.matricula]: {
                                      tipo: row.tipo,
                                      horas: val,
                                      incluir: row.incluir,
                                      observacao: row.observacao,
                                    },
                                  }));
                                }}
                                className={`w-16 text-center rounded-md px-1 py-1 border font-mono text-[11px] focus:outline-hidden ${
                                  isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                                }`}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                disabled={!isChecked}
                                placeholder="Obs opcional..."
                                value={row.observacao}
                                onChange={(e) => {
                                  const obs = e.target.value;
                                  setGridRows((prev) => ({
                                    ...prev,
                                    [row.matricula]: {
                                      tipo: row.tipo,
                                      horas: row.horas,
                                      incluir: row.incluir,
                                      observacao: obs,
                                    },
                                  }));
                                }}
                                className={`w-full rounded-md px-2 py-1 border text-[11px] focus:outline-hidden ${
                                  isDark ? 'bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                                }`}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Botão de Gravar Grade */}
              <div className={`pt-3 border-t flex items-center justify-between ${
                isDark ? 'border-[#243756]' : 'border-slate-200'
              }`}>
                <span className={`text-[11px] font-mono ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  {currentGridList.filter(r => r.incluir).length} apontamentos selecionados para salvar.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors active:scale-[0.98] cursor-pointer ${
                      isDark ? 'border-[#243756] hover:bg-[#243756] text-[#94A3B8]' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || currentGridList.filter(r => r.incluir).length === 0}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#3B82F6] hover:bg-blue-600 transition-all active:scale-[0.98] shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gravando Grade...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>Gravar Grade ({currentGridList.filter(r => r.incluir).length} Apontamentos)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* MODO 3: FLUXO RÁPIDO CONSECUTIVO (1 A 1 COM ENTER)       */}
          {/* ========================================================= */}
          {activeMode === 'FLUXO_RAPIDO' && safeEmployees.length > 0 && (
            <form onSubmit={handleSaveQuickSingle} className="space-y-4">
              {/* Campo de Busca / Auto-Complete */}
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  1. Matrícula ou Nome do Colaborador *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="Digite a matrícula (ex: 13917) ou nome do colaborador..."
                    value={matriculaQuery}
                    onChange={(e) => {
                      setMatriculaQuery(e.target.value);
                      const direct = safeEmployees.find(
                        (emp) => (emp.matricula || emp.id || '').toString().toUpperCase() === e.target.value.trim().toUpperCase()
                      );
                      setSelectedEmployee(direct || null);
                      setFeedback(null);
                    }}
                    className={`w-full rounded-xl pl-4 pr-10 py-2.5 border text-xs focus:outline-hidden font-mono ${
                      isDark
                        ? 'bg-[#0F1B33] border-[#243756] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white'
                        : 'bg-slate-50 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900'
                    }`}
                  />
                  <Search className={`absolute right-3.5 top-3 w-4 h-4 ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`} />
                </div>

                {/* Sugestões de Auto-complete */}
                {matchingEmployeesQuick.length > 0 && !selectedEmployee && (
                  <div className={`mt-1.5 border rounded-xl max-h-44 overflow-y-auto shadow-xl z-20 divide-y ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] divide-[#243756]' : 'bg-white border-slate-200 divide-slate-100'
                  }`}>
                    {matchingEmployeesQuick.map((emp) => {
                      const mat = emp.matricula || emp.id || '';
                      const initial = (emp.nome || 'C')[0] || '?';

                      return (
                        <button
                          key={emp.id || mat}
                          type="button"
                          onClick={() => handleSelectQuickEmployee(emp)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors active:scale-[0.98] cursor-pointer ${
                            isDark ? 'hover:bg-[#243756]' : 'hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {emp.url_foto_perfil || emp.avatarUrl ? (
                              <img
                                src={emp.url_foto_perfil || emp.avatarUrl}
                                alt={emp.nome || 'Colaborador'}
                                className="w-6 h-6 rounded-full object-cover border"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">
                                {initial}
                              </div>
                            )}
                            <div>
                              <strong className={isDark ? 'text-white' : 'text-slate-900'}>{emp.nome || 'Sem Nome'}</strong>
                              <span className={`ml-2 text-[10px] font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                (#{mat})
                              </span>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 text-[10px] font-mono">
                            {emp.canteiroExecucaoId || emp.sedeCodigo || 'Não informado'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Card do Colaborador Selecionado */}
                {selectedEmployee && (
                  <div className={`mt-2 p-3 rounded-xl border flex items-center justify-between ${
                    isDark ? 'bg-[#0F1B33] border-blue-500/30' : 'bg-blue-50/70 border-blue-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      {selectedEmployee.url_foto_perfil || selectedEmployee.avatarUrl ? (
                        <img
                          src={selectedEmployee.url_foto_perfil || selectedEmployee.avatarUrl}
                          alt={selectedEmployee.nome || 'Colaborador'}
                          className="w-9 h-9 rounded-xl object-cover border border-blue-500/50"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                          {(selectedEmployee.nome || 'C')[0] || '?'}
                        </div>
                      )}
                      <div>
                        <h4 className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedEmployee.nome}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] mt-0.5 font-mono">
                          <span className="text-blue-500">#{selectedEmployee.matricula || selectedEmployee.id}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-400">{selectedEmployee.funcao || 'Operacional'}</span>
                          <span className="text-slate-400">•</span>
                          <span className="px-1 rounded bg-blue-500/10 text-blue-400">
                            Canteiro: {selectedEmployee.canteiroExecucaoId || selectedEmployee.sedeCodigo || 'Não informado'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployee(null);
                        setMatriculaQuery('');
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Data, Tipo e Horas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    2. Data da Ocorrência *
                  </label>
                  <input
                    type="date"
                    required
                    value={dataRegistro}
                    onChange={(e) => setDataRegistro(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 border font-mono text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    3. Tipo de Ocorrência *
                  </label>
                  <select
                    value={tipoOcorrencia}
                    onChange={(e) => {
                      const newType = e.target.value as OccurrenceType;
                      setTipoOcorrencia(newType);
                      if (newType === 'ACABOU_BANHOU') {
                        setHorasBrutas(0);
                        if (!observacao) {
                          setObservacao('Acabou Banhou - Missão cumprida, liberação sem débito em banco de horas.');
                        }
                      }
                    }}
                    className={`w-full rounded-xl px-3 py-2 border font-mono text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  >
                    <option value="ACABOU_BANHOU">✨ ACABOU BANHOU (Sem Débito)</option>
                    <option value="TRABALHO">TRABALHO (Crédito Banco)</option>
                    <option value="COMPENSACAO">COMPENSAÇÃO (Débito Banco)</option>
                    <option value="DISPENSA_OPERACIONAL">DISPENSA OPERACIONAL</option>
                    <option value="FALTA_JUSTIFICADA">FALTA JUSTIFICADA</option>
                    <option value="ATESTADO_MEDICO">ATESTADO MÉDICO</option>
                    <option value="FERIAS">FÉRIAS</option>
                    <option value="FALTA_INJUSTIFICADA">FALTA SEM JUSTIFICATIVA</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    4. Horas Brutas *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    disabled={tipoOcorrencia === 'FALTA_INJUSTIFICADA' || tipoOcorrencia === 'ACABOU_BANHOU'}
                    value={tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : (tipoOcorrencia === 'ACABOU_BANHOU' ? 0.0 : horasBrutas)}
                    onChange={(e) => setHorasBrutas(parseFloat(e.target.value) || 0)}
                    className={`w-full rounded-xl px-3 py-2 border font-mono font-bold text-center text-xs focus:outline-hidden ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>
              </div>

              {/* Botão de Salvar & Próximo */}
              <div className="pt-2 flex items-center justify-between">
                <span className={`text-[11px] font-mono ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  Dica: Pressione <strong className="text-blue-500">ENTER</strong> para salvar e continuar o fluxo.
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all active:scale-[0.98] shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <span>Salvar & Próximo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Histórico Recente de Lançamentos Rápidos */}
              {recentLogs.length > 0 && (
                <div className={`p-3 rounded-xl border space-y-1.5 ${
                  isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                    isDark ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}>
                    Últimos apontamentos salvos nesta sessão:
                  </span>
                  {recentLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2 font-mono text-[11px] text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
