import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Download, 
  CheckCircle2, 
  X, 
  Trash2, 
  RotateCcw, 
  Database, 
  Save, 
  History, 
  Info,
  Clock,
  Users,
  FileSpreadsheet,
  Building2
} from 'lucide-react';
import { Employee, TimeRecord, InsalubrityRecord, ConstructionSite, SystemConfig } from '@/src/shared/types';

export type SafetyActionType = 'CLEAR_DATABASE' | 'LOAD_MOCKS';

interface SafetyBackupSnapshot {
  timestamp: string;
  formattedDate: string;
  data: {
    employees: Employee[];
    records: TimeRecord[];
    insalubrityRecords: InsalubrityRecord[];
    constructionSites: ConstructionSite[];
    systemConfig?: SystemConfig;
  };
  stats: {
    totalEmployees: number;
    totalRecords: number;
    totalInsalubrity: number;
    totalSites: number;
  };
}

const RESTORE_POINT_STORAGE_KEY = 'comara_safety_restore_point_v1';

interface DatabaseSafetyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: SafetyActionType;
  employees: Employee[];
  records: TimeRecord[];
  insalubrityRecords?: InsalubrityRecord[];
  constructionSites?: ConstructionSite[];
  systemConfig?: SystemConfig;
  onConfirmClear: () => Promise<void> | void;
  onConfirmLoadMocks: () => Promise<void> | void;
  onRestoreSnapshot?: (snapshot: SafetyBackupSnapshot) => Promise<void> | void;
  theme?: 'dark' | 'light';
}

