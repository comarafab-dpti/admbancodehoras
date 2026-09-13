import React, { useState } from 'react';
import { SystemConfig } from '@/src/shared/types';
import { ComaraLogo } from '@/src/shared/components/ComaraLogo';
import { 
  ImageIcon, 
  Upload, 
  Trash2, 
  Link as LinkIcon, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Sparkles,
  RefreshCw,
  Building2
} from 'lucide-react';

interface ComaraLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: SystemConfig;
  onSaveConfig: (config: SystemConfig) => Promise<void>;
  theme?: 'dark' | 'light';
}

export const ComaraLogoModal: React.FC<ComaraLogoModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSaveConfig,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [logoUrl, setLogoUrl] = useState(currentConfig.logoUrl || '');
  const [companyName, setCompanyName] = useState(currentConfig.companyName || 'COMARA');
  const [subtitle, setSubtitle] = useState(currentConfig.subtitle || 'Comissão de Aeroportos da Região Amazônica');
  const [insalubrityMode, setInsalubrityMode] = useState<'COMPLETA' | 'SIMPLES'>(currentConfig.insalubrityMode || 'SIMPLES');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', text: 'Por favor, selecione um arquivo de imagem válido (PNG, JPG ou SVG).' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'A imagem deve ter no máximo 2MB de tamanho.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLogoUrl(dataUrl);
      setFeedback({ type: 'success', text: 'Imagem carregada localmente. Clique em Salvar para sincronizar no banco de dados.' });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      await onSaveConfig({
        logoUrl: logoUrl.trim(),
        companyName: companyName.trim() || 'COMARA',
        subtitle: subtitle.trim() || 'Comissão de Aeroportos da Região Amazônica',
        insalubrityMode,
        atualizadoEm: new Date().toISOString(),
      });
      setFeedback({ type: 'success', text: 'Configurações globais e identidade visual da COMARA atualizadas com sucesso!' });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Erro ao salvar logo:', err);
      setFeedback({ type: 'error', text: err?.message || 'Falha ao salvar configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setLogoUrl('');
    setCompanyName('COMARA');
    setSubtitle('Comissão de Aeroportos da Região Amazônica');
    setInsalubrityMode('SIMPLES');
    setFeedback({ type: 'success', text: 'Restaurado para o brasão vetorial oficial e modo simples padrão.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono">
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden relative ${
        isDark ? 'bg-[#16243D] border-[#243756] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Identidade Visual & Logomarca COMARA</h3>
              <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Personalização do cabeçalho, tela de login e relatórios oficiais
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer ${
              isDark ? 'hover:bg-[#243756] text-gray-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
          {/* Feedback */}
          {feedback && (
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Live Preview Box */}
          <div className={`p-4 rounded-xl border text-center space-y-2 ${
            isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Pré-visualização em Tempo Real
            </span>
            <div className="py-2 flex items-center justify-center">
              <ComaraLogo
                logoUrl={logoUrl}
                size="xl"
                showText={true}
                subtitle={subtitle}
                theme={theme}
              />
            </div>
            <p className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`}>
              {logoUrl ? 'Utilizando imagem personalizada' : 'Utilizando brasão vetorial oficial padrão'}
            </p>
          </div>

          {/* Upload Button or URL Input */}
          <div className="space-y-3">
            <div>
              <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                1. CARREGAR ARQUIVO DE IMAGEM DA LOGO (PNG / JPG / SVG)
              </label>
              <label className={`w-full py-3 px-4 border border-dashed rounded-xl flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-[0.98] ${
                isDark 
                  ? 'border-[#335075] hover:border-blue-500 bg-[#0F1B33]/50 hover:bg-blue-500/5 text-blue-400' 
                  : 'border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 text-blue-600'
              }`}>
                <Upload className="w-4 h-4" />
                <span className="font-bold">Selecionar Logo do Computador</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className={`block font-bold mb-1.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                2. OU INFORME A URL DA IMAGEM
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://exemplo.com/logo-comara.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono outline-hidden transition-colors ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                <LinkIcon className={`w-4 h-4 absolute right-3 top-3 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className={`block font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                  SIGLA / NOME PRINCIPAL
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="COMARA"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-hidden ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block font-bold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                  SUBTÍTULO INSTITUCIONAL
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Comissão de Aeroportos da Região Amazônica"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-hidden ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Configuração do Modo de Insalubridade */}
            <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
              <label className={`block font-bold mb-1.5 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                MODO DO MÓDULO DE INSALUBRIDADE
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInsalubrityMode('SIMPLES')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    insalubrityMode === 'SIMPLES'
                      ? isDark
                        ? 'bg-amber-950/40 border-amber-500/60 text-white font-bold shadow-xs'
                        : 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-xs'
                      : isDark
                        ? 'bg-[#16243D] border-[#243756] text-[#94A3B8] hover:text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="text-xs flex items-center justify-between">
                    <span>📋 Modo Simples (Planilha)</span>
                    {insalubrityMode === 'SIMPLES' && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
                  </div>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                    Matriz mensal com dias do mês (1..31), atividades em destaque e cálculo automático de dias.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setInsalubrityMode('COMPLETA')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    insalubrityMode === 'COMPLETA'
                      ? isDark
                        ? 'bg-blue-950/40 border-blue-500/60 text-white font-bold shadow-xs'
                        : 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-xs'
                      : isDark
                        ? 'bg-[#16243D] border-[#243756] text-[#94A3B8] hover:text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="text-xs flex items-center justify-between">
                    <span>⚙️ Modo Completo</span>
                    {insalubrityMode === 'COMPLETA' && <span className="w-2 h-2 rounded-full bg-blue-400"></span>}
                  </div>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                    Visão detalhada por ocorrências, guias NR-15 e controle de percentual fixo contratual.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetToDefault}
              className={`text-[11px] font-bold flex items-center gap-1.5 transition-colors active:scale-[0.98] cursor-pointer ${
                isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restaurar Brasão Padrão</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl border font-bold text-xs transition-colors active:scale-[0.98] cursor-pointer ${
                  isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
