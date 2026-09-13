/**
 * Modal de Importação, Preview e Classificação Interativa de Colaboradores (Etapa 3b).
 * Responsável por upload CSV, preview segregado, conciliação interativa de UOs não reconhecidas
 * e persistência atômica no banco de dados em lotes de até 400 documentos sem sobrecarga de leituras.
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  AlertCircle, 
  ArrowRight, 
  Search, 
  Building2, 
  FolderPlus, 
  HelpCircle, 
  Check, 
  RefreshCw, 
  Layers, 
  UserCheck, 
  Clock, 
  FileText, 
  ChevronRight,
  ShieldCheck,
  Building
} from 'lucide-react';
import { Employee, UnidadeOrganizacional, TipoUnidadeOrganizacional, Branch } from '@/src/shared/types';
import { 
  importarColaboradoresCsv, 
  ImportacaoResultado, 
  ImportacaoColaborador, 
  DepartamentoPendenteContagem 
} from '@/src/shared/services/importacaoColaboradores';
import { 
  aplicarClassificacaoExistente, 
  aplicarNovoSetor, 
  aplicarNovoSetorPersistido,
  manterNaoClassificado, 
  analisarConflitosMatricula, 
  persistirColaboradoresFirestore, 
  ProgressoImportacaoInfo,
  ParametrosNovoSetor
} from '@/src/shared/services/classificacaoInterativa';
import {
  UNIDADES_ORGANIZACIONAIS,
  carregarUnidadesOrganizacionais,
  listarUnidadesOrganizacionais,
} from '@/src/shared/constants/unidadesOrganizacionais';
import { Button } from '@/src/shared/components/ui/Button';
import { Badge } from '@/src/shared/components/ui/Badge';

interface ImportarColaboradoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  colaboradoresExistentes: Employee[];
  onImportSuccess: (colaboradoresImportados: Employee[]) => void;
  theme?: 'dark' | 'light';
}

type AbaPreview = 'VALIDOS' | 'PENDENTES' | 'ERROS';
type OpcaoClassificacao = 'EXISTENTE' | 'NOVO' | 'NAO_CLASSIFICADO';

export const ImportarColaboradoresModal: React.FC<ImportarColaboradoresModalProps> = ({
  isOpen,
  onClose,
  colaboradoresExistentes,
  onImportSuccess,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados do fluxo de arquivo e parsing
  const [isDragOver, setIsDragOver] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [isLendoCsv, setIsLendoCsv] = useState(false);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);

  // Estados de dados processados
  const [todosColaboradores, setTodosColaboradores] = useState<ImportacaoColaborador[]>([]);
  const [departamentosPendentes, setDepartamentosPendentes] = useState<DepartamentoPendenteContagem[]>([]);
  const [errosIntegridade, setErrosIntegridade] = useState<{ linha: number; matricula?: string; nome?: string; motivo: string }[]>([]);
  const [totalLinhasArquivo, setTotalLinhasArquivo] = useState(0);

  // Navegação e filtros de visualização
  const [abaAtiva, setAbaAtiva] = useState<AbaPreview>('VALIDOS');
  const [termoBusca, setTermoBusca] = useState('');

  // Submodal de Classificação Interativa
  const [versaoUos, setVersaoUos] = useState(0);
  const [deptoEmClassificacao, setDeptoEmClassificacao] = useState<DepartamentoPendenteContagem | null>(null);
  const [opcaoClassificacao, setOpcaoClassificacao] = useState<OpcaoClassificacao>('EXISTENTE');
  const [uoSelecionadaCodigo, setUoSelecionadaCodigo] = useState<string>('SEDE_BE');
  const [filtroUoBusca, setFiltroUoBusca] = useState('');
  const [novoSetorForm, setNovoSetorForm] = useState<ParametrosNovoSetor>({
    nome: '',
    sigla: '',
    tipo: 'SETOR',
    pai: '',
    sedeOuCanteiroPadrao: 'BE',
  });

  // Persistência no Firestore
  const [sobrescreverExistentes, setSobrescreverExistentes] = useState(true);
  const [isGravando, setIsGravando] = useState(false);
  const [progressoGravacao, setProgressoGravacao] = useState<ProgressoImportacaoInfo | null>(null);
  const [gravacaoConcluida, setGravacaoConcluida] = useState(false);
  const [resumoGravacao, setResumoGravacao] = useState<{ salvos: number; erros: string[] } | null>(null);

  // Reseta estados quando o modal fecha
  useEffect(() => {
    if (isOpen) {
      carregarUnidadesOrganizacionais().catch((error) => {
        console.warn('[ImportarColaboradoresModal] Falha ao carregar UOs persistidas:', error);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setNomeArquivo('');
      setIsLendoCsv(false);
      setErroLeitura(null);
      setTodosColaboradores([]);
      setDepartamentosPendentes([]);
      setErrosIntegridade([]);
      setTotalLinhasArquivo(0);
      setDeptoEmClassificacao(null);
      setGravacaoConcluida(false);
      setResumoGravacao(null);
      setProgressoGravacao(null);
      setTermoBusca('');
    }
  }, [isOpen]);

  // Separação em tempo real dos colaboradores válidos vs pendentes em memória
  const colaboradoresValidos = useMemo(() => {
    return todosColaboradores.filter(c => c.valido && !c.pendenteClassificacao);
  }, [todosColaboradores]);

  const colaboradoresPendentes = useMemo(() => {
    return todosColaboradores.filter(c => c.valido && c.pendenteClassificacao);
  }, [todosColaboradores]);

  // Análise de conflitos de matrícula em tempo real (sem chamadas extras ao Firestore)
  const relatorioConflitos = useMemo(() => {
    return analisarConflitosMatricula(colaboradoresValidos, colaboradoresExistentes);
  }, [colaboradoresValidos, colaboradoresExistentes]);

  // Lista de UOs cadastradas filtráveis para o dropdown
  const listaUosCadastradas = useMemo(() => {
    const list = listarUnidadesOrganizacionais();
    if (!filtroUoBusca.trim()) return list;
    const q = filtroUoBusca.toLowerCase().trim();
    return list.filter(u => 
      u.nome.toLowerCase().includes(q) || 
      u.siglaExibicao.toLowerCase().includes(q) || 
      u.codigo.toLowerCase().includes(q)
    );
  }, [filtroUoBusca, versaoUos]);

  // Qualquer OU ativa pode conter setores e também receber funcionários.
  const listaUosPaiDisponiveis = useMemo(() => {
    return listarUnidadesOrganizacionais();
  }, [versaoUos]);

  // Processa o arquivo selecionado
  const processarArquivoTexto = async (texto: string, nome: string) => {
    setIsLendoCsv(true);
    setErroLeitura(null);
    setNomeArquivo(nome);

    try {
      const resultado: ImportacaoResultado = await importarColaboradoresCsv(texto);
      setTodosColaboradores(resultado.todosColaboradores);
      setDepartamentosPendentes(resultado.departamentosNaoClassificados);
      setErrosIntegridade(resultado.erros);
      setTotalLinhasArquivo(resultado.totalLinhas);

      // Define aba inicial com base no resultado
      if (resultado.totalPendentes > 0) {
        setAbaAtiva('PENDENTES');
      } else if (resultado.totalValidos > 0) {
        setAbaAtiva('VALIDOS');
      } else {
        setAbaAtiva('ERROS');
      }
    } catch (err: any) {
      console.error('Erro ao ler e processar CSV de colaboradores:', err);
      setErroLeitura(err?.message || 'Falha ao processar a estrutura do arquivo CSV.');
    } finally {
      setIsLendoCsv(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const texto = event.target?.result as string;
      if (texto) {
        await processarArquivoTexto(texto, file.name);
      }
    };
    reader.onerror = () => {
      setErroLeitura('Não foi possível ler o arquivo selecionado.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Suporte a Drag and Drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text'))) {
      const reader = new FileReader();
      reader.onload = async event => {
        const texto = event.target?.result as string;
        if (texto) {
          await processarArquivoTexto(texto, file.name);
        }
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      setErroLeitura('Por favor, arraste um arquivo válido no formato .csv.');
    }
  };

  // Abre submodal de classificação para um departamento específico
  const abrirClassificacao = (depto: DepartamentoPendenteContagem) => {
    setDeptoEmClassificacao(depto);
    setOpcaoClassificacao('EXISTENTE');
    setFiltroUoBusca('');
    setUoSelecionadaCodigo('SEDE_BE');
    const siglaLimpa = depto.departamento.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
    setNovoSetorForm({
      nome: depto.departamento.toUpperCase(),
      sigla: `SETOR_${siglaLimpa}`,
      tipo: 'SETOR',
      pai: '',
      sedeOuCanteiroPadrao: 'BE',
      descricao: `Setor criado a partir da conciliação do departamento legado "${depto.departamento}"`,
    });
  };

  // Validação em tempo real para habilitar a confirmação de classificação
  const isClassificacaoValida = useMemo(() => {
    if (!deptoEmClassificacao) return false;
    if (opcaoClassificacao === 'EXISTENTE') {
      return Boolean(uoSelecionadaCodigo && UNIDADES_ORGANIZACIONAIS[uoSelecionadaCodigo]);
    }
    if (opcaoClassificacao === 'NOVO') {
      if (!novoSetorForm.nome.trim() || !novoSetorForm.sigla.trim()) return false;
      if (novoSetorForm.tipo === 'SETOR') {
        return Boolean(novoSetorForm.pai && novoSetorForm.pai.trim());
      }
      return true; // DECO e DACO não exigem pai (assumem COMARA implicitamente)
    }
    return true; // NAO_CLASSIFICADO
  }, [deptoEmClassificacao, opcaoClassificacao, uoSelecionadaCodigo, novoSetorForm]);

  // Aplica a decisão de classificação interativa
  const confirmarClassificacao = async () => {
    if (!deptoEmClassificacao) return;
    const deptoOriginal = deptoEmClassificacao.departamento;

    let novaLista: ImportacaoColaborador[] = [];

    if (opcaoClassificacao === 'EXISTENTE') {
      const uoEncontrada = UNIDADES_ORGANIZACIONAIS[uoSelecionadaCodigo] || UNIDADES_ORGANIZACIONAIS.SEDE_BE;
      novaLista = aplicarClassificacaoExistente(todosColaboradores, deptoOriginal, uoEncontrada);
    } else if (opcaoClassificacao === 'NOVO') {
      try {
        const resultado = await aplicarNovoSetorPersistido(todosColaboradores, deptoOriginal, novoSetorForm);
        novaLista = resultado.colaboradoresAtualizados;
        setVersaoUos(v => v + 1);
      } catch (err: any) {
        console.error('Erro ao cadastrar nova UO:', err);
        alert(err?.message || 'Erro ao cadastrar nova UO');
        return;
      }
    } else {
      novaLista = manterNaoClassificado(todosColaboradores, deptoOriginal);
    }

    setTodosColaboradores(novaLista);

    // Remove o departamento classificado da lista de pendências
    const restantes = departamentosPendentes.filter(d => d.departamento !== deptoOriginal);
    setDepartamentosPendentes(restantes);
    setDeptoEmClassificacao(null);

    // Se não há mais pendências, direciona para os válidos
    if (restantes.length === 0) {
      setAbaAtiva('VALIDOS');
    }
  };

  // Executa a persistência atômica no banco de dados em lotes de até 400 documentos
  const handleConfirmarImportacaoFirestore = async () => {
    if (colaboradoresValidos.length === 0) return;

    setIsGravando(true);
    setResumoGravacao(null);

    try {
      const resultado = await persistirColaboradoresFirestore(colaboradoresValidos, {
        sobrescreverExistentes,
        colaboradoresExistentes,
        onProgresso: info => {
          setProgressoGravacao(info);
        },
      });

      setResumoGravacao({
        salvos: resultado.salvos,
        erros: resultado.erros,
      });
      setGravacaoConcluida(true);

      // Notifica o componente pai com os novos colaboradores importados
      const convertidos: Employee[] = colaboradoresValidos.map(item => item.colaborador as Employee);
      onImportSuccess(convertidos);
    } catch (err: any) {
      console.error('Falha na importação para o Firestore:', err);
      setResumoGravacao({
        salvos: 0,
        erros: [err?.message || 'Erro inesperado na gravação em lote'],
      });
      setGravacaoConcluida(true);
    } finally {
      setIsGravando(false);
    }
  };

  if (!isOpen) return null;

  // Filtragem da lista para o preview visual da tabela
  const filtrarItens = (lista: ImportacaoColaborador[]) => {
    if (!termoBusca.trim()) return lista;
    const q = termoBusca.toLowerCase().trim();
    return lista.filter(item => {
      const nome = (item.colaborador.nome || '').toLowerCase();
      const mat = (item.colaborador.matricula || '').toLowerCase();
      const func = (item.colaborador.funcao || '').toLowerCase();
      const depto = (item.departamentoOriginal || '').toLowerCase();
      return nome.includes(q) || mat.includes(q) || func.includes(q) || depto.includes(q);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="modal-importar-colaboradores"
        className={`relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden transition-all ${
          isDark 
            ? 'bg-[#0B1426] border-[#243756] text-white' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* ========================================================= */}
        {/* HEADER MODAL                                              */}
        {/* ========================================================= */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b shrink-0 ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isDark ? 'bg-[#243756] border-[#335075] text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}>
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Importação e Conciliação de Colaboradores</h3>
                <span className={`px-2 py-0.5 text-[10px] font-semibold font-mono rounded-full border ${
                  isDark ? 'bg-[#243756] text-blue-300 border-[#335075]' : 'bg-blue-100 text-blue-700 border-blue-200'
                }`}>
                  Planilha CSV • 22 Colunas
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Carga massiva com classificação de UOs, mascaramento LGPD e tratamento de duplicidade.
              </p>
            </div>
          </div>

          <button
            id="btn-fechar-modal-importacao-colaboradores"
            onClick={onClose}
            disabled={isGravando}
            className={`p-2 rounded-xl transition-all ${
              isDark 
                ? 'hover:bg-[#243756] text-[#94A3B8] hover:text-white' 
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* CORPO DO MODAL                                            */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TELA DE SUCESSO APÓS GRAVAÇÃO */}
          {gravacaoConcluida && resumoGravacao && (
            <div className={`p-6 rounded-2xl border text-center space-y-4 ${
              resumoGravacao.erros.length === 0 
                ? isDark ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-emerald-50 border-emerald-200'
                : isDark ? 'bg-amber-950/40 border-amber-800/60' : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Importação Finalizada com Sucesso!
              </h4>
              <p className={`text-sm max-w-md mx-auto ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                Foram persistidos e conciliados com segurança <strong>{resumoGravacao.salvos} colaboradores</strong> na base de dados do Firestore.
              </p>

              {resumoGravacao.erros.length > 0 && (
                <div className="text-left p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs max-w-lg mx-auto space-y-1">
                  <p className="font-bold">Ocorrências registradas:</p>
                  {resumoGravacao.erros.map((err, idx) => (
                    <p key={idx}>• {err}</p>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-center gap-3">
                <Button
                  id="btn-fechar-sucesso-importacao"
                  variant="primary"
                  size="md"
                  onClick={onClose}
                >
                  Concluir e Ver Lista de Colaboradores
                </Button>
              </div>
            </div>
          )}

          {/* FLUXO NORMAL (UPLOAD + PREVIEW + CONCILIAÇÃO) */}
          {!gravacaoConcluida && (
            <>
              {/* ÁREA DE UPLOAD E RESUMO */}
              {todosColaboradores.length === 0 ? (
                <div className="space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
                      isDragOver
                        ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                        : isDark
                          ? 'border-[#243756] bg-[#16243D]/60 hover:bg-[#16243D] hover:border-blue-500/60'
                          : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className={`p-4 rounded-2xl border ${
                        isDark ? 'bg-[#243756] border-[#335075] text-blue-400' : 'bg-white border-slate-200 text-blue-600 shadow-sm'
                      }`}>
                        {isLendoCsv ? (
                          <RefreshCw className="w-8 h-8 animate-spin" />
                        ) : (
                          <UploadCloud className="w-8 h-8" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {isLendoCsv ? 'Processando e higienizando CSV...' : 'Clique para selecionar ou arraste o arquivo CSV aqui'}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Suporta o layout padrão oficial de 22 colunas (com CPF, matrícula, cargo e departamentos da COMARA)
                        </p>
                      </div>

                      <div className="pt-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
                          isDark ? 'bg-[#111C30] text-blue-300 border-[#243756]' : 'bg-white text-slate-600 border-slate-200'
                        }`}>
                          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                          Formato aceito: .csv
                        </span>
                      </div>
                    </div>
                  </div>

                  {erroLeitura && (
                    <div className="p-4 rounded-xl border border-red-800/60 bg-red-950/40 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{erroLeitura}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* PAINEL DE RESUMO MÉTRICO E CONTROLE */
                <div className="space-y-5">
                  {/* Arquivo carregado e botão de trocar */}
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${
                    isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-sm font-bold truncate max-w-md">{nomeArquivo}</p>
                        <p className={`text-[11px] font-mono ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Arquivo processado com {totalLinhasArquivo} linhas identificadas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setTodosColaboradores([]);
                          setNomeArquivo('');
                        }}
                      >
                        Carregar Outro CSV
                      </Button>
                    </div>
                  </div>

                  {/* CARDS DE RESUMO (MÉTRICAS DO ARQUIVO) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`p-3.5 rounded-xl border ${
                      isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                    }`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Total de Linhas</p>
                      <p className="text-xl font-bold font-mono mt-1">{totalLinhasArquivo}</p>
                    </div>

                    <div className={`p-3.5 rounded-xl border ${
                      colaboradoresValidos.length > 0
                        ? isDark ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-emerald-50 border-emerald-200'
                        : isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                    }`}>
                      <p className={`text-xs font-semibold ${colaboradoresValidos.length > 0 ? 'text-emerald-400' : isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                        Válidos para Carga
                      </p>
                      <p className="text-xl font-bold font-mono mt-1 text-emerald-400">
                        {colaboradoresValidos.length}
                      </p>
                    </div>

                    <div className={`p-3.5 rounded-xl border ${
                      departamentosPendentes.length > 0
                        ? isDark ? 'bg-amber-950/30 border-amber-800/60' : 'bg-amber-50 border-amber-200'
                        : isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                    }`}>
                      <p className={`text-xs font-semibold ${departamentosPendentes.length > 0 ? 'text-amber-400' : isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                        Pendentes de UO
                      </p>
                      <p className="text-xl font-bold font-mono mt-1 text-amber-400">
                        {colaboradoresPendentes.length}
                      </p>
                    </div>

                    <div className={`p-3.5 rounded-xl border ${
                      errosIntegridade.length > 0
                        ? isDark ? 'bg-red-950/30 border-red-800/60' : 'bg-red-50 border-red-200'
                        : isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                    }`}>
                      <p className={`text-xs font-semibold ${errosIntegridade.length > 0 ? 'text-red-400' : isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                        Erros de Validação
                      </p>
                      <p className="text-xl font-bold font-mono mt-1 text-red-400">
                        {errosIntegridade.length}
                      </p>
                    </div>
                  </div>

                  {/* BANNER DE ALERTA SE HOUVER PENDÊNCIAS */}
                  {departamentosPendentes.length > 0 && (
                    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isDark ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-sm font-bold">
                            {departamentosPendentes.length} departamento(s) não foram reconhecidos automaticamente
                          </p>
                          <p className="text-xs opacity-90">
                            {colaboradoresPendentes.length} colaboradores precisam de conciliação para receber sua Unidade Organizacional (UO).
                          </p>
                        </div>
                      </div>

                      <Button
                        id="btn-resolver-pendencias-uo"
                        variant="secondary"
                        size="sm"
                        onClick={() => abrirClassificacao(departamentosPendentes[0])}
                        className="whitespace-nowrap shrink-0"
                      >
                        Classificar Agora ({departamentosPendentes.length})
                      </Button>
                    </div>
                  )}

                  {/* NAVEGAÇÃO DE ABAS DE PREVIEW */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1 border-b sm:border-b-0">
                      <button
                        id="tab-preview-validos"
                        onClick={() => setAbaAtiva('VALIDOS')}
                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          abaAtiva === 'VALIDOS'
                            ? isDark 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-blue-600 text-white'
                            : isDark 
                              ? 'text-[#94A3B8] hover:text-white' 
                              : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Válidos ({colaboradoresValidos.length})
                      </button>

                      <button
                        id="tab-preview-pendentes"
                        onClick={() => setAbaAtiva('PENDENTES')}
                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          abaAtiva === 'PENDENTES'
                            ? isDark 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-blue-600 text-white'
                            : isDark 
                              ? 'text-[#94A3B8] hover:text-white' 
                              : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Pendentes ({colaboradoresPendentes.length})
                      </button>

                      <button
                        id="tab-preview-erros"
                        onClick={() => setAbaAtiva('ERROS')}
                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                          abaAtiva === 'ERROS'
                            ? isDark 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-blue-600 text-white'
                            : isDark 
                              ? 'text-[#94A3B8] hover:text-white' 
                              : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        Erros ({errosIntegridade.length})
                      </button>
                    </div>

                    {/* Campo de Busca Rápida no Preview */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      <input
                        type="text"
                        placeholder="Buscar por nome, matrícula..."
                        value={termoBusca}
                        onChange={e => setTermoBusca(e.target.value)}
                        className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border transition-all ${
                          isDark 
                            ? 'bg-[#16243D] border-[#243756] text-white placeholder-[#94A3B8]' 
                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>
                  </div>

                  {/* TABELAS DE PREVIEW */}
                  <div className={`rounded-xl border overflow-hidden max-h-[360px] overflow-y-auto ${
                    isDark ? 'bg-[#16243D]/60 border-[#243756]' : 'bg-white border-slate-200'
                  }`}>
                    {/* 1. ABA VÁLIDOS */}
                    {abaAtiva === 'VALIDOS' && (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className={`sticky top-0 z-10 font-semibold border-b ${
                          isDark ? 'bg-[#16243D] text-[#94A3B8] border-[#243756]' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          <tr>
                            <th className="p-3">Matrícula</th>
                            <th className="p-3">Nome do Colaborador</th>
                            <th className="p-3">Função / Cargo</th>
                            <th className="p-3">Lotação (UO)</th>
                            <th className="p-3">Sede</th>
                            <th className="p-3">CPF (LGPD)</th>
                            <th className="p-3">Situação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border)]">
                          {filtrarItens(colaboradoresValidos).length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-[#94A3B8]">
                                Nenhum colaborador válido para exibição nesta visualização.
                              </td>
                            </tr>
                          ) : (
                            filtrarItens(colaboradoresValidos).map((item, idx) => (
                              <tr key={idx} className={isDark ? 'hover:bg-[#243756]/40' : 'hover:bg-slate-50'}>
                                <td className="p-3 font-mono font-bold text-blue-400">
                                  {item.colaborador.matricula}
                                </td>
                                <td className="p-3 font-semibold">
                                  {item.colaborador.nome}
                                </td>
                                <td className="p-3 text-[#94A3B8]">
                                  {item.colaborador.funcao}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] border font-bold ${
                                    item.classificacao.unidade.codigo === 'NAO_CLASSIFICADO'
                                      ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                                      : 'bg-blue-950/40 text-blue-300 border-blue-800/40'
                                  }`}>
                                    {item.classificacao.unidade.siglaExibicao}
                                  </span>
                                </td>
                                <td className="p-3 font-mono">
                                  {item.colaborador.sede || 'BE'}
                                </td>
                                <td className="p-3 font-mono text-[11px] text-[#94A3B8]">
                                  {item.colaborador.cpfMascarado || '***.***.***-**'}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    item.colaborador.status === 'Ativo'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-slate-500/20 text-slate-400'
                                  }`}>
                                    {item.colaborador.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {/* 2. ABA PENDENTES */}
                    {abaAtiva === 'PENDENTES' && (
                      <div className="p-3 space-y-3">
                        {/* Lista de Departamentos Não Reconhecidos */}
                        {departamentosPendentes.length > 0 && (
                          <div className="space-y-2 mb-4">
                            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                              Departamentos aguardando conciliação ({departamentosPendentes.length}):
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {departamentosPendentes.map((d, idx) => (
                                <div
                                  key={idx}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                                    isDark ? 'bg-[#111C30] border-[#243756]' : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <div>
                                    <p className="font-bold text-xs">{d.departamento}</p>
                                    <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                                      {d.ocorrencias} colaborador(es) afetado(s)
                                    </p>
                                  </div>
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    onClick={() => abrirClassificacao(d)}
                                  >
                                    Conciliar UO
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tabela de Colaboradores Pendentes */}
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className={`sticky top-0 z-10 font-semibold border-b ${
                            isDark ? 'bg-[#16243D] text-[#94A3B8] border-[#243756]' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <tr>
                              <th className="p-3">Matrícula</th>
                              <th className="p-3">Nome</th>
                              <th className="p-3">Função</th>
                              <th className="p-3">Departamento Original</th>
                              <th className="p-3 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--surface-border)]">
                            {filtrarItens(colaboradoresPendentes).length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-[#94A3B8]">
                                  Nenhum colaborador pendente. Todos os departamentos foram classificados!
                                </td>
                              </tr>
                            ) : (
                              filtrarItens(colaboradoresPendentes).map((item, idx) => (
                                <tr key={idx} className={isDark ? 'hover:bg-[#243756]/40' : 'hover:bg-slate-50'}>
                                  <td className="p-3 font-mono font-bold text-amber-400">
                                    {item.colaborador.matricula}
                                  </td>
                                  <td className="p-3 font-semibold">{item.colaborador.nome}</td>
                                  <td className="p-3 text-[#94A3B8]">{item.colaborador.funcao}</td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-amber-950/40 text-amber-300 border border-amber-800/40">
                                      {item.departamentoOriginal}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => abrirClassificacao({ departamento: item.departamentoOriginal, ocorrencias: 1 })}
                                    >
                                      Classificar
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 3. ABA ERROS */}
                    {abaAtiva === 'ERROS' && (
                      <div className="p-4 space-y-3">
                        {errosIntegridade.length === 0 ? (
                          <div className="p-8 text-center text-emerald-400 flex flex-col items-center justify-center space-y-2">
                            <CheckCircle2 className="w-8 h-8" />
                            <p className="font-bold">Nenhum erro de integridade encontrado no arquivo.</p>
                            <p className="text-xs text-[#94A3B8]">Todos os registros contêm matrícula e CPF válidos.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-red-400">
                              Os seguintes registros foram ignorados da importação por conterem inconsistências críticas:
                            </p>
                            <div className="divide-y divide-[var(--surface-border)]">
                              {errosIntegridade.map((e, idx) => (
                                <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                                  <div>
                                    <span className="font-mono font-bold text-red-400 mr-2">Linha {e.linha}:</span>
                                    <span className="font-semibold">{e.nome || '(Nome não informado)'}</span>
                                    {e.matricula && (
                                      <span className="ml-2 font-mono text-[11px] text-[#94A3B8]">
                                        [Matrícula: {e.matricula}]
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-red-300 bg-red-950/60 px-2 py-0.5 rounded-md border border-red-800/60 font-mono text-[11px]">
                                    {e.motivo}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CONCILIAÇÃO E PERSISTÊNCIA FIRESTORE */}
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-blue-400" />
                          Conciliação com Base do banco de dados (Sem leituras extras)
                        </p>
                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          {relatorioConflitos.totalNovos} novos registros • {relatorioConflitos.totalAtualizacoes} registros já existentes no sistema.
                        </p>
                      </div>

                      {relatorioConflitos.totalAtualizacoes > 0 && (
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={sobrescreverExistentes}
                            onChange={e => setSobrescreverExistentes(e.target.checked)}
                            className="rounded border-slate-500 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Atualizar dados cadastrais dos existentes</span>
                        </label>
                      )}
                    </div>

                    {/* BARRA DE PROGRESSO EM TEMPO REAL */}
                    {isGravando && progressoGravacao && (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span>Gravando lote {progressoGravacao.loteAtual} de {progressoGravacao.totalLotes}...</span>
                          <span>{progressoGravacao.processados} / {progressoGravacao.total} ({progressoGravacao.percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full transition-all duration-200" 
                            style={{ width: `${progressoGravacao.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ========================================================= */}
        {/* FOOTER MODAL COM AÇÕES                                    */}
        {/* ========================================================= */}
        {!gravacaoConcluida && (
          <div className={`p-4 sm:p-5 flex items-center justify-between border-t shrink-0 ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-slate-50 border-slate-200'
          }`}>
            <Button
              id="btn-cancelar-importacao-colaboradores"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isGravando}
            >
              Cancelar
            </Button>

            {todosColaboradores.length > 0 && (
              <div className="flex items-center gap-3">
                {departamentosPendentes.length > 0 && (
                  <span className="text-xs text-amber-400 hidden sm:inline">
                    ⚠️ {departamentosPendentes.length} UO(s) pendente(s)
                  </span>
                )}

                <Button
                  id="btn-executar-gravacao-colaboradores"
                  variant="primary"
                  size="md"
                  onClick={handleConfirmarImportacaoFirestore}
                  isLoading={isGravando}
                  disabled={colaboradoresValidos.length === 0 || isGravando}
                  icon={<Check className="w-4 h-4" />}
                >
                  Importar {colaboradoresValidos.length} Colaboradores
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SUBMODAL DE CLASSIFICAÇÃO INTERATIVA DE DEPARTAMENTO      */}
      {/* ========================================================= */}
      {deptoEmClassificacao && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-[#0B1426] border-[#335075] text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            {/* Header do Submodal */}
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Conciliação de UO Pendente
                </span>
                <h4 className="text-base font-bold mt-1">
                  O departamento <span className="text-blue-400">"{deptoEmClassificacao.departamento}"</span> não foi reconhecido.
                </h4>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  Afeta <strong>{deptoEmClassificacao.ocorrencias} colaborador(es)</strong> nesta importação. O que deseja fazer?
                </p>
              </div>

              <button
                onClick={() => setDeptoEmClassificacao(null)}
                className="p-1 text-[#94A3B8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* OPÇÕES DE CLASSIFICAÇÃO */}
            <div className="space-y-3">
              {/* OPÇÃO A: UO EXISTENTE */}
              <div 
                onClick={() => setOpcaoClassificacao('EXISTENTE')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  opcaoClassificacao === 'EXISTENTE'
                    ? isDark 
                      ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500' 
                      : 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                    : isDark 
                      ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${
                    opcaoClassificacao === 'EXISTENTE'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : isDark ? 'bg-[#243756] text-[#94A3B8] border-[#335075]' : 'bg-white text-slate-500 border-slate-200'
                  }`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Opção A: Associar a uma UO existente</p>
                    <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                      Selecione uma das Unidades Organizacionais canônicas já cadastradas na COMARA.
                    </p>
                  </div>
                </div>

                {opcaoClassificacao === 'EXISTENTE' && (
                  <div className="mt-3 pt-3 border-t border-[var(--surface-border)] space-y-2">
                    <input
                      type="text"
                      placeholder="Filtrar UO (ex: KO, MN, DL, Suprimentos)..."
                      value={filtroUoBusca}
                      onChange={e => setFiltroUoBusca(e.target.value)}
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${
                        isDark ? 'bg-[#0B1426] border-[#335075] text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <select
                      value={uoSelecionadaCodigo}
                      onChange={e => setUoSelecionadaCodigo(e.target.value)}
                      className={`w-full p-2 text-xs rounded-lg border font-mono ${
                        isDark ? 'bg-[#0B1426] border-[#335075] text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {listaUosCadastradas.map(uo => (
                        <option key={uo.codigo} value={uo.codigo}>
                          {uo.siglaExibicao} • {uo.nome} ({uo.tipo})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* OPÇÃO B: CRIAR NOVA UNIDADE ORGANIZACIONAL */}
              <div 
                onClick={() => setOpcaoClassificacao('NOVO')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  opcaoClassificacao === 'NOVO'
                    ? isDark 
                      ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500' 
                      : 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                    : isDark 
                      ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${
                    opcaoClassificacao === 'NOVO'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : isDark ? 'bg-[#243756] text-[#94A3B8] border-[#335075]' : 'bg-white text-slate-500 border-slate-200'
                  }`}>
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Opção B: Cadastrar como nova Unidade Organizacional (UO)</p>
                    <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                      Crie um novo Setor subordinado a qualquer OU. DECO/DACO são apenas categorias reconhecidas na importação.
                    </p>
                  </div>
                </div>

                {opcaoClassificacao === 'NOVO' && (
                  <div className="mt-3 pt-3 border-t border-[var(--surface-border)] space-y-3" onClick={e => e.stopPropagation()}>
                    {/* Seletor de Categoria de UO */}
                    <div>
                      <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1">
                        Selecione o Tipo de Criação:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[var(--surface-base)] border border-[var(--surface-border)]">
                        <button
                          type="button"
                          id="btn-categoria-novo-setor"
                          onClick={() => {
                            setNovoSetorForm(prev => ({
                              ...prev,
                              tipo: 'SETOR',
                              pai: '',
                              sigla: prev.sigla.startsWith('SETOR_') ? prev.sigla : `SETOR_${prev.sigla.replace(/^(DECO_|DACO_)/, '')}`,
                            }));
                          }}
                          className={`py-1.5 px-2 rounded text-xs font-semibold transition-all ${
                            novoSetorForm.tipo === 'SETOR'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : isDark ? 'text-[#94A3B8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Criar novo Setor
                        </button>
                        <button
                          type="button"
                          id="btn-categoria-novo-deco"
                          onClick={() => {
                            setNovoSetorForm(prev => ({
                              ...prev,
                              tipo: 'DECO',
                              pai: 'COMARA',
                              sedeOuCanteiroPadrao: prev.sedeOuCanteiroPadrao === 'BE' ? 'KO' : prev.sedeOuCanteiroPadrao,
                              sigla: prev.sigla.startsWith('DECO_') ? prev.sigla : `DECO_${prev.sigla.replace(/^(SETOR_|DACO_)/, '')}`,
                            }));
                          }}
                          className={`py-1.5 px-2 rounded text-xs font-semibold transition-all ${
                            novoSetorForm.tipo === 'DECO'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : isDark ? 'text-[#94A3B8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Criar novo DECO
                        </button>
                        <button
                          type="button"
                          id="btn-categoria-novo-daco"
                          onClick={() => {
                            setNovoSetorForm(prev => ({
                              ...prev,
                              tipo: 'DACO',
                              pai: 'COMARA',
                              sedeOuCanteiroPadrao: prev.sedeOuCanteiroPadrao === 'BE' ? 'MN' : prev.sedeOuCanteiroPadrao,
                              sigla: prev.sigla.startsWith('DACO_') ? prev.sigla : `DACO_${prev.sigla.replace(/^(SETOR_|DECO_)/, '')}`,
                            }));
                          }}
                          className={`py-1.5 px-2 rounded text-xs font-semibold transition-all ${
                            novoSetorForm.tipo === 'DACO'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : isDark ? 'text-[#94A3B8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Criar novo DACO
                        </button>
                      </div>
                    </div>

                    {/* Campos: Sigla e Nome */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-[#94A3B8]">
                          Sigla <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          id="input-novo-uo-sigla"
                          value={novoSetorForm.sigla}
                          onChange={e => setNovoSetorForm({ ...novoSetorForm, sigla: e.target.value.toUpperCase() })}
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg border font-mono mt-0.5 ${
                            isDark ? 'bg-[#0B1426] border-[#335075] text-white' : 'bg-white border-slate-300'
                          }`}
                          placeholder={novoSetorForm.tipo === 'SETOR' ? 'SETOR_RH' : novoSetorForm.tipo === 'DECO' ? 'DECO_SGC' : 'DACO_PVH'}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-[#94A3B8]">
                          Nome Completo <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          id="input-novo-uo-nome"
                          value={novoSetorForm.nome}
                          onChange={e => setNovoSetorForm({ ...novoSetorForm, nome: e.target.value })}
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg border mt-0.5 ${
                            isDark ? 'bg-[#0B1426] border-[#335075] text-white' : 'bg-white border-slate-300'
                          }`}
                          placeholder={novoSetorForm.tipo === 'SETOR' ? 'Recursos Humanos' : 'Destacamento de Engenharia'}
                        />
                      </div>
                    </div>

                    {/* Campo: Tipo (fixo e não editável) e UO Pai */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-[#94A3B8]">
                          Tipo (Fixo)
                        </label>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={
                            novoSetorForm.tipo === 'SETOR'
                              ? 'SETOR'
                              : novoSetorForm.tipo === 'DECO'
                                ? 'DECO'
                                : 'DACO'
                          }
                          className={`w-full p-1.5 text-xs font-mono font-bold rounded-lg border mt-0.5 opacity-80 cursor-not-allowed ${
                            isDark ? 'bg-[#0B1426]/70 border-[#335075] text-blue-300' : 'bg-slate-100 border-slate-300 text-blue-700'
                          }`}
                        />
                      </div>

                      {/* UO Pai: Dropdown OBRIGATÓRIO para SETOR; Informativo COMARA para DECO/DACO */}
                      <div>
                        {novoSetorForm.tipo === 'SETOR' ? (
                          <div>
                            <label className="text-[10px] font-semibold text-blue-400 flex items-center justify-between">
                              <span>UO Pai <span className="text-red-400">* (Obrigatório)</span></span>
                              {!novoSetorForm.pai && (
                                <span className="text-[9px] text-amber-400 font-medium">Selecione</span>
                              )}
                            </label>
                            <select
                              id="select-novo-setor-uo-pai"
                              value={novoSetorForm.pai || ''}
                              onChange={e => {
                                const codigoPai = e.target.value;
                                const uoPaiObj = UNIDADES_ORGANIZACIONAIS[codigoPai];
                                setNovoSetorForm(prev => ({
                                  ...prev,
                                  pai: codigoPai,
                                  sedeOuCanteiroPadrao: uoPaiObj?.sedeOuCanteiroPadrao || prev.sedeOuCanteiroPadrao || 'BE',
                                }));
                              }}
                              className={`w-full p-1.5 text-xs rounded-lg border mt-0.5 font-medium transition-colors ${
                                !novoSetorForm.pai 
                                  ? 'border-amber-500 ring-1 ring-amber-500/50 bg-amber-500/10 text-amber-200' 
                                  : isDark 
                                    ? 'bg-[#0B1426] border-[#335075] text-white' 
                                    : 'bg-white border-slate-300 text-slate-800'
                              }`}
                            >
                              <option value="">-- Selecione a UO Pai --</option>
                              {listaUosPaiDisponiveis.map(uo => (
                                <option key={uo.codigo} value={uo.codigo}>
                                  {uo.siglaExibicao} • {uo.nome} ({uo.tipo})
                                </option>
                              ))}
                            </select>
                            {!novoSetorForm.pai && (
                              <p className="text-[10px] text-amber-400 mt-1">
                                ⚠️ Informe a OU à qual este setor pertence.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] font-semibold text-[#94A3B8]">
                              UO Pai (Hierarquia COMARA)
                            </label>
                            <div className={`p-1.5 rounded-lg border text-xs mt-0.5 flex items-center justify-between ${
                              isDark ? 'bg-[#0B1426]/60 border-[#335075] text-[#94A3B8]' : 'bg-slate-100 border-slate-300 text-slate-500'
                            }`}>
                              <span>COMARA (Subordinação Direta)</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">Padrão</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sede e Descrição */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-[#94A3B8]">Sede / Canteiro de Referência</label>
                        <select
                          id="select-novo-uo-sede"
                          value={novoSetorForm.sedeOuCanteiroPadrao || 'BE'}
                          onChange={e => setNovoSetorForm({ ...novoSetorForm, sedeOuCanteiroPadrao: e.target.value })}
                          className={`w-full p-1.5 text-xs rounded-lg border mt-0.5 ${
                            isDark ? 'bg-[#0B1426] border-[#335075] text-white' : 'bg-white border-slate-300'
                          }`}
                        >
                          <option value="BE">BE (Belém)</option>
                          <option value="KO">KO (Coari)</option>
                          <option value="MN">MN (Manaus)</option>
                          <option value="FB">FB (Fonte Boa)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-[#94A3B8]">Descrição (Opcional)</label>
                        <input
                          type="text"
                          id="input-novo-uo-descricao"
                          value={novoSetorForm.descricao || ''}
                          onChange={e => setNovoSetorForm({ ...novoSetorForm, descricao: e.target.value })}
                          placeholder="Finalidade ou detalhes da UO"
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg border mt-0.5 ${
                            isDark ? 'bg-[#0B1426] border-[#335075] text-white' : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* OPÇÃO C: DEIXAR COMO NÃO CLASSIFICADO */}
              <div 
                onClick={() => setOpcaoClassificacao('NAO_CLASSIFICADO')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  opcaoClassificacao === 'NAO_CLASSIFICADO'
                    ? isDark 
                      ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500' 
                      : 'bg-amber-50 border-amber-500 ring-1 ring-amber-500'
                    : isDark 
                      ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${
                    opcaoClassificacao === 'NAO_CLASSIFICADO'
                      ? 'bg-amber-600 text-white border-amber-500'
                      : isDark ? 'bg-[#243756] text-[#94A3B8] border-[#335075]' : 'bg-white text-slate-500 border-slate-200'
                  }`}>
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Opção C: Deixar como Não Classificado</p>
                    <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                      Os colaboradores serão importados com a lotação definida como "NAO_CLASSIFICADO".
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações do Submodal */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--surface-border)]">
              <div>
                {!isClassificacaoValida && opcaoClassificacao === 'NOVO' && novoSetorForm.tipo === 'SETOR' && !novoSetorForm.pai && (
                  <span className="text-[11px] text-amber-400 font-medium">
                    ⚠️ Selecione a UO pai para poder salvar o novo setor.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDeptoEmClassificacao(null)}
                >
                  Cancelar
                </Button>
                <Button
                  id="btn-confirmar-classificacao-modal"
                  variant="primary"
                  size="sm"
                  onClick={confirmarClassificacao}
                  disabled={!isClassificacaoValida}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  Aplicar aos {deptoEmClassificacao.ocorrencias} Colaboradores
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
