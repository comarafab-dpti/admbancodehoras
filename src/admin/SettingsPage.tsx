import React, { useState, useEffect, useMemo } from 'react';
import { useInstitution } from '@/src/shared/contexts/InstitutionContext';
import { InstitutionSettings, DEFAULT_INSTITUTION_SETTINGS } from '@/src/shared/types/institutionConfig';
import { IdentificacaoTab } from './settings/IdentificacaoTab';
import { CargosTab } from './settings/CargosTab';
import { SedesTab } from './settings/SedesTab';
import { HorariosRegrasTab } from './settings/HorariosRegrasTab';
import { DocumentosModeloTab } from './settings/DocumentosModeloTab';
import { 
  Building, 
  Award, 
  Building2, 
  Clock, 
  FileText, 
  Save, 
  RotateCcw, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  HelpCircle,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';
import { InfoTooltip } from '@/src/shared/components/InfoTooltip';

export type SettingsTabKey = 'identificacao' | 'cargos' | 'sedes' | 'horarios_regras' | 'documentos';

interface SettingsPageProps {
  theme: 'dark' | 'light';
  currentUserEmail?: string;
  userRole?: string;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  currentUserEmail,
  userRole,
  onShowToast,
}) => {
  const isDark = theme === 'dark';
  const { 
    settings: cloudSettings, 
    isLoading, 
    isUpdating, 
    error: contextError, 
    lastUpdated, 
    updateSettings, 
    resetToDefaults, 
    canEditSettings 
  } = useInstitution();

  // Estado de formulário local para edição antes de persistir
  const [formData, setFormData] = useState<InstitutionSettings>(cloudSettings);
  const [activeSubTab, setActiveSubTab] = useState<SettingsTabKey>('identificacao');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Sincroniza estado local quando as configurações da nuvem carregarem ou forem alteradas externamente
  useEffect(() => {
    if (cloudSettings) {
      setFormData(cloudSettings);
    }
  }, [cloudSettings]);

  // Limpa alerta de sucesso após alguns segundos
  useEffect(() => {
    if (saveSuccessNotice) {
      const timer = setTimeout(() => setSaveSuccessNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessNotice]);

  // Validação dos campos obrigatórios
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.nomeInstituicao?.trim()) {
      errors.nomeInstituicao = 'O nome da instituição / OM é obrigatório.';
    }

    if (!formData.siglaInstituicao?.trim()) {
      errors.siglaInstituicao = 'A sigla da instituição é obrigatória.';
    }

    if (!formData.endereco?.trim()) {
      errors.endereco = 'O endereço da sede é obrigatório.';
    }

    if (!formData.email?.trim()) {
      errors.email = 'O e-mail oficial é obrigatório.';
    } else if (!formData.email.includes('@')) {
      errors.email = 'Insira um e-mail válido.';
    }

    if (!formData.horarios?.inicioAlmoco) {
      errors.inicioAlmoco = 'Defina o horário inicial de almoço.';
    }

    if (!formData.horarios?.fimAlmoco) {
      errors.fimAlmoco = 'Defina o horário final de almoço.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Manipulador de salvamento
  const handleSave = async () => {
    if (!canEditSettings) {
      const msg = 'Acesso Negado: Apenas o Administrador Geral (SUPER_ADMIN / TI) pode alterar configurações.';
      if (onShowToast) onShowToast(msg, 'error');
      return;
    }

    if (!validateForm()) {
      setActiveSubTab('identificacao');
      const msg = 'Por favor, preencha os campos obrigatórios destacados em vermelho.';
      if (onShowToast) onShowToast(msg, 'error');
      return;
    }

    try {
      const { sedes: _legacySedes, ...institutionSettings } = formData;
      await updateSettings(institutionSettings);
      setSaveSuccessNotice('Configurações institucionais gravadas com sucesso no banco de dados!');
      if (onShowToast) onShowToast('Configurações institucionais atualizadas com sucesso!', 'success');
    } catch (err: any) {
      console.error('[SettingsPage] Erro ao salvar configurações:', err);
      const msg = err?.message || 'Falha ao gravar configurações institucionais.';
      if (onShowToast) onShowToast(msg, 'error');
    }
  };

  // Manipulador de restauração
  const handleConfirmReset = async () => {
    setIsResetModalOpen(false);
    try {
      await resetToDefaults();
      setFormData(DEFAULT_INSTITUTION_SETTINGS);
      setSaveSuccessNotice('Configurações restauradas com sucesso para os padrões oficiais da COMARA.');
      if (onShowToast) onShowToast('Padrões oficiais COMARA restaurados.', 'info');
    } catch (err: any) {
      const msg = err?.message || 'Falha ao restaurar configurações padrão.';
      if (onShowToast) onShowToast(msg, 'error');
    }
  };

  // Verifica se o usuário atual é SUPER_ADMIN
  if (!canEditSettings && userRole !== 'SUPER_ADMIN') {
    return (
      <div className={`p-8 rounded-2xl border text-center max-w-2xl mx-auto my-12 ${
        isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
      }`}>
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold mb-2">Painel de Configurações Institucionais Restrito</h3>
        <p className={`text-xs max-w-md mx-auto mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
          A parametrização de identidade da Organização Militar, cargos de comando, horários e normas de cálculo é restrita exclusivamente ao Administrador Geral (SUPER_ADMIN / TI).
        </p>
        <div className={`p-3 rounded-xl text-xs font-mono inline-block ${
          isDark ? 'bg-[#0F1B33] text-amber-400 border border-[#335075]' : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          Sua credencial atual: {currentUserEmail || 'Não identificado'} ({userRole || 'SEM_PERFIL'})
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO DA TELA DE CONFIGURAÇÕES */}
      {/* ========================================================= */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            isDark
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-blue-50 text-blue-600 border-blue-200'
          }`}>
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight">
                Configurações da Instituição
              </h1>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isDark ? 'bg-[#243756] text-blue-400 border-[#335075]' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {formData.siglaInstituicao || 'OM'} • v{formData.versao || 1}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Super Admin TI
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Parâmetros e identidade da instituição <InfoTooltip theme={isDark ? 'dark' : 'light'} content="Personalize a identidade da Organização Militar, cargos de chefia, canteiros ativos, regras de almoço e modelos de documentos impressos." />
              </p>
            {formData.atualizadoEm && (
              <p className={`text-[11px] mt-1 font-mono ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
                Última alteração: {new Date(formData.atualizadoEm).toLocaleString('pt-BR')} por {formData.atualizadoPor || 'Super Administrador'}
              </p>
            )}
          </div>
        </div>

        {/* Ações do Topo */}
        <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors active:scale-[0.98] cursor-pointer ${
              isDark
                ? 'bg-[#16243D] hover:bg-[#243756] text-[#94A3B8] hover:text-white border-[#335075]'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Restaurar valores padrão originais da COMARA"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar Padrões</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isUpdating || isLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gravando no banco de dados...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Configurações</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. AVISOS & STATUS (SUCESSO / ERRO / CONEXÃO) */}
      {/* ========================================================= */}
      {saveSuccessNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessNotice(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
          >
            Fechar
          </button>
        </div>
      )}

      {contextError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{contextError}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. BARRA DE NAVEGAÇÃO ENTRE ABAS */}
      {/* ========================================================= */}
      <div className={`p-1.5 rounded-2xl border flex items-center gap-1.5 overflow-x-auto ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-slate-100 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={() => setActiveSubTab('identificacao')}
          className={`flex-1 min-w-[170px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'identificacao'
              ? isDark
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-blue-700 shadow-xs'
              : isDark
                ? 'text-[#94A3B8] hover:text-white hover:bg-[#243756]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Identificação da OM</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('cargos')}
          className={`flex-1 min-w-[170px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'cargos'
              ? isDark
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-blue-700 shadow-xs'
              : isDark
                ? 'text-[#94A3B8] hover:text-white hover:bg-[#243756]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Cargos e Assinaturas</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeSubTab === 'cargos'
              ? 'bg-white/20 text-white'
              : isDark ? 'bg-[#0F1B33] text-gray-400' : 'bg-slate-200 text-slate-600'
          }`}>
            {formData.cargos?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('sedes')}
          className={`flex-1 min-w-[170px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'sedes'
              ? isDark
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-blue-700 shadow-xs'
              : isDark
                ? 'text-[#94A3B8] hover:text-white hover:bg-[#243756]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Sedes / Canteiros</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeSubTab === 'sedes'
              ? 'bg-white/20 text-white'
              : isDark ? 'bg-[#0F1B33] text-gray-400' : 'bg-slate-200 text-slate-600'
          }`}>
            {formData.sedes?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('horarios_regras')}
          className={`flex-1 min-w-[170px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'horarios_regras'
              ? isDark
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-blue-700 shadow-xs'
              : isDark
                ? 'text-[#94A3B8] hover:text-white hover:bg-[#243756]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Horários e Regras</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('documentos')}
          className={`flex-1 min-w-[170px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'documentos'
              ? isDark
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-blue-700 shadow-xs'
              : isDark
                ? 'text-[#94A3B8] hover:text-white hover:bg-[#243756]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Documentos Modelo</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 4. CONTEÚDO DA ABA ATIVA */}
      {/* ========================================================= */}
      <div>
        {activeSubTab === 'identificacao' && (
          <IdentificacaoTab
            settings={formData}
            onChange={(partial) => setFormData((prev) => ({ ...prev, ...partial }))}
            errors={validationErrors}
            isDark={isDark}
          />
        )}

        {activeSubTab === 'cargos' && (
          <CargosTab
            cargos={formData.cargos || []}
            onChange={(newCargos) => setFormData((prev) => ({ ...prev, cargos: newCargos }))}
            isDark={isDark}
          />
        )}

        {activeSubTab === 'sedes' && (
          <SedesTab
            isDark={isDark}
          />
        )}

        {activeSubTab === 'horarios_regras' && (
          <HorariosRegrasTab
            horarios={formData.horarios}
            regrasCalculo={formData.regrasCalculo}
            onUpdateHorarios={(partial) =>
              setFormData((prev) => ({
                ...prev,
                horarios: { ...prev.horarios, ...partial },
              }))
            }
            onUpdateRegras={(partial) =>
              setFormData((prev) => ({
                ...prev,
                regrasCalculo: { ...prev.regrasCalculo, ...partial },
              }))
            }
            isDark={isDark}
          />
        )}

        {activeSubTab === 'documentos' && (
          <DocumentosModeloTab
            documentos={formData.documentosModelo}
            onChange={(partial) =>
              setFormData((prev) => ({
                ...prev,
                documentosModelo: { ...prev.documentosModelo, ...partial },
              }))
            }
            isDark={isDark}
          />
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. RODAPÉ DE AÇÃO FIXO / FINAL */}
      {/* ========================================================= */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            Ao salvar, as alterações entram em vigor imediatamente para todos os módulos e usuários logados via sincronização em tempo real.
          </span>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isUpdating || isLoading}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer shrink-0"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Gravando...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Salvar Todas as Configurações</span>
            </>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* 6. MODAL DE CONFIRMAÇÃO DE RESTAURAÇÃO */}
      {/* ========================================================= */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Restaurar Padrões Oficiais COMARA?</h4>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Esta ação redefinirá os nomes, cargos e textos modelo.
                </p>
              </div>
            </div>

            <p className={`text-xs mb-6 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
              Todas as configurações atuais da instituição serão substituídas pelos valores padrões de fábrica da Comissão de Aeroportos da Região Amazônica (COMARA).
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                  isDark ? 'border-[#335075] text-gray-400 hover:text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs"
              >
                Sim, Restaurar Padrões
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
