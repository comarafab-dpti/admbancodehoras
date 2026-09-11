import { collection, doc, getDocs, writeBatch, limit, query } from './db';
import { db, logDbError, OperationType } from './db';
import { COLLECTIONS, dbService, sanitizeDbData } from './dbService';
import { storageService } from './storageService';
import { localCache } from './localCache';
import { registrarLogAuditoria } from './auditService';
import { 
  Employee, 
  TimeRecord, 
  InsalubrityRecord, 
  ConstructionSite, 
  DispensaSptfRecord, 
  PaystubRecord 
} from '../types';

export interface SeedProgressInfo {
  phase: 'preparing' | 'canteiros' | 'colaboradores' | 'lancamentos' | 'insalubridade' | 'dispensas' | 'contracheques' | 'clearing' | 'completed';
  message: string;
  processed: number;
  total: number;
  percent: number;
}

export interface SeedResult {
  success: boolean;
  canteirosCount: number;
  employeesCount: number;
  recordsCount: number;
  insalubrityCount: number;
  dispensasCount: number;
  paystubsCount: number;
  message: string;
}

export interface ClearResult {
  success: boolean;
  deletedCollections: string[];
  totalDocsDeleted: number;
  message: string;
}

// -------------------------------------------------------------
// DADOS OFICIAIS DE TREINAMENTO E DEMONSTRAÇÃO REALISTA
// -------------------------------------------------------------

export const TRAINING_CANTEIROS: ConstructionSite[] = [
  {
    id: 'canteiro-ko-dl',
    codigo: 'KO-DL',
    nome: 'Destacamento e Pista de Coari',
    sede: 'KO',
    chefeCanteiro: 'Maj. Av. Silva Rocha',
    chefeDa: 'Cap. Int. Souza',
    gerente: 'Eng. Carlos Silveira',
    auxDa: 'Sgt. Oliveira',
    status: 'ACTIVE',
    grauInsalubridade: '20%',
    dataInicio: '2024-01-15',
    dataPrevisaoFim: '2027-12-31',
    observacoes: 'Obras de ampliação e recapeamento da pista tática de Coari.',
    criadoEm: '2024-01-15T08:00:00Z',
    atualizadoEm: '2026-08-01T10:00:00Z',
  },
  {
    id: 'canteiro-be-01',
    codigo: 'BE-01',
    nome: 'Base Aérea de Belém / Hangar COMARA',
    sede: 'BE',
    chefeCanteiro: 'Ten. Cel. Av. Moreira',
    chefeDa: 'Cap. Int. Vasconcelos',
    gerente: 'Eng. Patrícia Lima',
    status: 'ACTIVE',
    grauInsalubridade: '20%',
    dataInicio: '2023-05-01',
    dataPrevisaoFim: '2028-12-31',
    observacoes: 'Sede logística e parque de manutenção de equipamentos pesados.',
    criadoEm: '2023-05-01T08:00:00Z',
    atualizadoEm: '2026-08-01T10:00:00Z',
  },
  {
    id: 'canteiro-mn-02',
    codigo: 'MN-02',
    nome: 'Destacamento de Apoio Logístico de Manaus',
    sede: 'MN',
    chefeCanteiro: 'Cap. Eng. Fernando Castro',
    chefeDa: '1º Ten. Int. Ribeiro',
    gerente: 'Sup. Rodrigo Dias',
    status: 'ACTIVE',
    grauInsalubridade: '10%',
    dataInicio: '2023-08-10',
    dataPrevisaoFim: '2027-06-30',
    observacoes: 'Centro de suprimentos e transporte fluvial/aéreo para canteiros avançados.',
    criadoEm: '2023-08-10T08:00:00Z',
    atualizadoEm: '2026-08-01T10:00:00Z',
  },
  {
    id: 'canteiro-ia-01',
    codigo: 'IA-01',
    nome: 'Destacamento de Pista de Iauaretê (Fronteira)',
    sede: 'KO',
    chefeCanteiro: '1º Ten. Eng. Lucas Prado',
    chefeDa: 'Sgt. Mendes',
    gerente: 'Eng. Marcos Tavares',
    status: 'ACTIVE',
    grauInsalubridade: '40%',
    dataInicio: '2025-02-01',
    dataPrevisaoFim: '2026-11-30',
    observacoes: 'Canteiro de selva em área de fronteira (regime especial de insalubridade e confinamento).',
    criadoEm: '2025-02-01T08:00:00Z',
    atualizadoEm: '2026-08-01T10:00:00Z',
  },
  {
    id: 'canteiro-sg-01',
    codigo: 'SG-01',
    nome: 'Pista e Canteiro de São Gabriel da Cachoeira',
    sede: 'MN',
    chefeCanteiro: 'Cap. Av. Rafael Moura',
    chefeDa: 'Ten. Int. Carvalho',
    gerente: 'Enc. André Cavalcante',
    status: 'ACTIVE',
    grauInsalubridade: '20%',
    dataInicio: '2024-06-01',
    dataPrevisaoFim: '2027-04-30',
    observacoes: 'Modernização da infraestrutura aeroportuária da Cabeça do Cachorro.',
    criadoEm: '2024-06-01T08:00:00Z',
    atualizadoEm: '2026-08-01T10:00:00Z',
  },
];