export const DatabaseSafetyActionModal: React.FC<DatabaseSafetyActionModalProps> = ({
  isOpen,
  onClose,
  actionType,
  employees,
  records,
  insalubrityRecords = [],
  constructionSites = [],
  systemConfig,
  onConfirmClear,
  onConfirmLoadMocks,
  onRestoreSnapshot,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [hasCreatedBackup, setHasCreatedBackup] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState<SafetyBackupSnapshot | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);

  const requiredConfirmationText = actionType === 'CLEAR_DATABASE' 
    ? 'LIMPAR BASE CENTRAL' 
    : 'MODO TREINAMENTO';

  // Load latest restore point on mount or open
  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation('');
      setHasCreatedBackup(false);
      setBackupFeedback(null);
      try {
        const stored = localStorage.getItem(RESTORE_POINT_STORAGE_KEY);
        if (stored) {
          setLatestSnapshot(JSON.parse(stored));
        } else {
          setLatestSnapshot(null);
        }
      } catch (e) {
        console.error('Erro ao ler ponto de restauração:', e);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const normalizedTyped = typedConfirmation.trim().toUpperCase();
  const isConfirmed = actionType === 'CLEAR_DATABASE'
    ? (normalizedTyped === 'LIMPAR BASE CENTRAL' || normalizedTyped === 'ZERAR BASE' || normalizedTyped === 'ZERAR BASE PRODUCAO')
    : (normalizedTyped === 'MODO TREINAMENTO' || normalizedTyped === 'CARREGAR MOCKS');

  // Handle Backup Creation & Download
  const handleCreateRestorePointAndDownload = () => {
    try {
      const now = new Date();
      const formattedDate = now.toLocaleString('pt-BR');
      const timestampIso = now.toISOString();

      const snapshot: SafetyBackupSnapshot = {
        timestamp: timestampIso,
        formattedDate,
        data: {
          employees: [...employees],
          records: [...records],
          insalubrityRecords: [...insalubrityRecords],
          constructionSites: [...constructionSites],
          systemConfig: systemConfig ? { ...systemConfig } : undefined,
        },
        stats: {
          totalEmployees: employees.length,
          totalRecords: records.length,
          totalInsalubrity: insalubrityRecords.length,
          totalSites: constructionSites.length,
        }
      };

      // 1. Gravar no LocalStorage como Ponto de Restauração Imediato
      localStorage.setItem(RESTORE_POINT_STORAGE_KEY, JSON.stringify(snapshot));
      setLatestSnapshot(snapshot);
      setHasCreatedBackup(true);

      // 2. Disparar Download de Arquivo JSON de Backup
      const jsonContent = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = timestampIso.split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      link.setAttribute('href', url);
      link.setAttribute('download', `backup_seguranca_comara_${dateStr}_${timeStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupFeedback(`Ponto de Restauração criado e arquivo de backup baixado com sucesso! (${formattedDate})`);
    } catch (err: any) {
      console.error('Erro ao criar backup:', err);
      setBackupFeedback('Erro ao criar backup. Tente novamente.');
    }
  };

  const handleExecute = async () => {
    if (!isConfirmed) return;
    setIsProcessing(true);
    try {
      if (actionType === 'CLEAR_DATABASE') {
        await onConfirmClear();
      } else {
        await onConfirmLoadMocks();
      }
      onClose();
    } catch (err: any) {
      console.error('Erro na ação de segurança:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreFromSnapshot = async () => {
    if (!latestSnapshot || !onRestoreSnapshot) return;
    if (window.confirm(`Deseja restaurar a base para o Ponto de Segurança criado em ${latestSnapshot.formattedDate}?`)) {
      setIsProcessing(true);
      try {
        await onRestoreSnapshot(latestSnapshot);
        onClose();
      } catch (err: any) {
        console.error('Erro ao restaurar snapshot:', err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div 
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isDark ? 'bg-[#16243D] border-rose-900/50 text-[#E2E8F0]' : 'bg-white border-rose-300 text-slate-900'
        }`}
      >
        {/* Top Danger Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600"></div>

        {/* Modal Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-rose-50/50 border-rose-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {actionType === 'CLEAR_DATABASE' ? 'Zerar Base Central para Produção' : 'Modo Treinamento / Dados Fictícios (Seed)'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600/10 text-rose-500 border border-rose-500/20 font-mono font-bold uppercase">
                  Ação Administrativa
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                {actionType === 'CLEAR_DATABASE' 
                  ? 'Exclusão de coleções operacionais preservando administradores e configurações' 
                  : 'Povoamento oficial no banco de dados com colaboradores, canteiros, lançamentos e insalubridade'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl border transition-colors active:scale-[0.98] cursor-pointer ${
              isDark ? 'border-[#243756] hover:bg-[#243756] text-[#94A3B8]' : 'border-slate-200 hover:bg-slate-100 text-slate-500'
            }`}
            title="Cancelar e Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* 1. Alerta de Consequências */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            isDark ? 'bg-rose-950/20 border-rose-900/40 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="font-bold text-rose-400">
                Atenção às Consequências Desta Operação:
              </h4>
              {actionType === 'CLEAR_DATABASE' ? (
                <p className="leading-relaxed">
                  Esta ação removerá <strong>permanentemente</strong> todos os colaboradores, lançamentos de horas diárias, apontamentos de insalubridade e registros associados do <strong>banco de dados</strong> e do cache local para que você possa importar sua base oficial limpa.
                </p>
              ) : (
                <p className="leading-relaxed">
                  Esta ação carregará dados de exemplo para testes da COMARA. Se você já cadastrou dados reais ou lançamentos de campo, recomendamos criar um <strong>Ponto de Restauração</strong> antes de prosseguir.
                </p>
              )}
            </div>
          </div>

          {/* 2. Resumo da Base Atual Afetada */}
          <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-[10px] uppercase font-bold tracking-wider block mb-2 font-mono ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Volume de Dados Atual na Base:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
                <Users className="w-3.5 h-3.5 mx-auto mb-1 text-blue-400" />
                <span className="block font-bold font-mono text-sm">{employees.length}</span>
                <span className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Colaboradores</span>
              </div>

              <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
                <Clock className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-400" />
                <span className="block font-bold font-mono text-sm">{records.length}</span>
                <span className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Lançamentos</span>
              </div>

              <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
                <FileSpreadsheet className="w-3.5 h-3.5 mx-auto mb-1 text-amber-400" />
                <span className="block font-bold font-mono text-sm">{insalubrityRecords.length}</span>
                <span className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Insalubridade</span>
              </div>

              <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
                <Building2 className="w-3.5 h-3.5 mx-auto mb-1 text-indigo-400" />
                <span className="block font-bold font-mono text-sm">{constructionSites.length}</span>
                <span className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Canteiros</span>
              </div>
            </div>
          </div>

          {/* 3. Ponto de Restauração & Backup Recomendado */}
          <div className={`p-4 rounded-xl border transition-all ${
            hasCreatedBackup 
              ? isDark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isDark ? 'bg-blue-950/20 border-blue-900/40' : 'bg-blue-50/70 border-blue-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Database className={`w-4 h-4 ${hasCreatedBackup ? 'text-emerald-400' : 'text-blue-400'}`} />
                  <span className="font-bold text-xs">
                    {hasCreatedBackup ? 'Ponto de Restauração Criado com Sucesso!' : 'Recomendação de Segurança: Criar Backup'}
                  </span>
                </div>
                <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Gere um snapshot de segurança salvo localmente e baixe o arquivo de backup (.json) no seu computador.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateRestorePointAndDownload}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shrink-0 cursor-pointer shadow-xs ${
                  hasCreatedBackup 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {hasCreatedBackup ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{hasCreatedBackup ? 'Gerar Novo Backup' : 'Criar Ponto & Baixar Backup'}</span>
              </button>
            </div>

            {backupFeedback && (
              <p className="mt-2 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>{backupFeedback}</span>
              </p>
            )}
          </div>

          {/* 4. Ponto de Restauração Existente (se houver) */}
          {latestSnapshot && onRestoreSnapshot && (
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-[11px] ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-100 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="font-semibold block">Último Ponto de Segurança Gravado:</span>
                  <span className={`font-mono ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                    {latestSnapshot.formattedDate} ({latestSnapshot.stats.totalEmployees} colaboradores, {latestSnapshot.stats.totalRecords} lançamentos)
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRestoreFromSnapshot}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-[0.98] cursor-pointer ${
                  isDark 
                    ? 'border-indigo-800 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/60' 
                    : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
                title="Restaurar a base para este ponto de segurança gravado"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar Este Ponto</span>
              </button>
            </div>
          )}

          {/* 5. Caixa de Confirmação com Digitação Estrita */}
          <div className="space-y-2 pt-1">
            <label className={`block font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Para confirmar, digite exatamente <span className="font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30 select-all">{requiredConfirmationText}</span> no campo abaixo:
            </label>

            <input
              type="text"
              autoFocus
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder={`Digite "${requiredConfirmationText}"`}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold tracking-wider transition-all focus:outline-hidden ${
                isConfirmed
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-2 ring-emerald-500/30'
                  : typedConfirmation.length > 0
                    ? 'border-amber-500/60 bg-amber-500/5 text-amber-300'
                    : isDark ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />

            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className={isDark ? 'text-[#94A3B8]' : 'text-slate-500'}>
                {typedConfirmation.length > 0 && !isConfirmed && (
                  <span className="text-amber-400">Texto digitado ainda não coincide exatamente.</span>
                )}
                {isConfirmed && (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Frase de confirmação validada com sucesso!
                  </span>
                )}
              </span>

              <span className={`${isConfirmed ? 'text-emerald-400' : isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`}>
                {typedConfirmation.trim().length} / {requiredConfirmationText.length} caracteres
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0 ${
          isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors active:scale-[0.98] cursor-pointer ${
              isDark ? 'border-[#243756] hover:bg-[#243756] text-[#94A3B8]' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            Cancelar Operação
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={!isConfirmed || isProcessing}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98] shadow-lg cursor-pointer ${
              isConfirmed && !isProcessing
                ? actionType === 'CLEAR_DATABASE'
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 active:scale-98'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 active:scale-98'
                : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-50'
            }`}
          >
            {isProcessing ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
            ) : actionType === 'CLEAR_DATABASE' ? (
              <Trash2 className="w-4 h-4" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span>
              {isProcessing
                ? 'Processando...'
                : actionType === 'CLEAR_DATABASE'
                  ? 'Sim, Zerar Base Operacional'
                  : 'Sim, Ativar Modo Treinamento'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
