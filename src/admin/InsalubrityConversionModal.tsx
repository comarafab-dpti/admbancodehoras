import React, { useState, useMemo } from 'react';
import { InsalubrityRecord, Employee, AdminRole, Branch } from '@/src/shared/types';
import { 
  ArrowRightLeft, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Filter, 
  ShieldAlert, 
  Layers, 
  HardHat, 
  FileCheck2, 
  HelpCircle,
  Clock,
  Calendar,
  Check,
  ChevronRight
} from 'lucide-react';

interface InsalubrityConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  insalubrityRecords: InsalubrityRecord[];
  employees: Employee[];
  currentUserEmail?: string;
  userRole?: AdminRole;
  theme?: 'dark' | 'light';
  onSaveConvertedBatch: (records: InsalubrityRecord[]) => Promise<void>;
  onSwitchToAdvancedView?: () => void;
}

// Mapeamento Inteligente Padrão COMARA / NR-15
interface ActivityRule {
  grau: '10%' | '20%' | '40%';
  nr15Ref: string;
  horasPadrao: number;
  descricaoTecnica: string;
}

const NR15_DEFAULT_RULES: Record<string, ActivityRule> = {
  'ASFALTO': {
    grau: '40%',
    nr15Ref: 'NR-15 Anexo 13 (Hidrocarbonetos Aromáticos e Alcatrão)',
    horasPadrao: 8,
    descricaoTecnica: 'Manipulação e aplicação de asfalto a quente e emulsões asfálticas'
  },
  'EMULSAO': {
    grau: '40%',
    nr15Ref: 'NR-15 Anexo 13 (Hidrocarbonetos)',
    horasPadrao: 8,
    descricaoTecnica: 'Aplicação de emulsão asfáltica com solventes'
  },
  'ESGOTO': {
    grau: '40%',
    nr15Ref: 'NR-15 Anexo 14 (Agentes Biológicos)',
    horasPadrao: 8,
    descricaoTecnica: 'Trabalho ou contato permanente com esgotos e galerias'
  },
  'LIMPEZA DE FOSSA': {
    grau: '40%',
    nr15Ref: 'NR-15 Anexo 14 (Agentes Biológicos)',
    horasPadrao: 8,
    descricaoTecnica: 'Esgotamento e limpeza de fossas sépticas'
  },
  'CONCRETO': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 13 (Álcalis Cáusticos) / Anexo 12',
    horasPadrao: 8,
    descricaoTecnica: 'Preparo, lançamento e adensamento de concreto e cimento'
  },
  'BRITADOR': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 12 (Poeiras Minerais) / Anexo 1 (Ruído)',
    horasPadrao: 8,
    descricaoTecnica: 'Operação e alimentação de central de britagem de agregados'
  },
  'CANALETA': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 13 (Umidade e Manuseio de Cimento)',
    horasPadrao: 8,
    descricaoTecnica: 'Confecção, assentamento e rejunte de canaletas de drenagem'
  },
  'DRENAGEM': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 10 (Umidade Excessiva)',
    horasPadrao: 8,
    descricaoTecnica: 'Escavação e execução de galerias pluviais em áreas alagadiças'
  },
  'MANUTENÇÃO': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 13 (Óleos Minerais e Graxas)',
    horasPadrao: 8,
    descricaoTecnica: 'Manutenção mecânica de máquinas pesadas com óleos e lubrificantes'
  },
  'MANUTENCAO': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 13 (Óleos Minerais e Graxas)',
    horasPadrao: 8,
    descricaoTecnica: 'Manutenção mecânica de máquinas pesadas com óleos e lubrificantes'
  },
  'PINTURA': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 11/13 (Solventes Orgânicos e Pigmentos)',
    horasPadrao: 8,
    descricaoTecnica: 'Pintura a pistola ou rolo com tintas à base de solventes'
  },
  'CAMARA FRIGORIFICA': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 9 (Frio Artificial)',
    horasPadrao: 8,
    descricaoTecnica: 'Trabalho no interior de câmaras frigoríficas'
  },
  'TERRAPLENAGEM': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 1/8 (Ruído Contínuo e Vibração de Corpo Inteiro)',
    horasPadrao: 8,
    descricaoTecnica: 'Operação de trator de esteira, motoniveladora ou rolo compactador'
  },
  'CARPINTARIA': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 1 (Ruído de Serra Circular / Poeiras)',
    horasPadrao: 8,
    descricaoTecnica: 'Corte e montagem de formas de madeira para concretagem'
  },
  'ARMADOR': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 1 (Ruído e Manuseio de Aço)',
    horasPadrao: 8,
    descricaoTecnica: 'Corte, dobra e amarração de ferragens estruturais'
  },
  'TOPOGRAFIA': {
    grau: '10%',
    nr15Ref: 'NR-15 Anexo 7 (Radiações Não Ionizantes / Calor a Céu Aberto)',
    horasPadrao: 8,
    descricaoTecnica: 'Levantamento topográfico com exposição solar contínua'
  },
  'SERVICOS GERAIS': {
    grau: '20%',
    nr15Ref: 'NR-15 Anexo 13 (Manuseio de Materiais de Construção)',
    horasPadrao: 8,
    descricaoTecnica: 'Apoio em frentes de serviço pesadas de canteiro'
  }
};

