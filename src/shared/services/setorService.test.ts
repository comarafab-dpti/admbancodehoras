import { 
  gerarSugestaoCodigoSetor, 
  gerarSugestaoCodigoUO, 
  setorService 
} from './setorService';
import { UnidadeOrganizacional, Employee } from '../types';

console.log('=== TESTES: GESTÃO DE UOS E SETORES (Gaps 2, 3, 4, 5) ===\n');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

// 1. Geração de sugestão de código conforme tipo (Gap 3 & 5)
console.log('--- 1. Sugestão de Códigos por Tipo de UO (Gap 3) ---');
assert(gerarSugestaoCodigoUO('SEDE', 'BE') === 'SEDE_BE', 'SEDE BE gera SEDE_BE');
assert(gerarSugestaoCodigoUO('DACO', 'MN') === 'DACO_MN', 'DACO MN gera DACO_MN');
assert(gerarSugestaoCodigoUO('DECO', 'KO') === 'DECO_KO', 'DECO KO gera DECO_KO');
assert(gerarSugestaoCodigoUO('SETOR', 'SAQ') === 'SETOR_SAQ', 'SETOR SAQ gera SETOR_SAQ');
assert(gerarSugestaoCodigoSetor('DAPC') === 'SETOR_DAPC', 'Wrapper legado gerarSugestaoCodigoSetor funciona');
assert(gerarSugestaoCodigoUO('SETOR', 'Almoxarifado Geral') === 'SETOR_ALMOXARIFADO_GERAL', 'Nome com espaço e acento é normalizado');

// 2. Consulta de setores e UOs em memória
console.log('\n--- 2. Consulta de Setores e UOs Principais ---');
const { setores, uosPrincipais } = setorService.getSetoresAtuais();

assert(setores.length > 0, 'Existem setores pré-cadastrados');
assert(uosPrincipais.length > 0, 'Existem UOs principais');
assert(setores.every(s => s.tipo === 'SETOR'), 'Todos os itens de setores possuem tipo SETOR');
assert(uosPrincipais.every(u => u.tipo !== 'SETOR'), 'UOs principais não possuem tipo SETOR');

async function runAsyncTests() {
  // 3. Cadastrar qualquer tipo de UO (Gap 3)
  console.log('\n--- 3. Criação de Qualquer Tipo de UO (Gap 3) ---');
  
  // 3.1 Criar DECO
  const novaDeco: UnidadeOrganizacional = {
    codigo: 'DECO_TESTE',
    nome: 'Destacamento de Engenharia de Teste',
    siglaExibicao: 'DECO-TESTE',
    tipo: 'DECO',
    sedeOuCanteiroPadrao: 'TT',
    ativa: true,
    descricao: 'DECO criada para teste'
  };
  await setorService.salvarSetor(novaDeco);
  const { todasUOs } = setorService.getSetoresAtuais();
  const decoSalva = todasUOs.find(u => u.codigo === 'DECO_TESTE');
  assert(!!decoSalva, 'DECO salva com sucesso');
  assert(decoSalva?.tipo === 'DECO', 'Tipo DECO preservado');
  assert(decoSalva?.pai === 'COMARA', 'DECO tem pai implícito = COMARA');

  // 3.2 Criar SETOR subordinado à DECO_TESTE
  const novoSetor: UnidadeOrganizacional = {
    codigo: 'SETOR_TESTE_AUTO',
    nome: 'Seção de Teste Automatizado',
    siglaExibicao: 'TESTE-AUTO',
    tipo: 'SETOR',
    pai: 'DECO_TESTE',
    sedeOuCanteiroPadrao: 'TT',
    ativa: true,
    descricao: 'Setor filho da DECO'
  };
  await setorService.salvarSetor(novoSetor);
  const setorSalvo = setorService.getSetoresAtuais().setores.find(s => s.codigo === 'SETOR_TESTE_AUTO');
  assert(!!setorSalvo, 'Setor filho salvo com sucesso');
  assert(setorSalvo?.pai === 'DECO_TESTE', 'Setor vinculado à UO pai DECO_TESTE');

  // 4. Verificação de Dependências antes de excluir (Gap 4)
  console.log('\n--- 4. Verificação de Dependências antes de Excluir UO (Gap 4) ---');
  
  // 4.1 A DECO_TESTE tem um filho ('SETOR_TESTE_AUTO'), portanto deve acusar dependência de filho
  const depDeco = setorService.verificarDependenciasUO('DECO_TESTE', [], setorService.getSetoresAtuais().todasUOs);
  assert(depDeco.temDependencias === true, 'DECO_TESTE acusa dependências por ter UO filha');
  assert(depDeco.totalFilhos === 1, 'Total de filhos detectado corretamente (1)');
  assert(depDeco.mensagemBloqueio?.includes('1 filhos') === true, 'Mensagem amigável cita contagem de filhos');

  // 4.2 Tentativa de excluir UO com filhos deve lançar erro bloqueante
  let erroLancado = false;
  try {
    await setorService.excluirSetor('DECO_TESTE', [], setorService.getSetoresAtuais().todasUOs);
  } catch (err: any) {
    erroLancado = true;
    assert(err.message.includes('dependências'), 'Exclusão bloqueada com mensagem informativa de dependências');
  }
  assert(erroLancado, 'excluirSetor lançou erro e bloqueou exclusão de UO com filhos');

  // 4.3 Testar dependência de colaboradores associados
  const mockEmployees: Employee[] = [
    {
      id: 'emp-1',
      matricula: '12345',
      name: 'Soldado Teste',
      lotacaoUoCodigo: 'SETOR_TESTE_AUTO',
      sede: 'TT',
      status: 'ATIVO'
    } as unknown as Employee
  ];

  const depSetor = setorService.verificarDependenciasUO('SETOR_TESTE_AUTO', mockEmployees);
  assert(depSetor.temDependencias === true, 'Setor acusa dependência por ter colaborador vinculado');
  assert(depSetor.totalColaboradores === 1, 'Total de colaboradores detectado corretamente (1)');

  let erroSetor = false;
  try {
    await setorService.excluirSetor('SETOR_TESTE_AUTO', mockEmployees);
  } catch (err: any) {
    erroSetor = true;
    assert(err.message.includes('colaboradores'), 'Exclusão de setor com colaboradores bloqueada com sucesso');
  }
  assert(erroSetor, 'excluirSetor bloqueou exclusão de setor com colaboradores');

  // 4.4 Exclusão permitida quando sem dependências
  console.log('\n--- 5. Exclusão Segura quando Sem Dependências ---');
  // Exclui o setor primeiro (sem colaboradores passados)
  await setorService.excluirSetor('SETOR_TESTE_AUTO', []);
  const setorApos = setorService.getSetoresAtuais().todasUOs.find(u => u.codigo === 'SETOR_TESTE_AUTO');
  assert(!setorApos, 'Setor excluído com sucesso após remoção das dependências');

  // Agora a DECO não tem mais filhos e pode ser excluída
  await setorService.excluirSetor('DECO_TESTE', [], setorService.getSetoresAtuais().todasUOs);
  const decoApos = setorService.getSetoresAtuais().todasUOs.find(u => u.codigo === 'DECO_TESTE');
  assert(!decoApos, 'DECO excluída com sucesso após ficar sem dependências');

  console.log('\n🎉 Todos os testes de setorService (Gaps 2, 3, 4, 5) passaram com 100% de êxito!');
}

runAsyncTests().catch((e) => {
  console.error('Erro na execução dos testes:', e);
  process.exit(1);
});