export const TRAINING_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1010',
    matricula: 'MAT-1010',
    nome: 'Carlos Eduardo Silveira',
    funcao: 'Engenheiro de Operações',
    sede: 'KO',
    sede_origem: 'KO',
    sede_atual: 'KO',
    dataAdmissao: '2022-03-15',
    status: 'Ativo',
    email: 'carlos.silveira@comara.mil.br',
    telefone: '(97) 98412-3301',
    saldoInicialHoras: 12.5,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  {
    id: 'emp-1020',
    matricula: 'MAT-1020',
    nome: 'Juliana Beatriz Mendes',
    funcao: 'Técnica em Eletromecânica',
    sede: 'BE',
    sede_origem: 'BE',
    sede_atual: 'KO',
    dataInicioAlocacao: '2026-02-01',
    dataFimAlocacao: '2026-10-31',
    dataAdmissao: '2021-08-10',
    status: 'Ativo',
    email: 'juliana.mendes@comara.mil.br',
    telefone: '(91) 99123-4567',
    saldoInicialHoras: 4.0,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
  {
    id: 'emp-1030',
    matricula: 'MAT-1030',
    nome: 'Rodrigo Albuquerque Dias',
    funcao: 'Supervisor de Logística',
    sede: 'MN',
    sede_origem: 'MN',
    sede_atual: 'MN',
    dataAdmissao: '2020-01-20',
    status: 'Férias',
    dataInicioStatus: '2026-08-15',
    dataFimStatus: '2026-09-14',
    motivoStatus: 'Férias Regulamentares 30 dias',
    email: 'rodrigo.dias@comara.mil.br',
    telefone: '(92) 98112-9988',
    saldoInicialHoras: -6.5,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    id: 'emp-1040',
    matricula: 'MAT-1040',
    nome: 'Fernanda Martins Costa',
    funcao: 'Analista de Planejamento',
    sede: 'KO',
    sede_origem: 'KO',
    sede_atual: 'KO',
    dataAdmissao: '2023-05-02',
    status: 'Ativo',
    email: 'fernanda.costa@comara.mil.br',
    telefone: '(97) 98105-7744',
    saldoInicialHoras: 18.0,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
  {
    id: 'emp-1050',
    matricula: 'MAT-1050',
    nome: 'Lucas Vinicius Pinheiro',
    funcao: 'Operador de Estação',
    sede: 'BE',
    sede_origem: 'BE',
    sede_atual: 'BE',
    dataAdmissao: '2023-11-14',
    status: 'Afastado',
    dataInicioStatus: '2026-08-01',
    dataFimStatus: '2026-09-30',
    motivoStatus: 'Licença Médica Homologada SESMT',
    email: 'lucas.pinheiro@comara.mil.br',
    telefone: '(91) 98455-1234',
    saldoInicialHoras: -16.0,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  {
    id: 'emp-1060',
    matricula: 'MAT-1060',
    nome: 'Mariana Azevedo Ramos',
    funcao: 'Assistente Administrativo',
    sede: 'MN',
    sede_origem: 'MN',
    sede_atual: 'MN',
    dataAdmissao: '2024-02-01',
    status: 'Ativo',
    email: 'mariana.ramos@comara.mil.br',
    telefone: '(92) 99344-7711',
    saldoInicialHoras: 0.0,
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  },
  {
    id: 'emp-1070',
    matricula: 'MAT-1070',
    nome: 'Gabriel Santos Nogueira',
    funcao: 'Mecânico Industrial',
    sede: 'KO',
    sede_origem: 'KO',
    sede_atual: 'KO',
    dataAdmissao: '2022-09-18',
    status: 'Ativo',
    email: 'gabriel.nogueira@comara.mil.br',
    telefone: '(97) 98822-1133',
    saldoInicialHoras: 8.5,
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
  },
  {
    id: 'emp-1080',
    matricula: 'MAT-1080',
    nome: 'Patrícia Rocha Lima',
    funcao: 'Inspetora de Qualidade',
    sede: 'BE',
    sede_origem: 'BE',
    sede_atual: 'BE',
    dataAdmissao: '2021-04-05',
    status: 'Ativo',
    email: 'patricia.lima@comara.mil.br',
    telefone: '(91) 98177-3322',
    saldoInicialHoras: 22.0,
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
  },
  {
    id: 'emp-1090',
    matricula: 'MAT-1090',
    nome: 'Marcos Vinicius Tavares',
    funcao: 'Topógrafo de Campo',
    sede: 'KO',
    sede_origem: 'KO',
    sede_atual: 'KO',
    dataAdmissao: '2022-06-10',
    status: 'Ativo',
    email: 'marcos.tavares@comara.mil.br',
    telefone: '(97) 98401-2299',
    saldoInicialHoras: 14.0,
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
  },
  {
    id: 'emp-1100',
    matricula: 'MAT-1100',
    nome: 'André Luiz Cavalcante',
    funcao: 'Encarregado de Pavimentação',
    sede: 'MN',
    sede_origem: 'MN',
    sede_atual: 'MN',
    dataAdmissao: '2020-10-01',
    status: 'Ativo',
    email: 'andre.cavalcante@comara.mil.br',
    telefone: '(92) 98200-5544',
    saldoInicialHoras: 30.5,
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    url_foto_perfil: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
];

export const TRAINING_TIME_RECORDS: TimeRecord[] = [
  {
    id: 'rec-001',
    matricula: 'MAT-1010',
    employeeName: 'Carlos Eduardo Silveira',
    employeeSede: 'KO',
    employeeFuncao: 'Engenheiro de Operações',
    dataRegistro: '2026-08-03',
    tipoOcorrencia: 'TRABALHO',
    codigoOcorrencia: 'TRAB',
    horasBrutas: 2.0,
    multiplicador: 1.0,
    saldoCalculado: 2.0,
    eFeriado: false,
    diaSemana: 1,
    diaSemanaNome: 'Segunda-feira',
    observacao: 'Hora extra técnica para supervisão na partida do gerador 02',
    criadoEm: '2026-08-03T18:30:00Z',
  },
  {
    id: 'rec-002',
    matricula: 'MAT-1010',
    employeeName: 'Carlos Eduardo Silveira',
    employeeSede: 'KO',
    employeeFuncao: 'Engenheiro de Operações',
    dataRegistro: '2026-08-08',
    tipoOcorrencia: 'TRABALHO',
    codigoOcorrencia: 'TRAB',
    horasBrutas: 4.0,
    multiplicador: 1.5,
    saldoCalculado: 6.0,
    eFeriado: false,
    diaSemana: 6,
    diaSemanaNome: 'Sábado',
    observacao: 'Plantão emergencial de fim de semana na pista (Adicional 50%)',
    criadoEm: '2026-08-08T14:00:00Z',
  },
  {
    id: 'rec-003',
    matricula: 'MAT-1020',
    employeeName: 'Juliana Beatriz Mendes',
    employeeSede: 'BE',
    employeeFuncao: 'Técnica em Eletromecânica',
    dataRegistro: '2026-08-09',
    tipoOcorrencia: 'TRABALHO',
    codigoOcorrencia: 'TRAB',
    horasBrutas: 5.0,
    multiplicador: 2.0,
    saldoCalculado: 10.0,
    eFeriado: false,
    diaSemana: 0,
    diaSemanaNome: 'Domingo',
    observacao: 'Parada programada de manutenção da usina elétrica (Horas 100%)',
    criadoEm: '2026-08-09T17:15:00Z',
  },
  {
    id: 'rec-004',
    matricula: 'MAT-1030',
    employeeName: 'Rodrigo Albuquerque Dias',
    employeeSede: 'MN',
    employeeFuncao: 'Supervisor de Logística',
    dataRegistro: '2026-08-04',
    tipoOcorrencia: 'FALTA_INJUSTIFICADA',
    codigoOcorrencia: 'F',
    horasBrutas: 8.0,
    multiplicador: 0.0,
    saldoCalculado: -8.0,
    eFeriado: false,
    diaSemana: 2,
    diaSemanaNome: 'Terça-feira',
    observacao: 'Ausência sem justificativa prévia - desconto de jornada diária',
    criadoEm: '2026-08-04T19:00:00Z',
  },
  {
    id: 'rec-005',
    matricula: 'MAT-1040',
    employeeName: 'Fernanda Martins Costa',
    employeeSede: 'KO',
    employeeFuncao: 'Analista de Planejamento',
    dataRegistro: '2026-08-05',
    tipoOcorrencia: 'ATESTADO_MEDICO',
    codigoOcorrencia: 'AT',
    horasBrutas: 8.0,
    multiplicador: 0.0,
    saldoCalculado: 0.0,
    eFeriado: false,
    diaSemana: 3,
    diaSemanaNome: 'Quarta-feira',
    observacao: 'Atestado médico CID J06 homologado pelo serviço de saúde COMARA',
    criadoEm: '2026-08-05T09:35:00Z',
  },
  {
    id: 'rec-006',
    matricula: 'MAT-1050',
    employeeName: 'Lucas Vinicius Pinheiro',
    employeeSede: 'BE',
    employeeFuncao: 'Operador de Estação',
    dataRegistro: '2026-08-07',
    tipoOcorrencia: 'FALTA_INJUSTIFICADA',
    codigoOcorrencia: 'D',
    horasBrutas: 8.0,
    multiplicador: 0.0,
    saldoCalculado: -8.0,
    eFeriado: false,
    diaSemana: 5,
    diaSemanaNome: 'Sexta-feira',
    observacao: 'Falta sem comprovação - aplicada dedução de -8h no banco de horas',
    criadoEm: '2026-08-07T18:00:00Z',
  },
  {
    id: 'rec-007',
    matricula: 'MAT-1070',
    employeeName: 'Gabriel Santos Nogueira',
    employeeSede: 'KO',
    employeeFuncao: 'Mecânico Industrial',
    dataRegistro: '2026-08-02',
    tipoOcorrencia: 'TRABALHO',
    codigoOcorrencia: 'TRAB',
    horasBrutas: 6.0,
    multiplicador: 2.0,
    saldoCalculado: 12.0,
    eFeriado: true,
    nomeFeriado: 'Aniversário de Coari',
    diaSemana: 0,
    diaSemanaNome: 'Domingo',
    observacao: 'Feriado Municipal de Coari - manutenção corretiva em esteira de britagem',
    criadoEm: '2026-08-02T16:45:00Z',
  },
  {
    id: 'rec-008',
    matricula: 'MAT-1080',
    employeeName: 'Patrícia Rocha Lima',
    employeeSede: 'BE',
    employeeFuncao: 'Inspetora de Qualidade',
    dataRegistro: '2026-08-11',
    tipoOcorrencia: 'COMPENSACAO',
    codigoOcorrencia: 'COMP',
    horasBrutas: 4.0,
    multiplicador: 1.0,
    saldoCalculado: -4.0,
    eFeriado: false,
    diaSemana: 2,
    diaSemanaNome: 'Terça-feira',
    observacao: 'Compensação parcial de banco de horas autorizada pela chefia de canteiro',
    criadoEm: '2026-08-11T12:00:00Z',
  },
  {
    id: 'rec-009',
    matricula: 'MAT-1090',
    employeeName: 'Marcos Vinicius Tavares',
    employeeSede: 'KO',
    employeeFuncao: 'Topógrafo de Campo',
    dataRegistro: '2026-08-10',
    tipoOcorrencia: 'TRABALHO',
    codigoOcorrencia: 'TRAB',
    horasBrutas: 3.0,
    multiplicador: 1.0,
    saldoCalculado: 3.0,
    eFeriado: false,
    diaSemana: 1,
    diaSemanaNome: 'Segunda-feira',
    observacao: 'Levantamento topográfico na extensão da cabeceira 19',
    criadoEm: '2026-08-10T18:15:00Z',
  },
  {
    id: 'rec-010',
    matricula: 'MAT-1100',
    employeeName: 'André Luiz Cavalcante',
    employeeSede: 'MN',
    employeeFuncao: 'Encarregado de Pavimentação',
    dataRegistro: '2026-08-08',
    tipoOcorrencia: 'TRABALHO',
    codigoOcorrencia: 'TRAB',
    horasBrutas: 6.0,
    multiplicador: 1.5,
    saldoCalculado: 9.0,
    eFeriado: false,
    diaSemana: 6,
    diaSemanaNome: 'Sábado',
    observacao: 'Coordenação da aplicação de camada asfáltica CBUQ no pátio',
    criadoEm: '2026-08-08T16:00:00Z',
  },
];

export const TRAINING_INSALUBRITY_RECORDS: InsalubrityRecord[] = [
  {
    id: 'insalubre-mat-1010-0803',
    matricula: 'MAT-1010',
    nomeColaborador: 'Carlos Eduardo Silveira',
    sede: 'KO',
    funcao: 'Engenheiro de Operações',
    dataEvento: '2026-08-03',
    atividadeDesempenhada: 'INSPEÇÃO TÉCNICA EM GERADORES E CASA DE FORÇA',
    grauExposicao: '20%',
    quantidadeHorasDias: 1,
    unidade: 'DIAS',
    responsavelLancamento: 'Eng. Segurança / RH Sede',
    observacoes: 'Exposição a ruído contínuo e agentes químicos em manutenção.',
    criadoEm: '2026-08-03T19:00:00Z',
  },
  {
    id: 'insalubre-mat-1020-0809',
    matricula: 'MAT-1020',
    nomeColaborador: 'Juliana Beatriz Mendes',
    sede: 'KO',
    funcao: 'Técnica em Eletromecânica',
    dataEvento: '2026-08-09',
    atividadeDesempenhada: 'MANUTENÇÃO ELÉTRICA EM ALTA TENSÃO E PAINÉIS',
    grauExposicao: '20%',
    quantidadeHorasDias: 1,
    unidade: 'DIAS',
    responsavelLancamento: 'Chefe de Canteiro KO',
    observacoes: 'Atuação direta na subestação do canteiro de Coari.',
    criadoEm: '2026-08-09T18:00:00Z',
  },
  {
    id: 'insalubre-mat-1070-0802',
    matricula: 'MAT-1070',
    nomeColaborador: 'Gabriel Santos Nogueira',
    sede: 'KO',
    funcao: 'Mecânico Industrial',
    dataEvento: '2026-08-02',
    atividadeDesempenhada: 'MANUTENÇÃO EM USINA DE ASFALTO E SOLVENTES',
    grauExposicao: '40%',
    quantidadeHorasDias: 1,
    unidade: 'DIAS',
    responsavelLancamento: 'SESMT COMARA',
    observacoes: 'Grau Máximo (40%) devido a contato direto com hidrocarbonetos e calor radiante.',
    criadoEm: '2026-08-02T17:00:00Z',
  },
  {
    id: 'insalubre-mat-1090-0810',
    matricula: 'MAT-1090',
    nomeColaborador: 'Marcos Vinicius Tavares',
    sede: 'KO',
    funcao: 'Topógrafo de Campo',
    dataEvento: '2026-08-10',
    atividadeDesempenhada: 'SERVIÇO DE CAMPO EM AMBIENTE DE SELVA E CALOR',
    grauExposicao: '20%',
    quantidadeHorasDias: 1,
    unidade: 'DIAS',
    responsavelLancamento: 'Encarregado de Topografia',
    observacoes: 'Radiação solar direta e agentes biológicos em área de expansão de pista.',
    criadoEm: '2026-08-10T18:30:00Z',
  },
  {
    id: 'insalubre-mat-1100-0808',
    matricula: 'MAT-1100',
    nomeColaborador: 'André Luiz Cavalcante',
    sede: 'MN',
    funcao: 'Encarregado de Pavimentação',
    dataEvento: '2026-08-08',
    atividadeDesempenhada: 'APLICAÇÃO DE MASSA ASFÁLTICA A QUENTE (CBUQ)',
    grauExposicao: '40%',
    quantidadeHorasDias: 1,
    unidade: 'DIAS',
    responsavelLancamento: 'SESMT / RH Regional Manaus',
    observacoes: 'Grau Máximo (40%) - Exposição contínua a fumaça betuminosa e altas temperaturas.',
    criadoEm: '2026-08-08T17:00:00Z',
  },
];

export const TRAINING_DISPENSAS: DispensaSptfRecord[] = [
  {
    id: 'dispensa-2026-001',
    numeroGuia: 'SPTF-2026/001',
    matricula: 'MAT-1080',
    nome: 'Patrícia Rocha Lima',
    saram: 'MAT-1080',
    secaoCanteiro: 'DECO-BE',
    data: '2026-08-11',
    horarioInicio: '13:00',
    horarioFim: '17:00',
    totalHoras: 4.0,
    motivo: 'COMPENSAÇÃO BANCO DE HORAS AUTORIZADA',
    observacoes: 'Dispensa regular para usufruto de saldo positivo acumulado no período.',
    emitidoPorNome: 'Super Administrador COMARA',
    emitidoPorEmail: 'admin@comara.mil.br',
    emitidoEm: '2026-08-11T11:30:00Z',
    lancamentoId: 'rec-008',
    status: 'EMITIDA',
  },
];

export const TRAINING_PAYSTUBS: PaystubRecord[] = [
  {
    id: 'MAT-1010_072026',
    matricula: 'MAT-1010',
    nome: 'Carlos Eduardo Silveira',
    cargo: 'Engenheiro de Operações',
    sede: 'KO',
    periodo: '01/07/2026 a 31/07/2026',
    mesAno: '07/2026',
    ano: 2026,
    mes: 7,
    cpf: '123.456.789-00',
    banco: '001 - BANCO DO BRASIL',
    agencia: '0123-4',
    conta: '56789-0',
    rubricas: [
      { codigo: '1001', descricao: 'VENCIMENTO BASE / SALÁRIO', tipo: 'PROVENTO', referencia: '30D', provento: 9800.0, desconto: 0 },
      { codigo: '1020', descricao: 'ADICIONAL DE INSALUBRIDADE (20%)', tipo: 'PROVENTO', referencia: '20%', provento: 282.40, desconto: 0 },
      { codigo: '1050', descricao: 'HORAS EXTRAS 50%', tipo: 'PROVENTO', referencia: '12.5H', provento: 835.20, desconto: 0 },
      { codigo: '5001', descricao: 'CONTRIBUIÇÃO PREVIDENCIÁRIA INSS', tipo: 'DESCONTO', referencia: '14%', provento: 0, desconto: 908.85 },
      { codigo: '5010', descricao: 'IMPOSTO DE RENDA RETIDO NA FONTE', tipo: 'DESCONTO', referencia: '27.5%', provento: 0, desconto: 1450.30 },
    ],
    totalProventos: 10917.60,
    totalDescontos: 2359.15,
    valorLiquido: 8558.45,
    salarioBase: 9800.0,
    baseInss: 7786.02,
    baseFgts: 10917.60,
    fgtsMes: 873.40,
    baseIrrf: 8558.45,
    importadoEm: '2026-08-01T10:00:00Z',
    importadoPorEmail: 'admin@comara.mil.br',
    observacoes: 'Folha de Pagamento Regular COMARA - Competência 07/2026',
  },
  {
    id: 'MAT-1080_072026',
    matricula: 'MAT-1080',
    nome: 'Patrícia Rocha Lima',
    cargo: 'Inspetora de Qualidade',
    sede: 'BE',
    periodo: '01/07/2026 a 31/07/2026',
    mesAno: '07/2026',
    ano: 2026,
    mes: 7,
    cpf: '987.654.321-99',
    banco: '104 - CAIXA ECONÔMICA FEDERAL',
    agencia: '0456',
    conta: '12345678-9',
    rubricas: [
      { codigo: '1001', descricao: 'VENCIMENTO BASE / SALÁRIO', tipo: 'PROVENTO', referencia: '30D', provento: 6500.0, desconto: 0 },
      { codigo: '1020', descricao: 'ADICIONAL DE INSALUBRIDADE (20%)', tipo: 'PROVENTO', referencia: '20%', provento: 282.40, desconto: 0 },
      { codigo: '5001', descricao: 'CONTRIBUIÇÃO PREVIDENCIÁRIA INSS', tipo: 'DESCONTO', referencia: '12%', provento: 0, desconto: 620.40 },
      { codigo: '5010', descricao: 'IMPOSTO DE RENDA RETIDO NA FONTE', tipo: 'DESCONTO', referencia: '15%', provento: 0, desconto: 450.20 },
    ],
    totalProventos: 6782.40,
    totalDescontos: 1070.60,
    valorLiquido: 5711.80,
    salarioBase: 6500.0,
    baseInss: 6500.0,
    baseFgts: 6782.40,
    fgtsMes: 542.59,
    baseIrrf: 5711.80,
    importadoEm: '2026-08-01T10:00:00Z',
    importadoPorEmail: 'admin@comara.mil.br',
    observacoes: 'Folha de Pagamento Regular COMARA - Competência 07/2026',
  },
];

// -------------------------------------------------------------
// SERVIÇO PRINCIPAL DE POVOAMENTO E LIMPEZA DA BASE FIRESTORE
// -------------------------------------------------------------

export const seedService = {
  /**
   * Popula o Cloud Firestore e caches com os dados oficiais de treinamento e teste
   */
  async seedTrainingData(
    onProgress?: (info: SeedProgressInfo) => void
  ): Promise<SeedResult> {
    await dbService.ensureAuthenticatedWriteSession();

    try {
      if (onProgress) {
        onProgress({
          phase: 'preparing',
          message: 'Iniciando preparação do ambiente de treinamento...',
          processed: 0,
          total: 100,
          percent: 5,
        });
      }

      // 1. Canteiros de Obras
      if (onProgress) {
        onProgress({
          phase: 'canteiros',
          message: `Gravando ${TRAINING_CANTEIROS.length} canteiros de obras no Firestore...`,
          processed: 10,
          total: 100,
          percent: 15,
        });
      }
      const canteirosBatch = writeBatch(db);
      TRAINING_CANTEIROS.forEach((site) => {
        const ref = doc(db, COLLECTIONS.CANTEIROS, site.id);
        canteirosBatch.set(ref, sanitizeDbData(site), { merge: true });
      });
      await canteirosBatch.commit();

      // 2. Colaboradores
      if (onProgress) {
        onProgress({
          phase: 'colaboradores',
          message: `Gravando ${TRAINING_EMPLOYEES.length} colaboradores oficiais no Firestore...`,
          processed: 30,
          total: 100,
          percent: 35,
        });
      }
      const employeesBatch = writeBatch(db);
      TRAINING_EMPLOYEES.forEach((emp) => {
        const docId = emp.matricula.trim().toUpperCase();
        const ref = doc(db, COLLECTIONS.COLABORADORES, docId);
        employeesBatch.set(ref, sanitizeDbData(emp), { merge: true });
      });
      await employeesBatch.commit();

      // 3. Lançamentos de Horas (TimeRecords)
      if (onProgress) {
        onProgress({
          phase: 'lancamentos',
          message: `Gravando ${TRAINING_TIME_RECORDS.length} lançamentos de horas no Firestore...`,
          processed: 55,
          total: 100,
          percent: 60,
        });
      }
      const recordsBatch = writeBatch(db);
      TRAINING_TIME_RECORDS.forEach((rec) => {
        const ref = doc(db, COLLECTIONS.LANCAMENTOS, rec.id);
        recordsBatch.set(ref, sanitizeDbData(rec), { merge: true });
      });
      await recordsBatch.commit();

      // 4. Registros de Insalubridade
      if (onProgress) {
        onProgress({
          phase: 'insalubridade',
          message: `Gravando ${TRAINING_INSALUBRITY_RECORDS.length} apontamentos de insalubridade...`,
          processed: 75,
          total: 100,
          percent: 75,
        });
      }
      const insalubrityBatch = writeBatch(db);
      TRAINING_INSALUBRITY_RECORDS.forEach((rec) => {
        const ref = doc(db, COLLECTIONS.INSALUBRIDADE, rec.id);
        insalubrityBatch.set(ref, sanitizeDbData(rec), { merge: true });
      });
      await insalubrityBatch.commit();

      // 5. Dispensas de SPTF
      if (onProgress) {
        onProgress({
          phase: 'dispensas',
          message: `Gravando ${TRAINING_DISPENSAS.length} dispensas de SPTF emitidas...`,
          processed: 85,
          total: 100,
          percent: 85,
        });
      }
      const dispensasBatch = writeBatch(db);
      TRAINING_DISPENSAS.forEach((disp) => {
        const ref = doc(db, COLLECTIONS.DISPENSAS_SPTF, disp.id);
        dispensasBatch.set(ref, sanitizeDbData(disp), { merge: true });
      });
      await dispensasBatch.commit();

      // 6. Contracheques
      if (onProgress) {
        onProgress({
          phase: 'contracheques',
          message: `Gravando ${TRAINING_PAYSTUBS.length} contracheques de exemplo...`,
          processed: 95,
          total: 100,
          percent: 95,
        });
      }
      const paystubsBatch = writeBatch(db);
      TRAINING_PAYSTUBS.forEach((p) => {
        const ref = doc(db, COLLECTIONS.CONTRACHEQUES, p.id);
        paystubsBatch.set(ref, sanitizeDbData(p), { merge: true });
      });
      await paystubsBatch.commit();

      // 7. Atualização do cache local
      storageService.saveEmployees(TRAINING_EMPLOYEES);
      storageService.saveTimeRecords(TRAINING_TIME_RECORDS);
      storageService.saveInsalubrityRecords(TRAINING_INSALUBRITY_RECORDS);
      storageService.saveDispensasSptf(TRAINING_DISPENSAS);
      storageService.savePaystubs(TRAINING_PAYSTUBS);
      localCache.clearCache();

      // Registrar auditoria
      await registrarLogAuditoria({
        usuarioId: 'admin@comara.mil.br',
        usuarioNome: 'Super Administrador',
        usuarioPerfil: 'SUPER_ADMIN',
        canteiroId: 'TODOS',
        tipoAcao: 'RESTAURACAO_MOCK_DADOS',
        detalhes: 'Base populada com dados oficiais de treinamento e teste (Modo Treinamento)',
        detalhesJson: {
          canteiros: TRAINING_CANTEIROS.length,
          colaboradores: TRAINING_EMPLOYEES.length,
          lancamentos: TRAINING_TIME_RECORDS.length,
          insalubridade: TRAINING_INSALUBRITY_RECORDS.length,
          dispensas: TRAINING_DISPENSAS.length,
          contracheques: TRAINING_PAYSTUBS.length,
        },
      });

      if (onProgress) {
        onProgress({
          phase: 'completed',
          message: 'Base de dados de treinamento carregada com sucesso!',
          processed: 100,
          total: 100,
          percent: 100,
        });
      }

      return {
        success: true,
        canteirosCount: TRAINING_CANTEIROS.length,
        employeesCount: TRAINING_EMPLOYEES.length,
        recordsCount: TRAINING_TIME_RECORDS.length,
        insalubrityCount: TRAINING_INSALUBRITY_RECORDS.length,
        dispensasCount: TRAINING_DISPENSAS.length,
        paystubsCount: TRAINING_PAYSTUBS.length,
        message: 'Dados de treinamento e demonstração carregados com sucesso no Cloud Firestore.',
      };
    } catch (error: any) {
      logDbError(error, OperationType.WRITE, 'SEED_TRAINING_DATA');
      throw error;
    }
  },

  /**
   * Limpa rigorosamente todas as coleções operacionais do Cloud Firestore
   * PRESERVANDO rigorosamente: admin_users, system_config e institution_settings.
   */
  async clearAllOperationalData(
    onProgress?: (info: { message: string; percent: number }) => void
  ): Promise<ClearResult> {
    await dbService.ensureAuthenticatedWriteSession();

    // Coleções operacionais a serem limpas
    const OPERATIONAL_COLLECTIONS = [
      COLLECTIONS.COLABORADORES,
      COLLECTIONS.COLABORADORES_AUTH,
      COLLECTIONS.LANCAMENTOS,
      COLLECTIONS.INSALUBRIDADE,
      COLLECTIONS.CANTEIROS,
      COLLECTIONS.DISPENSAS_SPTF,
      COLLECTIONS.CONTRACHEQUES,
      COLLECTIONS.RESUMO_MENSAL,
    ];

    let totalDeleted = 0;
    const deletedCollections: string[] = [];

    try {
      const totalSteps = OPERATIONAL_COLLECTIONS.length;
      let currentStep = 0;

      for (const colName of OPERATIONAL_COLLECTIONS) {
        currentStep++;
        if (onProgress) {
          onProgress({
            message: `Limpando coleção operacional: ${colName}...`,
            percent: Math.round((currentStep / totalSteps) * 90),
          });
        }

        let hasMore = true;
        let colDeleted = 0;

        while (hasMore) {
          const snap = await getDocs(query(collection(db, colName), limit(300)));
          if (snap.empty) {
            hasMore = false;
            break;
          }

          const batch = writeBatch(db);
          snap.forEach((docSnap) => {
            batch.delete(docSnap.ref);
            colDeleted++;
          });

          await batch.commit();
          totalDeleted += snap.size;

          if (snap.size < 300) {
            hasMore = false;
          }
        }

        if (colDeleted > 0) {
          deletedCollections.push(colName);
        }
      }

      // Limpar caches locais e estados persistidos
      storageService.clearAllData();
      localCache.clearCache();

      // Registrar auditoria
      await registrarLogAuditoria({
        usuarioId: 'admin@comara.mil.br',
        usuarioNome: 'Super Administrador',
        usuarioPerfil: 'SUPER_ADMIN',
        canteiroId: 'TODOS',
        tipoAcao: 'LIMPEZA_BASE_DADOS',
        detalhes: `Base operacional limpa para produção (${totalDeleted} documentos removidos). Coleções administrativas preservadas.`,
        detalhesJson: {
          totalDeleted,
          deletedCollections,
        },
      });

      if (onProgress) {
        onProgress({
          message: 'Base operacional zerada com sucesso!',
          percent: 100,
        });
      }

      return {
        success: true,
        deletedCollections,
        totalDocsDeleted: totalDeleted,
        message: `Base operacional zerada com sucesso (${totalDeleted} documentos excluídos). Sistema pronto para importação real.`,
      };
    } catch (error: any) {
      logDbError(error, OperationType.DELETE, 'CLEAR_OPERATIONAL_DATA');
      throw error;
    }
  },
};
