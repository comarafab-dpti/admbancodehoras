import React, { useState, useRef } from 'react';
import { PaystubRecord, Employee, ConstructionSite } from '@/src/shared/types';
import { 
  parseMultipleComaraPdfs, 
  MultiPdfProgress,
  getDemoComaraPaystubs,
  normalizeMatricula
} from '@/src/shared/utils/pdfParser';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Sparkles, 
  Search, 
  ShieldCheck, 
  Trash2,
  Database,
  UserPlus,
  Files,
  Plus,
  CheckSquare,
  Square,
  FileCheck
} from 'lucide-react';
import { InfoTooltip } from '@/src/shared/components/InfoTooltip';

interface ImportContrachequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBatch: (paystubs: PaystubRecord[]) => Promise<void>;
  onSaveEmployees?: (employees: Employee[]) => Promise<void>;
  employees?: Employee[];
  constructionSites?: ConstructionSite[];
  theme?: 'dark' | 'light';
  currentUserEmail?: string;
}

export const ImportContrachequeModal: React.FC<ImportContrachequeModalProps> = ({
  isOpen,
  onClose,
  onImportBatch,
  onSaveEmployees,
  employees = [],
  constructionSites = [],
  theme = 'dark',
  currentUserEmail = 'coari.comara@gmail.com',
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<MultiPdfProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [parsedPaystubs, setParsedPaystubs] = useState<PaystubRecord[]>([]);
  const [processedFiles, setProcessedFiles] = useState<{
    fileName: string;
    paystubsCount: number;
    pages: number;
    hasError?: boolean;
    errorMessage?: string;
  }[]>([]);

  const [unregisteredEmployees, setUnregisteredEmployees] = useState<{
    matricula: string;
    nome: string;
    cargo: string;
    sede: string;
  }[]>([]);
  const [selectedUnregistered, setSelectedUnregistered] = useState<Set<string>>(new Set());
  const [autoCreateEmployees, setAutoCreateEmployees] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const processFileList = async (filesToProcess: File[]) => {
    const pdfFiles = filesToProcess.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      setErrorMessage('Por favor, selecione arquivos válidos em formato PDF.');
      return;
    }

    // Limite amigável para evitar estouro de memória no browser (recomendado 15 a 20 PDFs por lote)
    if (pdfFiles.length > 25) {
      setErrorMessage(`Você selecionou ${pdfFiles.length} PDFs. Para máxima estabilidade no navegador, recomendamos importar no máximo 25 PDFs por vez.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Lê todos os ArrayBuffers
      const loadedFiles: { name: string; arrayBuffer: ArrayBuffer }[] = [];
      for (const file of pdfFiles) {
        const ab = await file.arrayBuffer();
        loadedFiles.push({ name: file.name, arrayBuffer: ab });
      }

      const result = await parseMultipleComaraPdfs(
        loadedFiles,
        employees,
        currentUserEmail,
        (progress) => {
          setParsingProgress(progress);
        }
      );

      if (result.paystubs.length === 0) {
        setErrorMessage('Nenhum contracheque da COMARA foi identificado nos PDFs fornecidos. Verifique se os arquivos contêm a folha de pagamento oficial.');
      } else {
        // Se já existiam contracheques de imports anteriores, mescla sem duplicar
        const map = new Map<string, PaystubRecord>();
        parsedPaystubs.forEach(p => map.set(p.id, p));
        result.paystubs.forEach(p => map.set(p.id, p));

        const unifiedPaystubs = Array.from(map.values());
        setParsedPaystubs(unifiedPaystubs);
        setProcessedFiles(prev => [...prev, ...result.fileSummaries]);

        // Atualiza novos servidores não cadastrados
        const existingMatriculasSet = new Set(employees.map(e => normalizeMatricula(e.matricula)));
        const unregMap = new Map<string, { matricula: string; nome: string; cargo: string; sede: string }>();

        for (const p of unifiedPaystubs) {
          const normMat = normalizeMatricula(p.matricula);
          if (!existingMatriculasSet.has(normMat) && !unregMap.has(normMat)) {
            unregMap.set(normMat, {
              matricula: normMat,
              nome: p.nome,
              cargo: p.cargo,
              sede: p.sede || 'KO-DL'
            });
          }
        }

        const unreg = Array.from(unregMap.values());
        setUnregisteredEmployees(unreg);
        setSelectedUnregistered(new Set(unreg.map(u => u.matricula)));

        let msg = `${result.paystubs.length} contracheques extraídos com sucesso de ${pdfFiles.length} arquivo(s) PDF (${result.totalPages} páginas no total)!`;
        if (unreg.length > 0) {
          msg += ` • ${unreg.length} novos servidores identificados.`;
        }
        setSuccessMessage(msg);
      }
    } catch (err: any) {
      console.error('Erro ao processar múltiplos PDFs:', err);
      setErrorMessage(err.message || 'Falha ao processar os arquivos PDF no navegador.');
    } finally {
      setIsLoading(false);
      setParsingProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFileList(Array.from(files));
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileList(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleLoadDemo = () => {
    const demo = getDemoComaraPaystubs();
    setProcessedFiles([
      { fileName: 'Folha_Pagamento_COMARA_KO_Julho_2026.pdf', paystubsCount: 1, pages: 1 },
      { fileName: 'Folha_Pagamento_COMARA_MN_Julho_2026.pdf', paystubsCount: 1, pages: 1 }
    ]);
    setParsedPaystubs(demo);

    // Identifica quais do demo não estão cadastrados
    const existingMatriculasSet = new Set(employees.map(e => normalizeMatricula(e.matricula)));
    const unreg = demo
      .filter(p => !existingMatriculasSet.has(normalizeMatricula(p.matricula)))
      .map(p => ({
        matricula: normalizeMatricula(p.matricula),
        nome: p.nome,
        cargo: p.cargo,
        sede: p.sede
      }));

    setUnregisteredEmployees(unreg);
    setSelectedUnregistered(new Set(unreg.map(u => u.matricula)));
    setSuccessMessage(`${demo.length} contracheques de demonstração oficial (Julho/2026) carregados para conferência!`);
    setErrorMessage(null);
  };

  const toggleSelectUnregistered = (mat: string) => {
    const next = new Set(selectedUnregistered);
    if (next.has(mat)) {
      next.delete(mat);
    } else {
      next.add(mat);
    }
    setSelectedUnregistered(next);
  };

  const toggleSelectAllUnregistered = () => {
    if (selectedUnregistered.size === unregisteredEmployees.length) {
      setSelectedUnregistered(new Set());
    } else {
      setSelectedUnregistered(new Set(unregisteredEmployees.map(u => u.matricula)));
    }
  };

  const handleConfirmImport = async () => {
    if (parsedPaystubs.length === 0) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // A atualização de colaboradores é exclusiva do pipeline CSV oficial.
      // O importador de contracheques permanece restrito à folha.
      await onImportBatch(parsedPaystubs);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao persistir registros no banco de dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setParsedPaystubs([]);
    setProcessedFiles([]);
    setUnregisteredEmployees([]);
    setSelectedUnregistered(new Set());
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const filteredPaystubs = parsedPaystubs.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.nome.toLowerCase().includes(term) ||
      p.matricula.toLowerCase().includes(term) ||
      p.cargo.toLowerCase().includes(term)
    );
  });

  const totalBruto = parsedPaystubs.reduce((acc, p) => acc + p.totalProventos, 0);
  const totalDescontos = parsedPaystubs.reduce((acc, p) => acc + p.totalDescontos, 0);
  const totalLiquido = parsedPaystubs.reduce((acc, p) => acc + p.valorLiquido, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
        isDark ? 'bg-[#16243D] border-[#243756] text-gray-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Cabeçalho do Modal */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Files className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Importação em Lote de Contracheques COMARA (PDFs)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
                  Multi-PDF Suportado
                </span>
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Importação de múltiplos PDFs <InfoTooltip theme={isDark ? 'dark' : 'light'} content="Selecione múltiplos arquivos PDF de uma só vez (5 a 15 arquivos) • Processamento otimizado sem travamento" />
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors active:scale-[0.98] cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-gray-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Mensagens de Feedback */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Área de Seleção / Dropzone de Múltiplos Arquivos */}
          {parsedPaystubs.length === 0 && (
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                    : isDark 
                      ? 'border-slate-700 hover:border-blue-500/60 bg-slate-900/30 hover:bg-slate-900/60' 
                      : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="application/pdf" 
                  multiple
                  className="hidden" 
                />

                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shadow-sm">
                  {isLoading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-sm">
                    {isLoading 
                      ? (parsingProgress 
                          ? `Processando arquivo ${parsingProgress.currentFileIndex} de ${parsingProgress.totalFiles}...` 
                          : 'Carregando arquivos PDF...')
                      : 'Clique para selecionar vários PDFs ou arraste todos aqui'}
                  </h4>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Você pode selecionar 5, 10 ou mais PDFs simultaneamente. Os contracheques serão unificados automaticamente.
                  </p>
                </div>

                {parsingProgress && (
                  <div className="w-full max-w-md space-y-2 mt-2 p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-blue-400 font-bold truncate max-w-[240px]">
                        {parsingProgress.currentFileName}
                      </span>
                      <span className="text-gray-400">
                        Arquivo {parsingProgress.currentFileIndex}/{parsingProgress.totalFiles} • Pág {parsingProgress.currentPage}/{parsingProgress.totalPagesInFile}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-200 rounded-full"
                        style={{ 
                          width: `${Math.round(
                            ((parsingProgress.currentFileIndex - 1 + (parsingProgress.currentPage / Math.max(1, parsingProgress.totalPagesInFile))) / Math.max(1, parsingProgress.totalFiles)) * 100
                          )}%` 
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>{parsingProgress.totalPaystubsFoundSoFar} contracheques encontrados até agora</span>
                      <span className="font-bold text-emerald-400">
                        {Math.round(
                          ((parsingProgress.currentFileIndex - 1 + (parsingProgress.currentPage / Math.max(1, parsingProgress.totalPagesInFile))) / Math.max(1, parsingProgress.totalFiles)) * 100
                        )}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Demonstração Rápida */}
              <div className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-blue-500/5 via-blue-500/10 to-transparent border-blue-500/20">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs">Testar com Demonstração Multi-Sede (Julho/2026)</h5>
                    <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      Simula o carregamento simultâneo de múltiplos PDFs das sedes KO e MN.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all active:scale-[0.98] shadow-sm shrink-0 cursor-pointer"
                >
                  Carregar Demonstração
                </button>
              </div>
            </div>
          )}

          {/* Resumo de Arquivos Processados & Pré-visualização */}
          {parsedPaystubs.length > 0 && (
            <div className="space-y-4">
              {/* Lista dos PDFs que foram processados */}
              {processedFiles.length > 0 && (
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-500" />
                      <span>{processedFiles.length} Arquivo(s) PDF Processado(s):</span>
                    </span>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar mais PDFs
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileSelect} 
                      accept="application/pdf" 
                      multiple
                      className="hidden" 
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {processedFiles.map((f, idx) => (
                      <span 
                        key={idx}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono flex items-center gap-1.5 ${
                          f.hasError
                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : isDark ? 'bg-slate-800/90 border-slate-700 text-gray-200' : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{f.fileName}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          f.hasError ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {f.paystubsCount} extraídos ({f.pages}p)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Alerta de Servidores Não Cadastrados e Opção de Inserção Automática */}
              {unregisteredEmployees.length > 0 && (
                <div className={`p-4 rounded-xl border transition-all ${
                  isDark 
                    ? 'bg-amber-950/20 border-amber-500/40 text-amber-200' 
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm flex items-center gap-2">
                          <span>Servidores não encontrados na base de colaboradores ({unregisteredEmployees.length})</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-mono">
                            Auto Cadastro
                          </span>
                        </h4>
                        <p className="text-xs mt-1 opacity-90">
                          Identificamos que <strong>{unregisteredEmployees.length} servidor(es)</strong> presentes nestes arquivos ainda não estão cadastrados no banco de colaboradores da COMARA. 
                          <strong> Deseja inseri-los automaticamente no banco de dados?</strong>
                        </p>

                        <div className="flex items-center gap-4 mt-3">
                          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoCreateEmployees}
                              onChange={(e) => setAutoCreateEmployees(e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span>Sim, cadastrar novos servidores no sistema (Recomendado)</span>
                          </label>

                          {autoCreateEmployees && (
                            <button
                              type="button"
                              onClick={toggleSelectAllUnregistered}
                              className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              {selectedUnregistered.size === unregisteredEmployees.length ? 'Desmarcar todos' : 'Marcar todos'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {autoCreateEmployees && (
                    <div className="mt-3.5 pt-3 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {unregisteredEmployees.map((u) => {
                        const isSelected = selectedUnregistered.has(u.matricula);
                        return (
                          <div 
                            key={u.matricula}
                            onClick={() => toggleSelectUnregistered(u.matricula)}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] ${
                              isSelected 
                                ? isDark ? 'bg-amber-900/30 border-amber-500/50 text-white' : 'bg-amber-100/80 border-amber-400 text-amber-950'
                                : isDark ? 'bg-slate-900/40 border-slate-800 text-gray-400 opacity-60' : 'bg-white border-slate-200 text-slate-400 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500 shrink-0" />
                              )}
                              <div>
                                <p className="font-bold">{u.nome}</p>
                                <p className="text-[11px] opacity-80">{u.cargo} • Sede: {u.sede}</p>
                              </div>
                            </div>
                            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-black/20">
                              Mat: {u.matricula}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Cards de Resumo da Folha Extraída */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Servidores</span>
                  <p className="text-base font-bold font-mono text-blue-500">{parsedPaystubs.length}</p>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Bruto</span>
                  <p className="text-base font-bold font-mono text-emerald-500">R$ {totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Descontos</span>
                  <p className="text-base font-bold font-mono text-red-400">R$ {totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Líquido</span>
                  <p className="text-base font-bold font-mono text-blue-400">R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Barra de Busca e Ações */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, matrícula ou cargo..."
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <button
                  onClick={handleClear}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors active:scale-[0.98] cursor-pointer ${
                    isDark ? 'border-slate-700 text-gray-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Limpar Tudo</span>
                </button>
              </div>

              {/* Tabela dos Contracheques Extraídos */}
              <div className="overflow-x-auto rounded-xl border border-slate-700/40 max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`sticky top-0 ${isDark ? 'bg-slate-800 text-gray-300' : 'bg-slate-100 text-slate-700'} font-bold uppercase text-[10px] tracking-wider`}>
                    <tr>
                      <th className="py-2.5 px-3">Matrícula</th>
                      <th className="py-2.5 px-3">Servidor</th>
                      <th className="py-2.5 px-3">Cargo / Sede</th>
                      <th className="py-2.5 px-3 text-center">Competência</th>
                      <th className="py-2.5 px-3 text-right">Salário Base (R$)</th>
                      <th className="py-2.5 px-3 text-right">Bruto (R$)</th>
                      <th className="py-2.5 px-3 text-right">Líquido (R$)</th>
                      <th className="py-2.5 px-3 text-center">Rubricas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredPaystubs.map((p) => (
                      <tr key={p.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <td className="py-2 px-3 font-mono font-bold text-blue-500">
                          {p.matricula}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          {p.nome}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {p.cargo} • <span className="font-mono text-xs">{p.sede}</span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[11px]">
                          {p.periodo || p.mesAno}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-300">
                          {p.salarioBase ? p.salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-500">
                          {p.totalProventos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-blue-400">
                          {p.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-mono">
                            {p.rubricas.length} itens
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Gravação no banco de dados com matrícula normalizada (ex: <code>13974_07-2026</code>)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors active:scale-[0.98] cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-gray-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedPaystubs.length === 0 || isLoading}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer ${
                parsedPaystubs.length === 0 || isLoading
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-600/20'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gravando no Firestore...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>
                    Importar {parsedPaystubs.length} Contracheques
                    {autoCreateEmployees && selectedUnregistered.size > 0 && ` + ${selectedUnregistered.size} Servidores`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