export const InsalubrityConversionModal: React.FC<InsalubrityConversionModalProps> = ({
  isOpen,
  onClose,
  insalubrityRecords,
  employees,
  currentUserEmail = 'gestor@rh.cloud',
  userRole = 'SUPER_ADMIN',
  theme = 'dark',
  onSaveConvertedBatch,
  onSwitchToAdvancedView
}) => {
  const isDark = theme === 'dark';

  // Filtros de seleção
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterSede, setFilterSede] = useState<string>('TODAS');
  const [filterActivitySearch, setFilterActivitySearch] = useState<string>('');

  // Configuração personalizada de mapeamento de cada atividade encontrada
  const [activityRulesConfig, setActivityRulesConfig] = useState<Record<string, { grau: '10%' | '20%' | '40%'; horas: number; nr15: string }>>({});

  // Atividades selecionadas para conversão
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  
  // Status de execução
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState<{ count: number; date: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Identificar registros do período/sede selecionado
  const candidateRecords = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const registeredMatriculas = new Set(employees.map(e => e.matricula.trim().toUpperCase()));

    return insalubrityRecords.filter((rec) => {
      const cleanMat = (rec.matricula || '').trim().toUpperCase();
      if (!registeredMatriculas.has(cleanMat)) return false;

      // Filtrar por Mês (YYYY-MM) se selecionado
      if (filterMonth && !rec.dataEvento.startsWith(filterMonth)) {
        return false;
      }
      // Filtrar por Sede
      if (filterSede !== 'TODAS' && rec.sede !== filterSede) {
        return false;
      }
      return true;
    });
  }, [employees, insalubrityRecords, filterMonth, filterSede]);

  // 2. Agrupar por Atividade
  const activitiesSummary = useMemo(() => {
    const map = new Map<string, { count: number; employees: Set<string>; sampleDates: string[] }>();

    candidateRecords.forEach((rec) => {
      const act = (rec.atividadeDesempenhada || 'OUTROS').trim().toUpperCase();
      if (!map.has(act)) {
        map.set(act, { count: 0, employees: new Set(), sampleDates: [] });
      }
      const data = map.get(act)!;
      data.count++;
      data.employees.add(rec.matricula);
      if (data.sampleDates.length < 3 && !data.sampleDates.includes(rec.dataEvento)) {
        data.sampleDates.push(rec.dataEvento);
      }
    });

    return Array.from(map.entries()).map(([activity, data]) => {
      // Buscar regra padrão
      const normKey = Object.keys(NR15_DEFAULT_RULES).find(k => activity.includes(k)) || '';
      const defaultRule = normKey ? NR15_DEFAULT_RULES[normKey] : {
        grau: '20%' as const,
        nr15Ref: 'NR-15 Portaria 3.214/78 (Grau Médio Padrão)',
        horasPadrao: 8,
        descricaoTecnica: 'Atividade de campo com exposição a agentes insalubres'
      };

      return {
        activity,
        count: data.count,
        employeeCount: data.employees.size,
        sampleDates: data.sampleDates,
        defaultGrau: defaultRule.grau,
        nr15Ref: defaultRule.nr15Ref,
        horasPadrao: defaultRule.horasPadrao,
        descricaoTecnica: defaultRule.descricaoTecnica,
      };
    }).sort((a, b) => b.count - a.count);
  }, [candidateRecords]);

  // Inicializar regras e seleções quando as atividades mudam
  React.useEffect(() => {
    const initialConfig: Record<string, { grau: '10%' | '20%' | '40%'; horas: number; nr15: string }> = {};
    const allActKeys: string[] = [];

    activitiesSummary.forEach((item) => {
      allActKeys.push(item.activity);
      initialConfig[item.activity] = {
        grau: activityRulesConfig[item.activity]?.grau || item.defaultGrau,
        horas: activityRulesConfig[item.activity]?.horas || item.horasPadrao,
        nr15: activityRulesConfig[item.activity]?.nr15 || item.nr15Ref
      };
    });

    setActivityRulesConfig(prev => ({ ...initialConfig, ...prev }));
    setSelectedActivities(allActKeys);
    setConversionSuccess(null);
    setErrorMessage(null);
  }, [activitiesSummary]);

  // Filtrar atividades exibidas
  const filteredActivities = useMemo(() => {
    if (!filterActivitySearch.trim()) return activitiesSummary;
    const q = filterActivitySearch.toLowerCase().trim();
    return activitiesSummary.filter(a => a.activity.toLowerCase().includes(q));
  }, [activitiesSummary, filterActivitySearch]);

  // Total de registros que serão convertidos
  const totalRecordsToConvert = useMemo(() => {
    return candidateRecords.filter(r => {
      const act = (r.atividadeDesempenhada || 'OUTROS').trim().toUpperCase();
      return selectedActivities.includes(act);
    }).length;
  }, [candidateRecords, selectedActivities]);

  // Toggle de seleção de atividade
  const handleToggleActivity = (act: string) => {
    if (selectedActivities.includes(act)) {
      setSelectedActivities(selectedActivities.filter(a => a !== act));
    } else {
      setSelectedActivities([...selectedActivities, act]);
    }
  };

  const handleSelectAllActivities = () => {
    setSelectedActivities(activitiesSummary.map(a => a.activity));
  };

  const handleDeselectAllActivities = () => {
    setSelectedActivities([]);
  };

  // Alterar Grau de uma Atividade
  const handleChangeGrau = (act: string, grau: '10%' | '20%' | '40%') => {
    setActivityRulesConfig(prev => ({
      ...prev,
      [act]: {
        ...prev[act],
        grau,
      }
    }));
  };

  // Alterar Horas de uma Atividade
  const handleChangeHoras = (act: string, horas: number) => {
    setActivityRulesConfig(prev => ({
      ...prev,
      [act]: {
        ...prev[act],
        horas: Math.max(1, Math.min(24, horas)),
      }
    }));
  };

  // EXECUTAR CONVERSÃO EM LOTE
  const handleExecuteConversion = async () => {
    if (selectedActivities.length === 0) {
      setErrorMessage('Selecione pelo menos um serviço/atividade para converter.');
      return;
    }

    if (totalRecordsToConvert === 0) {
      setErrorMessage('Nenhum registro encontrado com os filtros selecionados.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Mapear e enriquecer os registros com a classificação avançada NR-15
      const nowIso = new Date().toISOString();
      const updatedList: InsalubrityRecord[] = [];

      candidateRecords.forEach((rec) => {
        const act = (rec.atividadeDesempenhada || 'OUTROS').trim().toUpperCase();
        if (selectedActivities.includes(act)) {
          const config = activityRulesConfig[act] || {
            grau: '20%',
            horas: 8,
            nr15: 'NR-15'
          };

          const oldObs = rec.observacoes ? rec.observacoes.trim() : '';
          const conversionNote = `[Classificado NR-15 (${config.grau}) por ${currentUserEmail} em ${new Date().toLocaleDateString('pt-BR')}]`;
          const finalObs = oldObs ? `${oldObs} | ${conversionNote}` : conversionNote;

          updatedList.push({
            ...rec,
            grauExposicao: config.grau,
            quantidadeHorasDias: config.horas,
            unidade: 'HORAS',
            observacoes: finalObs,
            atualizadoEm: nowIso,
            editadoPor: currentUserEmail,
            editadoEm: nowIso,
          });
        }
      });

      await onSaveConvertedBatch(updatedList);

      setConversionSuccess({
        count: updatedList.length,
        date: new Date().toLocaleTimeString('pt-BR')
      });
    } catch (err: any) {
      console.error('Erro na conversão de insalubridade:', err);
      setErrorMessage(err?.message || 'Falha ao executar conversão em lote.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
        isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Cabeçalho do Modal */}
        <div className="p-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">
                  Converter Lançamentos Simples para Modo Avançado (NR-15)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Perfil Gestor / Admin
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Transforme apontamentos simples de campo (o que a pessoa fez) em cálculos oficiais de insalubridade com enquadramento NR-15 (10%, 20%, 40%)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer ${
              isDark ? 'hover:bg-[#243756] text-gray-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback de Sucesso */}
        {conversionSuccess ? (
          <div className="p-8 text-center space-y-5 my-auto overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-black">Conversão Concluída com Sucesso!</h4>
              <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                Foram convertidos e classificados <strong>{conversionSuccess.count} registros</strong> de atividades de campo em eventos oficiais de insalubridade NR-15 às {conversionSuccess.date}.
              </p>
            </div>

            <div className={`p-4 rounded-xl max-w-lg mx-auto border text-left text-xs space-y-2 ${
              isDark ? 'bg-[#0F1B33] border-[#243756] text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>O que aconteceu com os dados:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400">
                <li>Graus de insalubridade (10%, 20%, 40%) foram atribuídos a cada serviço</li>
                <li>Horas diárias computadas (8.0h por apontamento) para a folha de pagamento</li>
                <li>Registros sincronizados com auditoria de alteração por <strong>{currentUserEmail}</strong></li>
                <li>Disponíveis imediatamente no Relatório Avançado e na Ficha de Insalubridade</li>
              </ul>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-5 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
                  isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Fechar
              </button>

              {onSwitchToAdvancedView && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSwitchToAdvancedView();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-98 transition-all cursor-pointer"
                >
                  <Layers className="w-4 h-4" />
                  <span>Ver no Modo Avançado / Relatórios</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Corpo de Configuração de Conversão */
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            {/* Mensagem de Erro */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 1. Barra de Filtros Rápidos (Mês e Canteiro) */}
            <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                    Mês de Referência:
                  </label>
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none cursor-pointer ${
                      isDark ? 'bg-[#16243D] border-[#335075] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-amber-600'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                    Canteiro / Sede:
                  </label>
                  <select
                    value={filterSede}
                    onChange={(e) => setFilterSede(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold outline-none cursor-pointer ${
                      isDark ? 'bg-[#16243D] border-[#335075] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-white border-slate-300 text-slate-900 focus:border-amber-600'
                    }`}
                  >
                    <option value="TODAS">Todos os Canteiros</option>
                    <option value="KO">KO (Coari)</option>
                    <option value="BE">BE (Belém)</option>
                    <option value="MN">MN (Manaus)</option>
                    <option value="SP">SP (São Paulo)</option>
                    <option value="RJ">RJ (Rio)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                    Filtrar Serviço:
                  </label>
                  <input
                    type="text"
                    value={filterActivitySearch}
                    onChange={(e) => setFilterActivitySearch(e.target.value)}
                    placeholder="Buscar serviço..."
                    className={`px-3 py-1.5 rounded-lg border text-xs outline-none ${
                      isDark ? 'bg-[#16243D] border-[#335075] text-white placeholder-gray-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Estatísticas Rápidas do Lote */}
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block font-bold">Lançamentos no Período</span>
                  <span className="text-base font-black text-amber-400">{candidateRecords.length}</span>
                </div>
                <div className="border-l border-black/10 dark:border-white/10 pl-4">
                  <span className="text-[10px] text-gray-400 uppercase block font-bold">Selecionados p/ Converter</span>
                  <span className="text-base font-black text-blue-400">{totalRecordsToConvert}</span>
                </div>
              </div>
            </div>

            {/* 2. Lista de Atividades Encontradas e Mapeamento NR-15 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-amber-500" />
                  <span className="font-bold uppercase text-xs">
                    Mapeamento de Serviços → Enquadramento NR-15 ({activitiesSummary.length} serviços identificados):
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={handleSelectAllActivities}
                    className="text-blue-400 hover:underline cursor-pointer font-bold"
                  >
                    Selecionar Todos
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllActivities}
                    className="text-gray-400 hover:underline cursor-pointer"
                  >
                    Desmarcar Todos
                  </button>
                </div>
              </div>

              {activitiesSummary.length === 0 ? (
                <div className={`p-8 rounded-xl border text-center ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  Nenhum registro de atividade de campo localizado para o período e canteiro selecionados.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredActivities.map((item) => {
                    const isSelected = selectedActivities.includes(item.activity);
                    const currentRule = activityRulesConfig[item.activity] || {
                      grau: item.defaultGrau,
                      horas: item.horasPadrao,
                      nr15: item.nr15Ref
                    };

                    return (
                      <div
                        key={item.activity}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? isDark
                              ? 'bg-[#1B2D4A] border-blue-500/40 shadow-sm'
                              : 'bg-blue-50/50 border-blue-300 shadow-sm'
                            : isDark
                              ? 'bg-[#0F1B33] border-[#243756] opacity-60'
                              : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Lado Esquerdo: Checkbox e Nome do Serviço */}
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleActivity(item.activity)}
                              className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-amber-400 tracking-wide font-mono">
                                  {item.activity}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'} • {item.employeeCount} {item.employeeCount === 1 ? 'colaborador' : 'colaboradores'}
                                </span>
                              </div>
                              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                                {item.descricaoTecnica} — <em>{item.nr15Ref}</em>
                              </p>
                            </div>
                          </div>

                          {/* Lado Direito: Seleção do Grau NR-15 e Horas */}
                          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                            {/* Seletor de Grau */}
                            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-black/10 dark:border-white/5">
                              {(['10%', '20%', '40%'] as const).map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  disabled={!isSelected}
                                  onClick={() => handleChangeGrau(item.activity, g)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all active:scale-[0.98] cursor-pointer ${
                                    currentRule.grau === g
                                      ? g === '40%'
                                        ? 'bg-red-600 text-white font-black shadow-xs'
                                        : g === '20%'
                                          ? 'bg-amber-500 text-black font-black shadow-xs'
                                          : 'bg-blue-600 text-white font-black shadow-xs'
                                      : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                                  }`}
                                >
                                  {g} {g === '40%' ? 'Máx' : g === '20%' ? 'Méd' : 'Mín'}
                                </button>
                              ))}
                            </div>

                            {/* Horas por dia */}
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={24}
                                step={0.5}
                                disabled={!isSelected}
                                value={currentRule.horas}
                                onChange={(e) => handleChangeHoras(item.activity, Number(e.target.value))}
                                className={`w-14 px-2 py-1 rounded-lg border text-center font-mono font-bold text-xs outline-none ${
                                  isDark ? 'bg-[#0F1B33] border-[#335075] text-white' : 'bg-white border-slate-300 text-slate-900'
                                }`}
                              />
                              <span className="text-[10px] text-gray-400 font-mono">h/dia</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rodapé de Ações */}
        {!conversionSuccess && (
          <div className="p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>A conversão mantém a rastreabilidade original e gera a memória de cálculo NR-15.</span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors active:scale-[0.98] ${
                  isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteConversion}
                disabled={isProcessing || totalRecordsToConvert === 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-blue-600 hover:from-amber-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processando e Gravando no banco de dados...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Executar Conversão ({totalRecordsToConvert} Lançamentos)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
