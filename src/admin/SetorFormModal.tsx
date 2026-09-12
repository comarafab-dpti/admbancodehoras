import React, { useState, useEffect, useMemo } from 'react';
import { UnidadeOrganizacional, TipoUnidadeOrganizacional, Employee } from '@/src/shared/types';
import { gerarSugestaoCodigoUO, setorService } from '@/src/shared/services/setorService';
import { 
  X, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Building, 
  Tag, 
  Info, 
  ShieldAlert, 
  Users, 
  GitBranch, 
  Warehouse 
} from 'lucide-react';
import { Button } from '@/src/shared/components/ui/Button';

interface SetorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (setor: UnidadeOrganizacional, codigoOriginal?: string) => Promise<void>;
  editingSetor: UnidadeOrganizacional | null;
  uosPrincipais: UnidadeOrganizacional[];
  setoresExistentes: UnidadeOrganizacional[];
  todasUOs?: UnidadeOrganizacional[];
  employees?: Employee[];
  initialTipo?: TipoUnidadeOrganizacional;
  initialPai?: string;
  theme?: 'dark' | 'light';
}

export const SetorFormModal: React.FC<SetorFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSetor,
  uosPrincipais,
  setoresExistentes,
  todasUOs = [],
  employees = [],
  initialTipo,
  initialPai,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';

  // Campos do formulário
  const [tipo, setTipo] = useState<TipoUnidadeOrganizacional>('SETOR');
  const [nome, setNome] = useState('');
  const [siglaExibicao, setSiglaExibicao] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pai, setPai] = useState('SEDE_BE');
  const [sedeOuCanteiroPadrao, setSedeOuCanteiroPadrao] = useState('BE');
  const [descricao, setDescricao] = useState('');
  const [ativa, setAtiva] = useState(true);

  const [isCodigoManual, setIsCodigoManual] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lista unificada de todas as UOs existentes para validação de unicidade
  const catalogoCompleto = useMemo(() => {
    const map = new Map<string, UnidadeOrganizacional>();
    todasUOs.forEach((u) => map.set(u.codigo.toUpperCase(), u));
    uosPrincipais.forEach((u) => map.set(u.codigo.toUpperCase(), u));
    setoresExistentes.forEach((u) => map.set(u.codigo.toUpperCase(), u));
    return Array.from(map.values());
  }, [todasUOs, uosPrincipais, setoresExistentes]);

  // UOs elegíveis para serem Pai de um Setor (apenas SEDE, DACO ou DECO)
  const paisElegiveis = useMemo(() => {
    return catalogoCompleto.filter(
      (u) => (u.tipo === 'SEDE' || u.tipo === 'DACO' || u.tipo === 'DECO') && u.codigo !== 'NAO_CLASSIFICADO'
    );
  }, [catalogoCompleto]);

  // Inicializa o formulário com dados da UO em edição ou valores padrão
  useEffect(() => {
    if (editingSetor) {
      setTipo(editingSetor.tipo || 'SETOR');
      setNome(editingSetor.nome || '');
      setSiglaExibicao(editingSetor.siglaExibicao || '');
      setCodigo(editingSetor.codigo || '');
      setPai(editingSetor.pai || 'SEDE_BE');
      setSedeOuCanteiroPadrao(editingSetor.sedeOuCanteiroPadrao || 'BE');
      setDescricao(editingSetor.descricao || '');
      setAtiva(typeof editingSetor.ativa === 'boolean' ? editingSetor.ativa : true);
      setIsCodigoManual(true);
    } else {
      const tipoPadrao = initialTipo || 'SETOR';
      setTipo(tipoPadrao);
      setNome('');
      setSiglaExibicao('');
      setCodigo('');
      const defaultPai = initialPai || paisElegiveis[0]?.codigo || 'SEDE_BE';
      setPai(defaultPai);
      const paiObj = paisElegiveis.find((p) => p.codigo === defaultPai);
      setSedeOuCanteiroPadrao(paiObj?.sedeOuCanteiroPadrao || 'BE');
      setDescricao('');
      setAtiva(true);
      setIsCodigoManual(false);
    }
    setErrorMessage(null);
  }, [editingSetor, isOpen, initialTipo, initialPai, paisElegiveis]);

  // Validação em tempo real de código único (Gap 5)
  const codigoTrim = (codigo || '').trim().toUpperCase();
  const conflitoCodigo = useMemo(() => {
    if (!codigoTrim) return null;
    return catalogoCompleto.find((u) => {
      const isSelf = editingSetor && u.codigo.toUpperCase() === editingSetor.codigo.toUpperCase();
      return !isSelf && u.codigo.toUpperCase() === codigoTrim;
    });
  }, [codigoTrim, catalogoCompleto, editingSetor]);

  const isCodigoInvalidoOuDuplicado = Boolean(conflitoCodigo);

  // Verificação de dependências em edição (Gap 4)
  const dependenciasEdicao = useMemo(() => {
    if (!editingSetor) return { temDependencias: false, totalFilhos: 0, totalColaboradores: 0, filhos: [] };
    return setorService.verificarDependenciasUO(editingSetor.codigo, employees, catalogoCompleto);
  }, [editingSetor, employees, catalogoCompleto]);

  if (!isOpen) return null;

  // Atualiza sede padrão automaticamente quando o usuário altera a UO pai
  const handlePaiChange = (novoPai: string) => {
    setPai(novoPai);
    const uoPai = paisElegiveis.find((u) => u.codigo === novoPai);
    if (uoPai?.sedeOuCanteiroPadrao) {
      setSedeOuCanteiroPadrao(uoPai.sedeOuCanteiroPadrao);
    }
  };

  // Mudança de tipo com aplicação de regras condicionais (Gap 3)
  const handleTipoChange = (novoTipo: TipoUnidadeOrganizacional) => {
    setTipo(novoTipo);
    if (novoTipo === 'SETOR') {
      if (!pai || pai === 'COMARA') {
        const defaultPai = paisElegiveis[0]?.codigo || 'SEDE_BE';
        setPai(defaultPai);
        const uoPai = paisElegiveis.find((u) => u.codigo === defaultPai);
        if (uoPai?.sedeOuCanteiroPadrao) setSedeOuCanteiroPadrao(uoPai.sedeOuCanteiroPadrao);
      }
    } else {
      setPai('COMARA');
    }

    if (!isCodigoManual && !editingSetor) {
      setCodigo(gerarSugestaoCodigoUO(novoTipo, siglaExibicao, nome));
    }
  };

  // Sugestão automática de código conforme convenção
  const handleSiglaChange = (val: string) => {
    const uppercase = val.toUpperCase();
    setSiglaExibicao(uppercase);
    if (!isCodigoManual && !editingSetor) {
      setCodigo(gerarSugestaoCodigoUO(tipo, uppercase, nome));
    }
  };

  const handleNomeChange = (val: string) => {
    setNome(val);
    if (!isCodigoManual && !editingSetor && !siglaExibicao) {
      setCodigo(gerarSugestaoCodigoUO(tipo, '', val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const nomeTrim = nome.trim();
    const siglaTrim = siglaExibicao.trim().toUpperCase();
    const codigoFinal = (codigo.trim() || gerarSugestaoCodigoUO(tipo, siglaTrim, nomeTrim)).toUpperCase();

    if (!nomeTrim) {
      setErrorMessage('Por favor, informe o nome da Unidade Organizacional.');
      return;
    }

    if (!siglaTrim) {
      setErrorMessage('Por favor, informe a sigla de exibição.');
      return;
    }

    if (!codigoFinal) {
      setErrorMessage('Por favor, informe um código único de identificação.');
      return;
    }

    // Validação de tipo SETOR com UO Pai obrigatória
    if (tipo === 'SETOR' && (!pai || pai === 'COMARA')) {
      setErrorMessage('Para unidades do tipo SETOR, é obrigatório selecionar uma UO Pai (SEDE, DACO ou DECO).');
      return;
    }

    // Bloqueio de código duplicado
    if (isCodigoInvalidoOuDuplicado) {
      setErrorMessage(
        `O código "${codigoFinal}" já está em uso pela UO "${conflitoCodigo?.nome}". Escolha outro código.`
      );
      return;
    }

    const paiFinal = tipo === 'SETOR' ? pai : 'COMARA';

    const uoAtualizada: UnidadeOrganizacional = {
      codigo: codigoFinal,
      nome: nomeTrim,
      siglaExibicao: siglaTrim,
      tipo,
      pai: paiFinal,
      sedeOuCanteiroPadrao: (sedeOuCanteiroPadrao || 'BE').trim().toUpperCase(),
      ativa,
      descricao: descricao.trim()
    };

    setIsSubmitting(true);
    try {
      await onSave(uoAtualizada, editingSetor?.codigo);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar UO:', err);
      setErrorMessage(err?.message || 'Falha ao salvar a Unidade Organizacional. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 my-8 ${
          isDark ? 'bg-[#16243D] border-[#243756] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Cabeçalho do Modal */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-[#243756] bg-[#0E1A2E]' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                {editingSetor ? `Editar UO: ${editingSetor.siglaExibicao}` : 'Cadastrar Nova Unidade Organizacional (UO)'}
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {editingSetor 
                  ? `Altere as propriedades ou vínculos da unidade ${editingSetor.codigo}` 
                  : 'Crie uma nova SEDE, DACO, DECO ou SETOR vinculado na estrutura COMARA'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition-colors ${
              isDark 
                ? 'border-[#243756] hover:bg-[#243756] text-slate-400 hover:text-white' 
                : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Aviso de dependências em caso de edição */}
          {editingSetor && dependenciasEdicao.temDependencias && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">UO com dependências ativas: </span>
                <span>
                  {dependenciasEdicao.totalFilhos} UO(s) filha(s) vinculada(s) e {dependenciasEdicao.totalColaboradores} colaborador(es) associado(s). A exclusão física desta UO está bloqueada por segurança.
                </span>
              </div>
            </div>
          )}

          {/* Gap 3: Seletor de Tipo de UO (SEDE, DACO, DECO, SETOR) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Tipo de Unidade Organizacional <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'SETOR', label: 'SETOR', desc: 'Subdivisão de UO' },
                  { id: 'DECO', label: 'DECO', desc: 'Canteiro de Obras' },
                  { id: 'DACO', label: 'DACO', desc: 'Destacamento Apoio' },
                  { id: 'SEDE', label: 'SEDE', desc: 'Sede Administrativa' }
                ] as const
              ).map((item) => {
                const isSelected = tipo === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTipoChange(item.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 text-blue-400 shadow-xs ring-1 ring-blue-500/30'
                        : isDark
                        ? 'bg-[#0E1A2E] border-[#243756] text-slate-400 hover:text-slate-200 hover:border-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold tracking-wide">{item.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nome da UO */}
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Nome da UO <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => handleNomeChange(e.target.value)}
                placeholder={
                  tipo === 'SETOR'
                    ? 'Ex: Seção de Aquisições, Divisão de Logística'
                    : tipo === 'DECO'
                    ? 'Ex: Destacamento de Engenharia de Coari'
                    : tipo === 'DACO'
                    ? 'Ex: Destacamento de Apoio de Manaus'
                    : 'Ex: Sede Administrativa de Belém'
                }
                className={`w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  isDark ? 'bg-[#0E1A2E] border-[#243756] text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                required
              />
            </div>

            {/* Sigla de Exibição */}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Sigla <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={siglaExibicao}
                onChange={(e) => handleSiglaChange(e.target.value)}
                placeholder={
                  tipo === 'SETOR' ? 'Ex: SAQ, PMAC' : tipo === 'DECO' ? 'Ex: DECO-KO' : tipo === 'DACO' ? 'Ex: DACO-MN' : 'Ex: SEDE-BE'
                }
                maxLength={15}
                className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors uppercase ${
                  isDark ? 'bg-[#0E1A2E] border-[#243756] text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* UO Pai: Obrigatório para SETOR, Oculto para SEDE/DACO/DECO (Gap 3) */}
            {tipo === 'SETOR' ? (
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>UO Pai Vinculada <span className="text-red-400">*</span></span>
                </label>
                <select
                  value={pai}
                  onChange={(e) => handlePaiChange(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isDark ? 'bg-[#0E1A2E] border-[#243756] text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  required
                >
                  {paisElegiveis.map((uo) => (
                    <option key={uo.codigo} value={uo.codigo}>
                      [{uo.tipo}] {uo.siglaExibicao} • {uo.nome}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 block">
                  Selecione a SEDE, DACO ou DECO responsável por este setor.
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Vínculo Institucional
                </label>
                <div className={`px-3.5 py-2 rounded-xl text-sm border flex items-center gap-2 ${
                  isDark ? 'bg-[#0E1A2E]/50 border-[#243756] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <GitBranch className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-xs">Vinculação direta à Direção Geral (COMARA)</span>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Unidade de Nível 2 com subordinação direta à COMARA.
                </span>
              </div>
            )}

            {/* Sede Territorial Padrão */}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Sede Territorial Padrão
              </label>
              <input
                type="text"
                value={sedeOuCanteiroPadrao}
                onChange={(e) => setSedeOuCanteiroPadrao(e.target.value.toUpperCase())}
                placeholder="Ex: BE, MN, KO, FB"
                maxLength={6}
                className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors uppercase ${
                  isDark ? 'bg-[#0E1A2E] border-[#243756] text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <span className="text-[11px] text-slate-500 block">
                Bigrama territorial oficial de operação física (ex: BE, MN, KO, FB).
              </span>
            </div>
          </div>

          {/* Código de Identificação Técnico com Validação em Tempo Real (Gap 5) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Código Único de Identificação (Técnico) <span className="text-red-400">*</span>
              </label>
              {!isCodigoManual && !editingSetor && (
                <button
                  type="button"
                  onClick={() => setIsCodigoManual(true)}
                  className="text-[11px] text-blue-400 hover:underline"
                >
                  Personalizar código
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={codigo}
                onChange={(e) => {
                  setIsCodigoManual(true);
                  setCodigo(e.target.value.toUpperCase());
                }}
                placeholder={
                  tipo === 'SEDE' ? 'Ex: SEDE_BE' : tipo === 'DACO' ? 'Ex: DACO_MN' : tipo === 'DECO' ? 'Ex: DECO_KO' : 'Ex: SETOR_SAQ'
                }
                className={`w-full px-3.5 py-2 rounded-xl text-sm font-mono border focus:outline-none transition-colors uppercase ${
                  isCodigoInvalidoOuDuplicado
                    ? 'border-red-500 bg-red-500/10 text-red-300 focus:ring-2 focus:ring-red-500'
                    : isDark
                    ? 'bg-[#0E1A2E] border-[#243756] text-white focus:ring-2 focus:ring-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500'
                }`}
                required
              />
              {isCodigoInvalidoOuDuplicado ? (
                <AlertCircle className="w-4 h-4 text-red-400 absolute right-3 top-2.5 pointer-events-none" />
              ) : codigoTrim ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-3 top-2.5 pointer-events-none" />
              ) : null}
            </div>

            {/* Mensagem de erro em tempo real para código duplicado */}
            {isCodigoInvalidoOuDuplicado ? (
              <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Este código já está em uso. Escolha outro. ({conflitoCodigo?.nome})</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500 block">
                Convenção: {tipo === 'SEDE' ? 'SEDE_XX' : tipo === 'DACO' ? 'DACO_XX' : tipo === 'DECO' ? 'DECO_XX' : 'SETOR_NOME'} (chave primária da UO).
              </span>
            )}
          </div>

          {/* Descrição / Atribuições */}
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Descrição / Atribuições (Opcional)
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Ex: Responsável pelas atividades de infraestrutura e apoio operacional."
              className={`w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                isDark ? 'bg-[#0E1A2E] border-[#243756] text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Status Ativo / Inativo */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            isDark ? 'bg-[#0E1A2E] border-[#243756]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className="font-semibold text-sm">Status da Unidade</div>
              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {ativa ? 'Unidade ativa e disponível para alocação de pessoal' : 'Unidade inativa (mantém histórico contábil)'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAtiva(!ativa)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer active:scale-[0.98] ${
                ativa
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
              }`}
            >
              {ativa ? 'ATIVA' : 'INATIVA'}
            </button>
          </div>

          {/* Rodapé e Botões */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || isCodigoInvalidoOuDuplicado || !nome.trim() || !siglaExibicao.trim() || (tipo === 'SETOR' && (!pai || pai === 'COMARA'))}
              isLoading={isSubmitting}
            >
              {editingSetor ? 'Salvar Alterações' : 'Cadastrar UO'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
