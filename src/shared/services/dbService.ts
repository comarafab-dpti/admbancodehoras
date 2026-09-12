import { 
  collection, 
  doc, 
  getDocs, 
  getDocsPage,
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  onSnapshot, 
  query, 
  where,
  orderBy,
  limit,
  Unsubscribe 
} from './db';
import { auth, db, logDbError, handleDbError, OperationType, isPermissionError } from './db';
import { supabase } from './supabase';
import { Employee, TimeRecord, AdminUser, AdminRole, InsalubrityRecord, SystemConfig, ConstructionSite, PaystubRecord, DispensaSptfRecord, AuditLog } from '../types';
import { hashPassword, autoSeedDefaultAdminMaster, authService } from './authService';
import { canteiroService } from './canteiroService';
import { auditService, RegisterAuditParams, registrarLogAuditoria } from './auditService';
import { storageService } from './storageService';
import { maskCPF } from '../utils/lgpdUtils';
import { prepararCamposCanonicosParaFirestore, normalizarCamposCanonicos } from './normalizacaoColaboradorService';
export { registrarLogAuditoria, autoSeedDefaultAdminMaster };

export const COLLECTIONS = {
  COLABORADORES: 'colaboradores',
  LANCAMENTOS: 'lancamentos',
  DISPENSAS_SPTF: 'dispensas_sptf',
  ADMIN_USERS: 'admin_users',
  USUARIOS_SISTEMA: 'usuarios_sistema',
  RESUMO_MENSAL: 'resumo_mensal',
  COMPETENCIAS_CONTROLE: 'competencias_controle',
  COLABORADORES_AUTH: 'colaboradores_auth',
  SYSTEM_LOGS: 'system_logs',
  LOGS_AUDITORIA: 'logs_auditoria',
  INSALUBRIDADE: 'insalubridade_records',
  SYSTEM_CONFIG: 'system_config',
  CANTEIROS: 'canteiros_obras',
  CONTRACHEQUES: 'contracheques',
};

export interface BatchProgressInfo {
  processed: number;
  total: number;
  percent: number;
  chunkIndex: number;
  totalChunks: number;
}

// Sanitizador universal para remover qualquer chave undefined antes de enviar ao Firestore
export function sanitizeDbData<T extends Record<string, any>>(data: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

/** Converte um documento Firestore e garante campos canônicos normalizados em leitura. */
export function mapEmployeeDocument(data: Record<string, any>, id: string): Employee {
  return normalizarCamposCanonicos({
    ...data,
    id,
    matricula: data.matricula || id,
    nome: data.nome || '',
    funcao: data.funcao || data.cargo || 'Técnico de Manutenção',
    cargo: data.cargo || data.funcao,
    sede: data.sede as Employee['sede'],
    sede_origem: data.sede_origem,
    sede_atual: data.sede_atual,
    sedeCodigo: data.sedeCodigo,
    lotacaoUoCodigo: data.lotacaoUoCodigo,
    uoExecucaoCodigo: data.uoExecucaoCodigo,
    canteiroExecucaoId: data.canteiroExecucaoId,
    departamentoOriginal: data.departamentoOriginal,
    dataAdmissao: data.dataAdmissao || '2026-01-01',
    status: data.status || 'Ativo',
  });
}

// Higienizador robusto para Colaboradores. Campos legados só são mantidos quando informados.
export function prepareEmployeeForDb(emp: Partial<Employee>): Record<string, any> {
  const cleanMatricula = (emp.matricula || emp.id || '').trim().toUpperCase();
  const hasSenhaInicial = Boolean(emp.senhaInicial && emp.senhaInicial.trim().length >= 4);
  const rawPrimeiroAcesso = hasSenhaInicial ? false : emp.primeiroAcesso;
  const rawSenhaCadastrada = hasSenhaInicial ? true : emp.senhaCadastrada;

  return sanitizeDbData({
    id: cleanMatricula || emp.id || `emp-${Date.now()}`,
    matricula: cleanMatricula,
    nome: (emp.nome || '').trim(),
    funcao: emp.funcao || emp.cargo || 'Técnico de Manutenção',
    cargo: emp.cargo || emp.funcao || 'Técnico de Manutenção',
    sede: emp.sede,
    sede_origem: emp.sede_origem,
    sede_atual: emp.sede_atual,
    ...prepararCamposCanonicosParaFirestore(emp),
    lotacao: emp.lotacao,
    secaoLotacao: emp.secaoLotacao,
    uoExecucao: emp.uoExecucao,
    departamento: emp.departamento,
    canteiroId: emp.canteiroId,
    cpf: emp.cpf || '',
    cpfHash: emp.cpfHash || '',
    cpfMascarado: emp.cpfMascarado || (emp.cpf ? maskCPF(emp.cpf) : ''),
    dataAdmissao: emp.dataAdmissao || '2026-01-01',
    status: emp.status || 'Ativo',
    grauInsalubridadeFixa: emp.grauInsalubridadeFixa || 'ISENTO',
    saldoInicialHoras: typeof emp.saldoInicialHoras === 'number' && !isNaN(emp.saldoInicialHoras) ? emp.saldoInicialHoras : 0,
    primeiroAcesso: typeof rawPrimeiroAcesso === 'boolean' ? rawPrimeiroAcesso : true,
    senhaCadastrada: typeof rawSenhaCadastrada === 'boolean' ? rawSenhaCadastrada : false,
    telefone: emp.telefone || '',
    email: emp.email || '',
    horarioTrabalho: emp.horarioTrabalho || '',
    url_foto_perfil: emp.url_foto_perfil || emp.avatarUrl || '',
    avatarUrl: emp.avatarUrl || emp.url_foto_perfil || '',
    id_drive_foto: emp.id_drive_foto || '',
    dataInicioAlocacao: emp.dataInicioAlocacao || '',
    dataFimAlocacao: emp.dataFimAlocacao || '',
    dataInicioStatus: emp.dataInicioStatus || '',
    dataFimStatus: emp.dataFimStatus || '',
    motivoStatus: emp.motivoStatus || '',
    data_inicio_status: emp.data_inicio_status || emp.dataInicioStatus || '',
    data_fim_status: emp.data_fim_status || emp.dataFimStatus || '',
    observacao_status: emp.observacao_status || emp.motivoStatus || '',
    celular: emp.celular || '',
    dataNascimento: emp.dataNascimento || '',
    dataDemissao: emp.dataDemissao || '',
    pis: emp.pis || '',
    codigoExterno: emp.codigoExterno || '',
    atualizadoEm: new Date().toISOString(),
  });
}

// Higienizador robusto com valores padrão garantidos para Contracheques Digitais
export function preparePaystubForDb(p: Partial<PaystubRecord>): Record<string, any> {
  const cleanMatricula = (p.matricula || '').trim().toUpperCase();
  const cleanMesAno = (p.mesAno || `${String(p.mes || '01').padStart(2, '0')}-${p.ano || '2026'}`).trim();
  const docId = p.id || `${cleanMatricula}_${cleanMesAno}`;
  const parsedAno = typeof p.ano === 'number' ? p.ano : parseInt(cleanMesAno.split('-')[1] || '2026', 10);
  const parsedMes = typeof p.mes === 'number' ? p.mes : parseInt(cleanMesAno.split('-')[0] || '1', 10);
  const competencia = `${parsedAno}-${String(parsedMes).padStart(2, '0')}`;

  return sanitizeDbData({
    id: docId,
    matricula: cleanMatricula,
    nome: (p.nome || '').trim(),
    cargo: (p.cargo || '').trim(),
    sede: (p.sede || 'KO-DL').trim(),
    competencia,
    periodo: p.periodo || `${cleanMesAno.replace('-', '/')}`,
    mesAno: cleanMesAno,
    ano: parsedAno,
    mes: parsedMes,
    dataInicio: p.dataInicio || '',
    dataFim: p.dataFim || '',
    cpf: p.cpf || '',
    banco: p.banco || '',
    agencia: p.agencia || '',
    conta: p.conta || '',
    rubricas: Array.isArray(p.rubricas) ? p.rubricas.map(r => ({
      codigo: String(r.codigo || ''),
      descricao: String(r.descricao || ''),
      referencia: r.referencia || '',
      provento: Number(r.provento || 0),
      desconto: Number(r.desconto || 0),
      tipo: r.tipo || (Number(r.desconto || 0) > 0 ? 'DESCONTO' : 'PROVENTO')
    })) : [],
    totalProventos: Number(p.totalProventos || 0),
    totalDescontos: Number(p.totalDescontos || 0),
    valorLiquido: Number(p.valorLiquido || 0),
    salarioBase: p.salarioBase !== undefined ? Number(p.salarioBase) : undefined,
    baseInss: p.baseInss !== undefined ? Number(p.baseInss) : undefined,
    baseFgts: p.baseFgts !== undefined ? Number(p.baseFgts) : undefined,
    fgtsMes: p.fgtsMes !== undefined ? Number(p.fgtsMes) : undefined,
    baseIrrf: p.baseIrrf !== undefined ? Number(p.baseIrrf) : undefined,
    importadoEm: p.importadoEm || new Date().toISOString(),
    importadoPorEmail: p.importadoPorEmail || '',
    observacoes: p.observacoes || ''
  });
}

// Higienizador robusto com valores padrão garantidos para Guias de Dispensa de SPTF
export function prepareDispensaSptfForDb(d: Partial<DispensaSptfRecord>): Record<string, any> {
  const docId = d.id || `dispensa_${Date.now()}_${d.matricula || 'MAT'}`;
  const now = new Date();
  const ano = now.getFullYear();
  const randomSeq = Math.floor(1000 + Math.random() * 9000);
  const numeroGuia = d.numeroGuia || `SPTF-${ano}/${randomSeq}`;
  const dataFinal = d.data || now.toISOString().split('T')[0];

  return sanitizeDbData({
    id: docId,
    numeroGuia: numeroGuia,
    matricula: (d.matricula || '').trim().toUpperCase(),
    nome: (d.nome || '').trim(),
    saram: (d.saram || d.matricula || '').trim().toUpperCase(),
    secaoCanteiro: (d.secaoCanteiro || 'DECO-KO').trim(),
    employeeSede: (d.employeeSede || '').trim().toUpperCase(),
    competencia: dataFinal.slice(0, 7),
    data: dataFinal,
    horarioInicio: d.horarioInicio || '13:00',
    horarioFim: d.horarioFim || '16:00',
    totalHoras: Number(d.totalHoras || 0),
    motivo: (d.motivo || 'COMPENSAÇÃO BANCO DE HORAS').trim(),
    observacoes: d.observacoes || '',
    emitidoPorNome: d.emitidoPorNome || '',
    emitidoPorEmail: d.emitidoPorEmail || '',
    emitidoEm: d.emitidoEm || now.toISOString(),
    lancamentoId: d.lancamentoId || '',
    status: d.status || 'EMITIDA',
  });
}

export const dbService = {
  async getCollectionPage(
    collectionName: string,
    page = 1,
    pageSize = 50,
    constraints: any[] = [],
  ) {
    return getDocsPage(query(collection(db, collectionName), ...constraints), page, pageSize);
  },
  async ensureAuthenticatedWriteSession(): Promise<void> {
    if (auth.currentUser) return;

    const session = authService.getCurrentSession();
    if (session && session.email) {
      return;
    }

    console.warn('[Firestore] Escrita realizada sem sessão autenticada ativa.');
  },

  // -------------------------------------------------------------
  // REAL-TIME LISTENERS (COM TRATAMENTO DEFENSIVO DE ERROS)
  // -------------------------------------------------------------

  subscribeEmployees(
    onSuccess: (employees: Employee[]) => void,
    onError?: (error: Error) => void,
    canteiroId?: string,
    realtime = true
  ): Unsubscribe {
    const path = COLLECTIONS.COLABORADORES;
    try {
      let q = query(collection(db, path), orderBy('nome', 'asc'), limit(1000));
      if (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') {
        q = query(collection(db, path), where('sedeCodigo', '==', canteiroId), orderBy('nome', 'asc'), limit(1000));
      }
      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: Employee[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              // Filtro defensivo de segurança no cliente
              if (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') {
                const normalizedCanteiro = canteiroId.toUpperCase();
                const match = (data.sedeCodigo || '').toUpperCase() === normalizedCanteiro;
                if (!match) return;
              }

              list.push(mapEmployeeDocument(data, docSnap.id));
            });
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de colaboradores:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logDbError(error, OperationType.LIST, path);
          if (onError) onError(error);
        },
        { realtime }
      );
    } catch (error: any) {
      logDbError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  subscribeTimeRecords(
    onSuccess: (records: TimeRecord[]) => void,
    onError?: (error: Error) => void,
    canteiroId?: string,
    matricula?: string,
    realtime = true
  ): Unsubscribe {
    const path = COLLECTIONS.LANCAMENTOS;
    try {
      const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;
      let q;
      const normalizedMatricula = matricula?.trim().toUpperCase();
      if (normalizedMatricula) {
        q = query(collection(db, path), where('matricula', '==', normalizedMatricula), limit(2000));
      } else if (normalizedCanteiro) {
        q = query(collection(db, path), where('employeeSede', '==', normalizedCanteiro), limit(2000));
      } else {
        // Carrega registros sem restrição artificial de mês único para permitir visualização de meses anteriores (ex: Agosto)
        q = query(collection(db, path), limit(2000));
      }

      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: TimeRecord[] = [];

            snapshot.forEach((docSnap) => {
              const data = docSnap.data();

              // Filtro de canteiro defensivo se restrito
              if (normalizedCanteiro) {
                const recSede = (data.employeeSede || data.sede || data.secaoCanteiro || '').toUpperCase();
                const recCanteiro = (data.canteiroId || '').toUpperCase();
                if (recSede && !recSede.includes(normalizedCanteiro) && recCanteiro !== normalizedCanteiro) {
                  return;
                }
              }

              const rawDate = data.dataRegistro || data.data_ocorrencia || data.data || data.date || (data.criadoEm ? data.criadoEm.split('T')[0] : '');
              const horasBrutas = typeof data.horasBrutas === 'number' ? data.horasBrutas : (Number(data.horasBrutas) || 0);
              const multiplicador = typeof data.multiplicador === 'number' ? data.multiplicador : (Number(data.multiplicador) || 1);
              
              let saldoCalculado = typeof data.saldoCalculado === 'number' ? data.saldoCalculado : (Number(data.saldoCalculado) || 0);
              // Fallback para campos legados se saldoCalculado for 0
              if (saldoCalculado === 0) {
                if (data.tipoOcorrencia === 'TRABALHO' && horasBrutas > 0) {
                  saldoCalculado = horasBrutas * multiplicador;
                } else if (data.tipoOcorrencia === 'COMPENSACAO' || data.tipoOcorrencia === 'DISPENSA_OPERACIONAL') {
                  saldoCalculado = -(horasBrutas > 0 ? horasBrutas : 8.0);
                } else if (Number(data.horasExtras50) > 0 || Number(data.horasExtras100) > 0) {
                  saldoCalculado = (Number(data.horasExtras50) || 0) + (Number(data.horasExtras100) || 0);
                } else if (Number(data.folgasCompensatorias) > 0 || Number(data.horasAtrasoFalta) > 0) {
                  saldoCalculado = -((Number(data.folgasCompensatorias) || 0) + (Number(data.horasAtrasoFalta) || 0));
                }
              }

              list.push({
                id: docSnap.id,
                matricula: (data.matricula || '').toString().trim().toUpperCase(),
                employeeName: data.employeeName || '',
                employeeSede: data.employeeSede || 'KO',
                employeeFuncao: data.employeeFuncao || 'Técnico de Manutenção',
                employeeAvatarUrl: data.employeeAvatarUrl,
                dataRegistro: rawDate,
                data_ocorrencia: data.data_ocorrencia || rawDate,
                tipoOcorrencia: data.tipoOcorrencia || 'TRABALHO',
                horasBrutas,
                multiplicador,
                saldoCalculado,
                saldo_remanescente: typeof data.saldo_remanescente === 'number' ? data.saldo_remanescente : (Number(data.saldo_remanescente) || (saldoCalculado !== 0 ? Math.abs(saldoCalculado) : 0)),
                status_compensacao: data.status_compensacao || 'ABERTO',
                liquidacoes: data.liquidacoes || [],
                eFeriado: Boolean(data.eFeriado),
                nomeFeriado: data.nomeFeriado,
                diaSemana: typeof data.diaSemana === 'number' ? data.diaSemana : 1,
                diaSemanaNome: data.diaSemanaNome || '',
                observacao: data.observacao,
                comprovante: data.comprovante,
                criadoEm: data.criadoEm || '',
                criadoPorEmail: data.criadoPorEmail,
                atualizadoEm: data.atualizadoEm,
                editadoPor: data.editadoPor,
                editadoEm: data.editadoEm,
              });
            });

            // Ordenar decrescente por data de registro
            list.sort((a, b) => (b.dataRegistro || '').localeCompare(a.dataRegistro || ''));
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de lançamentos:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logDbError(error, OperationType.LIST, path);
          if (onError) onError(error);
        },
        { realtime }
      );
    } catch (error: any) {
      logDbError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  async getTimeRecordsByMonth(anoMes: string, canteiroId?: string): Promise<TimeRecord[]> {
    const path = COLLECTIONS.LANCAMENTOS;
    const [yearStr, monthStr] = (anoMes || '').split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;

    try {
      const q = query(
        collection(db, path),
        where('dataRegistro', '>=', startDate),
        where('dataRegistro', '<=', endDate),
        limit(1000)
      );

      const snapshot = await getDocs(q);
      const list: TimeRecord[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (normalizedCanteiro) {
          const recSede = (data.employeeSede || data.sede || data.secaoCanteiro || '').toUpperCase();
          const recCanteiro = (data.canteiroId || '').toUpperCase();
          if (recSede && !recSede.includes(normalizedCanteiro) && recCanteiro !== normalizedCanteiro) {
            return;
          }
        }

        const rawDate = data.dataRegistro || data.data_ocorrencia || data.data || data.date || (data.criadoEm ? data.criadoEm.split('T')[0] : '');
        const horasBrutas = typeof data.horasBrutas === 'number' ? data.horasBrutas : (Number(data.horasBrutas) || 0);
        const multiplicador = typeof data.multiplicador === 'number' ? data.multiplicador : (Number(data.multiplicador) || 1);
        let saldoCalculado = typeof data.saldoCalculado === 'number' ? data.saldoCalculado : (Number(data.saldoCalculado) || 0);

        if (saldoCalculado === 0) {
          if (data.tipoOcorrencia === 'TRABALHO' && horasBrutas > 0) {
            saldoCalculado = horasBrutas * multiplicador;
          } else if (data.tipoOcorrencia === 'COMPENSACAO' || data.tipoOcorrencia === 'DISPENSA_OPERACIONAL') {
            saldoCalculado = -(horasBrutas > 0 ? horasBrutas : 8.0);
          } else if (Number(data.horasExtras50) > 0 || Number(data.horasExtras100) > 0) {
            saldoCalculado = (Number(data.horasExtras50) || 0) + (Number(data.horasExtras100) || 0);
          } else if (Number(data.folgasCompensatorias) > 0 || Number(data.horasAtrasoFalta) > 0) {
            saldoCalculado = -((Number(data.folgasCompensatorias) || 0) + (Number(data.horasAtrasoFalta) || 0));
          }
        }

        list.push({
          id: docSnap.id,
          matricula: (data.matricula || '').toString().trim().toUpperCase(),
          employeeName: data.employeeName || '',
          employeeSede: data.employeeSede || 'KO',
          employeeFuncao: data.employeeFuncao || 'Técnico de Manutenção',
          employeeAvatarUrl: data.employeeAvatarUrl,
          dataRegistro: rawDate,
          data_ocorrencia: data.data_ocorrencia || rawDate,
          tipoOcorrencia: data.tipoOcorrencia || 'TRABALHO',
          horasBrutas,
          multiplicador,
          saldoCalculado,
          horasDescontoFolha: typeof data.horasDescontoFolha === 'number' ? data.horasDescontoFolha : (data.tipoOcorrencia === 'FALTA_INJUSTIFICADA' ? 8.0 : 0),
          saldo_remanescente: typeof data.saldo_remanescente === 'number' ? data.saldo_remanescente : (Number(data.saldo_remanescente) || (saldoCalculado !== 0 ? Math.abs(saldoCalculado) : 0)),
          status_compensacao: data.status_compensacao || 'ABERTO',
          liquidacoes: data.liquidacoes || [],
          eFeriado: Boolean(data.eFeriado),
          nomeFeriado: data.nomeFeriado,
          diaSemana: typeof data.diaSemana === 'number' ? data.diaSemana : 1,
          diaSemanaNome: data.diaSemanaNome || '',
          observacao: data.observacao,
          comprovante: data.comprovante,
          criadoEm: data.criadoEm || '',
          criadoPorEmail: data.criadoPorEmail,
          atualizadoEm: data.atualizadoEm,
          editadoPor: data.editadoPor,
          editadoEm: data.editadoEm,
        });
      });

      list.sort((a, b) => (b.dataRegistro || '').localeCompare(a.dataRegistro || ''));
      return list;
    } catch (error: any) {
      logDbError(error, OperationType.LIST, path);
      throw error;
    }
  },

  subscribeAdmins(
    onSuccess: (admins: AdminUser[]) => void,
    onError?: (error: Error) => void,
    realtime = true
  ): Unsubscribe {
    const path = COLLECTIONS.ADMIN_USERS;
    try {
      return onSnapshot(
        query(collection(db, path), limit(200)),
        (snapshot) => {
          try {
            const list: AdminUser[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const role = (data.role as AdminRole) || (data.nivelAcesso as AdminRole) || 'GESTOR_RH';
              const status = (data.status as 'pendente' | 'ativo' | 'inativo' | 'bloqueado') || (data.ativo === false ? 'inativo' : 'ativo');
              const perfil = (data.perfil as string) || (data.role as string) || (data.nivelAcesso as string) || 'nenhum';
              list.push({
                id: docSnap.id,
                email: data.email || docSnap.id,
                nome: data.nome || data.email?.split('@')[0] || 'Administrador',
                cargo: data.cargo || data.funcao || 'Gestor RH',
                funcao: data.funcao || data.cargo || '',
                saram: data.saram || '',
                nomeGuerra: data.nomeGuerra || '',
                postoGraduacao: data.postoGraduacao || '',
                canteiroSede: data.canteiroSede || data.sede || 'TODAS',
                tituloImpressao: data.tituloImpressao || '',
                nivelAcesso: role,
                role,
                status,
                perfil,
                foto: data.foto || data.photoURL || null,
                sede: data.sede || data.canteiroSede || 'TODAS',
                ativo: data.ativo !== false && status === 'ativo',
                criadoEm: data.criadoEm || new Date().toISOString(),
                atualizadoEm: data.atualizadoEm,
              });
            });
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de administradores:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logDbError(error, OperationType.LIST, path);
          if (onError) onError(error);
        },
        { realtime }
      );
    } catch (error: any) {
      logDbError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  // Sempre busca dados frescos do Firestore (cache local removido por servir dados desatualizados)
  async getAdmins(forceRefresh = false): Promise<AdminUser[]> {
    const path = COLLECTIONS.ADMIN_USERS;
    try {
      const snapshot = await getDocs(query(collection(db, path), limit(200)));
      const list: AdminUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const role = (data.role as AdminRole) || (data.nivelAcesso as AdminRole) || 'GESTOR_RH';
        const status = (data.status as 'pendente' | 'ativo' | 'inativo' | 'bloqueado') || (data.ativo === false ? 'inativo' : 'ativo');
        const perfil = (data.perfil as string) || (data.role as string) || (data.nivelAcesso as string) || 'nenhum';
        list.push({
          id: docSnap.id,
          email: data.email || docSnap.id,
          nome: data.nome || data.email?.split('@')[0] || 'Administrador',
          cargo: data.cargo || data.funcao || 'Gestor RH',
          funcao: data.funcao || data.cargo || '',
          saram: data.saram || '',
          nomeGuerra: data.nomeGuerra || '',
          postoGraduacao: data.postoGraduacao || '',
          canteiroSede: data.canteiroSede || data.sede || 'TODAS',
          tituloImpressao: data.tituloImpressao || '',
          nivelAcesso: role,
          role,
          status,
          perfil,
          foto: data.foto || data.photoURL || null,
          sede: data.sede || data.canteiroSede || 'TODAS',
          ativo: data.ativo !== false && status === 'ativo',
          criadoEm: data.criadoEm || new Date().toISOString(),
          atualizadoEm: data.atualizadoEm,
        });
      });
      return list;
    } catch (error) {
      logDbError(error, OperationType.GET, path);
      return [];
    }
  },

  async getAdminUserById(idOrEmail: string): Promise<AdminUser | null> {
    const cleanId = idOrEmail.trim().toLowerCase();
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanId));
      if (!docSnap.exists()) {
        return null;
      }
      const data = docSnap.data();
      const role = (data.role as AdminRole) || (data.nivelAcesso as AdminRole) || 'GESTOR_RH';
      const status = (data.status as 'pendente' | 'ativo' | 'inativo' | 'bloqueado') || (data.ativo === false ? 'inativo' : 'ativo');
      const perfil = (data.perfil as string) || (data.role as string) || (data.nivelAcesso as string) || 'nenhum';
      return {
        id: docSnap.id,
        email: data.email || docSnap.id,
        nome: data.nome || data.email?.split('@')[0] || 'Administrador',
        cargo: data.cargo || data.funcao || 'Gestor RH',
        funcao: data.funcao || data.cargo || '',
        saram: data.saram || '',
        nomeGuerra: data.nomeGuerra || '',
        postoGraduacao: data.postoGraduacao || '',
        canteiroSede: data.canteiroSede || data.sede || 'TODAS',
        tituloImpressao: data.tituloImpressao || '',
        nivelAcesso: role,
        role,
        status,
        perfil,
        foto: data.foto || data.photoURL || null,
        sede: data.sede || data.canteiroSede || 'TODAS',
        ativo: data.ativo !== false && status === 'ativo',
        criadoEm: data.criadoEm || new Date().toISOString(),
        atualizadoEm: data.atualizadoEm,
      };
    } catch (error) {
      logDbError(error, OperationType.GET, `${COLLECTIONS.ADMIN_USERS}/${cleanId}`);
      return null;
    }
  },

  // -------------------------------------------------------------
  // GET DOCS / POLLED QUERIES
  // -------------------------------------------------------------

  async getAllEmployees(): Promise<Employee[]> {
    return this.getEmployees();
  },

  async getEmployees(): Promise<Employee[]> {
    const path = COLLECTIONS.COLABORADORES;
    try {
      const q = query(collection(db, path), orderBy('nome', 'asc'), limit(500));
      const snapshot = await getDocs(q);
      const list: Employee[] = [];
      snapshot.forEach((docSnap) => {
        list.push(mapEmployeeDocument(docSnap.data(), docSnap.id));
      });
      return list;
    } catch (error) {
      logDbError(error, OperationType.GET, path);
      return [];
    }
  },

  async getEmployeesPage(page = 1, pageSize = 25, canteiroId?: string) {
    const constraints: any[] = [orderBy('nome', 'asc')];
    if (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') {
      constraints.unshift(where('sedeCodigo', '==', canteiroId));
    }
    const result = await this.getCollectionPage(COLLECTIONS.COLABORADORES, page, pageSize, constraints);
    return {
      ...result,
      items: result.snapshot.docs.map((docSnap) => mapEmployeeDocument(docSnap.data(), docSnap.id)),
    };
  },

  async getTimeRecords(): Promise<TimeRecord[]> {
    const path = COLLECTIONS.LANCAMENTOS;
    try {
      const q = query(collection(db, path), orderBy('dataRegistro', 'desc'), limit(500));
      const snapshot = await getDocs(q);
      const list: TimeRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          matricula: data.matricula || '',
          employeeName: data.employeeName || '',
          employeeSede: data.employeeSede || 'KO',
          employeeFuncao: data.employeeFuncao || 'Técnico de Manutenção',
          employeeAvatarUrl: data.employeeAvatarUrl,
          dataRegistro: data.dataRegistro || '',
          data_ocorrencia: data.data_ocorrencia || data.dataRegistro,
          tipoOcorrencia: data.tipoOcorrencia || 'TRABALHO',
          horasBrutas: typeof data.horasBrutas === 'number' ? data.horasBrutas : 0,
          multiplicador: typeof data.multiplicador === 'number' ? data.multiplicador : 1,
          saldoCalculado: typeof data.saldoCalculado === 'number' ? data.saldoCalculado : 0,
          saldo_remanescente: typeof data.saldo_remanescente === 'number' ? data.saldo_remanescente : 0,
          status_compensacao: data.status_compensacao || 'ABERTO',
          liquidacoes: data.liquidacoes || [],
          eFeriado: Boolean(data.eFeriado),
          nomeFeriado: data.nomeFeriado,
          diaSemana: typeof data.diaSemana === 'number' ? data.diaSemana : 1,
          diaSemanaNome: data.diaSemanaNome || '',
          observacao: data.observacao,
          comprovante: data.comprovante,
          criadoEm: data.criadoEm || '',
          criadoPorEmail: data.criadoPorEmail,
        });
      });
      return list;
    } catch (error) {
      logDbError(error, OperationType.GET, path);
      return [];
    }
  },

  // -------------------------------------------------------------
  // CRUD COLABORADORES
  // -------------------------------------------------------------

  async saveEmployee(employee: Employee): Promise<void> {
    const docId = (employee.matricula || employee.id || '').trim().toUpperCase();
    const path = `${COLLECTIONS.COLABORADORES}/${docId}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      const cleanData = prepareEmployeeForDb(employee);
      await setDoc(doc(db, COLLECTIONS.COLABORADORES, docId), cleanData, { merge: true });

      // Se informou senha inicial, cria/atualiza credencial em colaboradores_auth
      if (employee.senhaInicial && employee.senhaInicial.trim().length >= 4) {
        const passwordHash = await hashPassword(employee.senhaInicial.trim());
        const nowIso = new Date().toISOString();
        await setDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, docId), {
          matricula: docId,
          passwordHash,
          senhaDefinida: true,
          email: employee.email || '',
          tokenRecuperacao: null,
          tokenExpiracao: null,
          ultimoAcesso: null,
          atualizadoEm: nowIso,
        }, { merge: true });
      }
    } catch (error) {
      logDbError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deleteEmployee(docId: string): Promise<void> {
    const path = `${COLLECTIONS.COLABORADORES}/${docId}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      await Promise.all([
        deleteDoc(doc(db, COLLECTIONS.COLABORADORES, docId)),
        deleteDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, docId)).catch(() => {}),
      ]);
    } catch (error) {
      logDbError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // CRUD LANÇAMENTOS
  // -------------------------------------------------------------

  async saveTimeRecord(record: TimeRecord, userEmail?: string): Promise<void> {
    const docId = record.id;
    const path = `${COLLECTIONS.LANCAMENTOS}/${docId}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      const cleanData = sanitizeDbData({
        id: record.id,
        matricula: (record.matricula || '').trim().toUpperCase(),
        employeeName: record.employeeName || '',
        employeeSede: record.employeeSede || 'KO',
        employeeFuncao: record.employeeFuncao || 'Técnico de Manutenção',
        employeeAvatarUrl: record.employeeAvatarUrl || '',
        dataRegistro: record.dataRegistro || '',
        competencia: (record.dataRegistro || '').slice(0, 7),
        data_ocorrencia: record.data_ocorrencia || record.dataRegistro || '',
        tipoOcorrencia: record.tipoOcorrencia || 'TRABALHO',
        horasBrutas: Number(record.horasBrutas) || 0,
        multiplicador: Number(record.multiplicador) || 1,
        saldoCalculado: Number(record.saldoCalculado) || 0,
        saldo_remanescente: typeof record.saldo_remanescente === 'number' ? record.saldo_remanescente : (record.saldoCalculado !== 0 ? Math.abs(record.saldoCalculado) : 0),
        status_compensacao: record.status_compensacao || (record.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO'),
        liquidacoes: record.liquidacoes || [],
        eFeriado: Boolean(record.eFeriado),
        nomeFeriado: record.nomeFeriado || '',
        diaSemana: Number(record.diaSemana) || 1,
        diaSemanaNome: record.diaSemanaNome || '',
        observacao: record.observacao || '',
        comprovante: record.comprovante || '',
        criadoEm: record.criadoEm || new Date().toISOString(),
        criadoPorEmail: userEmail || record.criadoPorEmail || '',
        atualizadoEm: record.atualizadoEm || '',
        editadoPor: record.editadoPor || userEmail || '',
        editadoEm: record.editadoEm || '',
      });

      await setDoc(doc(db, COLLECTIONS.LANCAMENTOS, docId), cleanData, { merge: true });
    } catch (error) {
      logDbError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deleteTimeRecord(docId: string): Promise<void> {
    const path = `${COLLECTIONS.LANCAMENTOS}/${docId}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      await deleteDoc(doc(db, COLLECTIONS.LANCAMENTOS, docId));
    } catch (error) {
      logDbError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // BATCH BULK IMPORTS COM PROCESSAMENTO EM LOTES (CHUNKS)
  // Suporte a arquivos grandes (4.500+ registros) em pacotes de 400
  // -------------------------------------------------------------

  async importEmployeesBatch(
    employees: Employee[],
    onProgress?: (progress: BatchProgressInfo) => void
  ): Promise<{ count: number; total: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;
    const CHUNK_SIZE = 250; // Limite de segurança considerando múltiplos docs por colaborador
    const total = employees.length;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    try {
      await this.ensureAuthenticatedWriteSession();
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = employees.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const batch = writeBatch(db);
        const nowIso = new Date().toISOString();

        for (const emp of chunk) {
          const docId = (emp.matricula || emp.id || '').trim().toUpperCase();
          const ref = doc(db, COLLECTIONS.COLABORADORES, docId);
          const cleanEmp = prepareEmployeeForDb(emp);
          batch.set(ref, cleanEmp, { merge: true });

          // Se a linha do CSV veio com senha inicial definida
          if (emp.senhaInicial && emp.senhaInicial.trim().length >= 4) {
            const passwordHash = await hashPassword(emp.senhaInicial.trim());
            const authRef = doc(db, COLLECTIONS.COLABORADORES_AUTH, docId);
            batch.set(authRef, {
              matricula: docId,
              passwordHash,
              senhaDefinida: true,
              email: emp.email || '',
              tokenRecuperacao: null,
              tokenExpiracao: null,
              ultimoAcesso: null,
              atualizadoEm: nowIso,
            }, { merge: true });
          }
        }

        try {
          await batch.commit();
          count += chunk.length;
        } catch (batchErr: any) {
          logDbError(batchErr, OperationType.WRITE, COLLECTIONS.COLABORADORES);
          errors.push(`Erro no lote ${chunkIndex}/${totalChunks}: ${batchErr?.message || 'Falha na gravação'}`);
        }

        if (onProgress) {
          onProgress({
            processed: count,
            total,
            percent: Math.min(100, Math.round((count / total) * 100)),
            chunkIndex,
            totalChunks,
          });
        }
      }
      return { count, total, errors };
    } catch (error: any) {
      logDbError(error, OperationType.WRITE, COLLECTIONS.COLABORADORES);
      errors.push(error?.message || 'Erro fatal no processamento em lotes');
      return { count, total, errors };
    }
  },

  async importTimeRecordsBatch(
    records: TimeRecord[],
    onProgress?: (progress: BatchProgressInfo) => void
  ): Promise<{ count: number; total: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;
    const CHUNK_SIZE = 400; // Limite de segurança Firestore (max 500)
    const total = records.length;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    try {
      await this.ensureAuthenticatedWriteSession();
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const batch = writeBatch(db);

        for (const rec of chunk) {
          const docId = rec.id || `rec-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
          const ref = doc(db, COLLECTIONS.LANCAMENTOS, docId);
          const cleanRec = sanitizeDbData({
            id: docId,
            matricula: rec.matricula.trim().toUpperCase(),
            employeeName: rec.employeeName || '',
            employeeSede: rec.employeeSede || 'KO',
            employeeFuncao: rec.employeeFuncao || 'Técnico de Manutenção',
            employeeAvatarUrl: rec.employeeAvatarUrl || null,
            dataRegistro: rec.dataRegistro || '',
            competencia: (rec.dataRegistro || '').slice(0, 7),
            data_ocorrencia: rec.data_ocorrencia || rec.dataRegistro || '',
            tipoOcorrencia: rec.tipoOcorrencia || 'TRABALHO',
            horasBrutas: Number(rec.horasBrutas) || 0,
            multiplicador: Number(rec.multiplicador) || 1,
            saldoCalculado: Number(rec.saldoCalculado) || 0,
            saldo_remanescente: typeof rec.saldo_remanescente === 'number' ? rec.saldo_remanescente : (rec.saldoCalculado !== 0 ? Math.abs(rec.saldoCalculado) : 0),
            status_compensacao: rec.status_compensacao || (rec.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO'),
            liquidacoes: rec.liquidacoes || [],
            eFeriado: Boolean(rec.eFeriado),
            nomeFeriado: rec.nomeFeriado || null,
            diaSemana: Number(rec.diaSemana) || 1,
            diaSemanaNome: rec.diaSemanaNome || '',
            observacao: rec.observacao || null,
            comprovante: rec.comprovante || null,
            criadoEm: rec.criadoEm || new Date().toISOString(),
          });
          batch.set(ref, cleanRec, { merge: true });
        }

        try {
          await batch.commit();
          count += chunk.length;
        } catch (batchErr: any) {
          logDbError(batchErr, OperationType.WRITE, COLLECTIONS.LANCAMENTOS);
          errors.push(`Erro no lote ${chunkIndex}/${totalChunks}: ${batchErr?.message || 'Falha na gravação do lote'}`);
        }

        if (onProgress) {
          onProgress({
            processed: count,
            total,
            percent: Math.min(100, Math.round((count / total) * 100)),
            chunkIndex,
            totalChunks,
          });
        }
      }
      return { count, total, errors };
    } catch (error: any) {
      logDbError(error, OperationType.WRITE, COLLECTIONS.LANCAMENTOS);
      errors.push(error?.message || 'Erro fatal no processamento em lote');
      return { count, total, errors };
    }
  },

  // -------------------------------------------------------------
  // MÓDULO DE INSALUBRIDADE (PONTUAL E POR ATIVIDADE)
  // OTIMIZADO: Filtragem por período/mês vigente e cache inteligente
  // -------------------------------------------------------------

  subscribeInsalubrityRecords(
    onSuccess: (records: InsalubrityRecord[]) => void,
    onError?: (error: Error) => void,
    optionsOrCanteiro?: string | {
      canteiroId?: string;
      matricula?: string;
      startDate?: string;
      endDate?: string;
    },
    realtime = true
  ): Unsubscribe {
    const path = COLLECTIONS.INSALUBRIDADE;
    try {
      let canteiroId: string | undefined;
      let startDate: string | undefined;
      let endDate: string | undefined;
      let matricula: string | undefined;

      if (typeof optionsOrCanteiro === 'string') {
        canteiroId = optionsOrCanteiro;
      } else if (optionsOrCanteiro) {
        canteiroId = optionsOrCanteiro.canteiroId;
        matricula = optionsOrCanteiro.matricula;
        startDate = optionsOrCanteiro.startDate;
        endDate = optionsOrCanteiro.endDate;
      }

      const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;
      const normalizedMatricula = matricula?.trim().toUpperCase();

      let q;
      if (startDate && endDate) {
        if (normalizedMatricula) {
          q = query(collection(db, path), where('matricula', '==', normalizedMatricula), limit(2000));
        } else if (normalizedCanteiro) {
          q = query(
            collection(db, path),
            where('sede', '==', normalizedCanteiro),
            where('dataEvento', '>=', startDate),
            where('dataEvento', '<=', endDate)
          );
        } else {
          q = query(
            collection(db, path),
            where('dataEvento', '>=', startDate),
            where('dataEvento', '<=', endDate)
          );
        }
      } else {
        // Se nenhum intervalo for informado, carrega registros globais (incluindo meses passados como Agosto)
        if (normalizedCanteiro) {
          q = query(
            collection(db, path),
            where('sede', '==', normalizedCanteiro),
            limit(2000)
          );
        } else {
          q = query(
            collection(db, path),
            limit(2000)
          );
        }
      }

      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: InsalubrityRecord[] = [];

            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const recSede = (data.sede || 'KO').toUpperCase();
              if (normalizedCanteiro && recSede !== normalizedCanteiro) {
                return;
              }

              list.push({
                id: docSnap.id,
                matricula: (data.matricula || '').trim().toUpperCase(),
                nomeColaborador: data.nomeColaborador || '',
                sede: data.sede || 'KO',
                funcao: data.funcao || 'Operacional',
                dataEvento: data.dataEvento || '',
                atividadeDesempenhada: data.atividadeDesempenhada || '',
                grauExposicao: data.grauExposicao || '20%',
                quantidadeHorasDias: typeof data.quantidadeHorasDias === 'number' ? data.quantidadeHorasDias : (Number(data.quantidadeHorasDias) || 1),
                unidade: data.unidade || 'DIAS',
                responsavelLancamento: data.responsavelLancamento || 'RH / Encarregado',
                observacoes: data.observacoes || '',
                criadoEm: data.criadoEm || new Date().toISOString(),
                criadoPorEmail: data.criadoPorEmail,
                atualizadoEm: data.atualizadoEm,
                editadoPor: data.editadoPor,
                editadoEm: data.editadoEm,
              });
            });

            // Ordena os registros do mais recente para o mais antigo
            list.sort((a, b) => (b.dataEvento || '').localeCompare(a.dataEvento || ''));

            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de insalubridade:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logDbError(error, OperationType.LIST, path);
          if (onError) onError(error);
        },
        { realtime }
      );
    } catch (error: any) {
      logDbError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  /**
   * Busca registros de insalubridade por período específico (sempre fresco do Firestore).
   */
  async fetchInsalubrityRecordsByPeriod(params: {
    startDate: string;
    endDate: string;
    canteiroId?: string;
    forceRefresh?: boolean;
  }): Promise<InsalubrityRecord[]> {
    const { startDate, endDate, canteiroId } = params;
    const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;

    // Busca sob demanda estritamente no intervalo de datas solicitado
    const path = COLLECTIONS.INSALUBRIDADE;
    try {
      let q;
      if (normalizedCanteiro) {
        q = query(
          collection(db, path),
          where('sede', '==', normalizedCanteiro),
          where('dataEvento', '>=', startDate),
          where('dataEvento', '<=', endDate)
        );
      } else {
        q = query(
          collection(db, path),
          where('dataEvento', '>=', startDate),
          where('dataEvento', '<=', endDate)
        );
      }

      const snapshot = await getDocs(q);
      const list: InsalubrityRecord[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const recSede = (data.sede || 'KO').toUpperCase();
        if (normalizedCanteiro && recSede !== normalizedCanteiro) return;

        list.push({
          id: docSnap.id,
          matricula: (data.matricula || '').trim().toUpperCase(),
          nomeColaborador: data.nomeColaborador || '',
          sede: data.sede || 'KO',
          funcao: data.funcao || 'Operacional',
          dataEvento: data.dataEvento || '',
          atividadeDesempenhada: data.atividadeDesempenhada || '',
          grauExposicao: data.grauExposicao || '20%',
          quantidadeHorasDias: typeof data.quantidadeHorasDias === 'number' ? data.quantidadeHorasDias : (Number(data.quantidadeHorasDias) || 1),
          unidade: data.unidade || 'DIAS',
          responsavelLancamento: data.responsavelLancamento || 'RH / Encarregado',
          observacoes: data.observacoes || '',
          criadoEm: data.criadoEm || new Date().toISOString(),
          criadoPorEmail: data.criadoPorEmail,
          atualizadoEm: data.atualizadoEm,
          editadoPor: data.editadoPor,
          editadoEm: data.editadoEm,
        });
      });

      return list;
    } catch (error) {
      logDbError(error, OperationType.GET, path);
      return [];
    }
  },

  async saveInsalubrityRecord(record: InsalubrityRecord): Promise<void> {
    const cleanMat = record.matricula.trim().toUpperCase();
    const docId = record.id || `insalubre-${cleanMat}-${record.dataEvento}`;
    const path = `${COLLECTIONS.INSALUBRIDADE}/${docId}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      const dataToSave = sanitizeDbData({
        id: docId,
        matricula: cleanMat,
        nomeColaborador: record.nomeColaborador.trim(),
        sede: record.sede || 'KO',
        competencia: record.dataEvento.slice(0, 7),
        funcao: record.funcao || 'Operacional',
        dataEvento: record.dataEvento,
        atividadeDesempenhada: record.atividadeDesempenhada.trim().toUpperCase(),
        grauExposicao: record.grauExposicao || '20%',
        quantidadeHorasDias: Number(record.quantidadeHorasDias) || 1,
        unidade: record.unidade || 'DIAS',
        responsavelLancamento: record.responsavelLancamento || 'Encarregado / RH',
        observacoes: record.observacoes?.trim() || '',
        criadoEm: record.criadoEm || new Date().toISOString(),
        criadoPorEmail: record.criadoPorEmail || '',
        atualizadoEm: record.atualizadoEm || '',
        editadoPor: record.editadoPor || '',
        editadoEm: record.editadoEm || '',
      });
      await setDoc(doc(db, COLLECTIONS.INSALUBRIDADE, docId), dataToSave, { merge: true });
    } catch (error) {
      logDbError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async saveInsalubrityBatch(records: InsalubrityRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    await this.ensureAuthenticatedWriteSession();
    const CHUNK_SIZE = 400;
    let savedCount = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((rec) => {
        const cleanMat = rec.matricula.trim().toUpperCase();
        const docId = rec.id || `insalubre-${cleanMat}-${rec.dataEvento}`;
        const ref = doc(db, COLLECTIONS.INSALUBRIDADE, docId);
        const cleanData = sanitizeDbData({
          id: docId,
          matricula: cleanMat,
          nomeColaborador: rec.nomeColaborador.trim(),
          sede: rec.sede || 'KO',
          competencia: rec.dataEvento.slice(0, 7),
          funcao: rec.funcao || 'Operacional',
          dataEvento: rec.dataEvento,
          atividadeDesempenhada: rec.atividadeDesempenhada.trim().toUpperCase(),
          grauExposicao: rec.grauExposicao || '20%',
          quantidadeHorasDias: Number(rec.quantidadeHorasDias) || 1,
          unidade: rec.unidade || 'DIAS',
          responsavelLancamento: rec.responsavelLancamento || 'RH / Encarregado',
          observacoes: rec.observacoes?.trim() || '',
          criadoEm: rec.criadoEm || new Date().toISOString(),
          criadoPorEmail: rec.criadoPorEmail || '',
        });
        batch.set(ref, cleanData, { merge: true });
      });

      await batch.commit();
      savedCount += chunk.length;
    }

    return savedCount;
  },

  async deleteInsalubrityRecord(docId: string): Promise<void> {
    const path = `${COLLECTIONS.INSALUBRIDADE}/${docId}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      await deleteDoc(doc(db, COLLECTIONS.INSALUBRIDADE, docId));
    } catch (error) {
      logDbError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // CONFIGURAÇÕES GLOBAIS DO SISTEMA (LOGO COMARA, PARÂMETROS)
  // -------------------------------------------------------------

  subscribeSystemConfig(
    onSuccess: (config: SystemConfig) => void,
    onError?: (error: Error) => void,
    realtime = true
  ): Unsubscribe {
    const path = `${COLLECTIONS.SYSTEM_CONFIG}/global`;
    try {
      return onSnapshot(
        doc(db, COLLECTIONS.SYSTEM_CONFIG, 'global'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            onSuccess({
              logoUrl: data.logoUrl || '',
              companyName: data.companyName || 'COMARA',
              subtitle: data.subtitle || 'Comissão de Aeroportos da Região Amazônica',
              insalubrityMode: data.insalubrityMode || 'SIMPLES',
              atualizadoEm: data.atualizadoEm,
              atualizadoPor: data.atualizadoPor,
            });
          } else {
            onSuccess({
              logoUrl: '',
              companyName: 'COMARA',
              subtitle: 'Comissão de Aeroportos da Região Amazônica',
              insalubrityMode: 'SIMPLES',
            });
          }
        },
        (error) => {
          logDbError(error, OperationType.GET, path);
          if (onError) onError(error);
        },
        { realtime }
      );
    } catch (error: any) {
      logDbError(error, OperationType.GET, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  async getSystemConfigOnce(): Promise<SystemConfig | null> {
    const path = `${COLLECTIONS.SYSTEM_CONFIG}/global`;
    try {
      const snapshot = await getDoc(doc(db, COLLECTIONS.SYSTEM_CONFIG, 'global'));
      if (snapshot.exists()) {
        const data = snapshot.data();
        const config: SystemConfig = {
          logoUrl: data.logoUrl || '',
          companyName: data.companyName || 'COMARA',
          subtitle: data.subtitle || 'Comissão de Aeroportos da Região Amazônica',
          insalubrityMode: data.insalubrityMode || 'SIMPLES',
          atualizadoEm: data.atualizadoEm,
          atualizadoPor: data.atualizadoPor,
        };
        return config;
      }
      return null;
    } catch (error) {
      logDbError(error, OperationType.GET, path);
      return null;
    }
  },

  async saveSystemConfig(config: SystemConfig): Promise<void> {
    const path = `${COLLECTIONS.SYSTEM_CONFIG}/global`;
    try {
      await this.ensureAuthenticatedWriteSession();
      const dataToSave = sanitizeDbData({
        logoUrl: config.logoUrl || '',
        companyName: config.companyName || 'COMARA',
        subtitle: config.subtitle || 'Comissão de Aeroportos da Região Amazônica',
        insalubrityMode: config.insalubrityMode || 'SIMPLES',
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: config.atualizadoPor || 'SUPER_ADMIN',
      });
      await setDoc(doc(db, COLLECTIONS.SYSTEM_CONFIG, 'global'), dataToSave, { merge: true });
    } catch (error) {
      logDbError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // RBAC & ADMIN USERS
  // -------------------------------------------------------------

  async saveAdminUser(adminUser: AdminUser): Promise<{ success: boolean; tempPassword?: string | null; warning?: string }> {
    const docId = adminUser.email.trim().toLowerCase();
    const path = `${COLLECTIONS.ADMIN_USERS}/${docId}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      const resolvedStatus = adminUser.status || (adminUser.ativo === false ? 'inativo' : 'ativo');
      const resolvedPerfil = adminUser.perfil || adminUser.role || adminUser.nivelAcesso || 'nenhum';
      const resolvedRole = adminUser.role || adminUser.nivelAcesso || 'GESTOR_RH';
      const resolvedSede = adminUser.canteiroSede || adminUser.sede || 'TODAS';

      const dataToSave: Record<string, any> = {
        id: docId,
        email: docId,
        nome: adminUser.nome || docId.split('@')[0],
        cargo: adminUser.cargo || adminUser.funcao || 'Gestor RH',
        funcao: adminUser.funcao || adminUser.cargo || '',
        saram: adminUser.saram || '',
        nomeGuerra: adminUser.nomeGuerra || '',
        postoGraduacao: adminUser.postoGraduacao || '',
        canteiroSede: resolvedSede,
        tituloImpressao: adminUser.tituloImpressao || '',
        role: resolvedRole,
        nivelAcesso: resolvedRole,
        status: resolvedStatus,
        perfil: resolvedPerfil,
        foto: adminUser.foto || null,
        sede: resolvedSede,
        ativo: adminUser.ativo !== false && resolvedStatus === 'ativo',
        desativacaoAgendada: adminUser.desativacaoAgendada || null,
        transicaoStatus: adminUser.transicaoStatus || (adminUser.desativacaoAgendada ? 'PENDENTE_48H' : 'ATIVO'),
        canteiroCodigo: adminUser.canteiroCodigo || '',
        tratamentoTitulo: adminUser.tratamentoTitulo || 'Chefe',
        criadoEm: adminUser.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      if (adminUser.passwordHash) {
        dataToSave.passwordHash = adminUser.passwordHash;
      }

      // 1. Verifica se o usuário já existe na base documental admin_users
      const existingDocSnap = await getDoc(doc(db, COLLECTIONS.ADMIN_USERS, docId));
      const userExistsInDb = existingDocSnap.exists();

      let edgeFunctionResult: { success: boolean; tempPassword?: string | null; warning?: string } = {
        success: true,
      };

      // 2. Tenta invocar a Edge Function correspondente no Supabase para sincronizar auth.users
      try {
        if (!userExistsInDb) {
          // Criação: chama Edge Function create-admin-user
          const { data, error } = await supabase.functions.invoke('create-admin-user', {
            body: {
              email: docId,
              nome: dataToSave.nome,
              nivel_acesso: resolvedRole,
              canteiro_sede: resolvedSede,
              status: resolvedStatus,
            },
          });

          if (error) {
            console.warn('[RBAC] Edge Function create-admin-user retornou erro:', error);
            edgeFunctionResult.warning = 'Usuário não foi criado no Auth. Contate o suporte.';
          } else if (data) {
            edgeFunctionResult.tempPassword = data.tempPassword || null;
            if (data.error) {
              edgeFunctionResult.warning = data.error;
            }
          }
        } else {
          // Atualização: chama Edge Function update-admin-user
          const { data, error } = await supabase.functions.invoke('update-admin-user', {
            body: {
              email: docId,
              campos: dataToSave,
            },
          });

          if (error) {
            console.warn('[RBAC] Edge Function update-admin-user retornou erro:', error);
            edgeFunctionResult.warning = 'Alterações gravadas no banco, mas não sincronizadas no Auth.';
          } else if (data?.error) {
            edgeFunctionResult.warning = data.error;
          }
        }
      } catch (fnErr: any) {
        console.warn('[RBAC] Falha na chamada da Edge Function, aplicando fallback local:', fnErr?.message || fnErr);
        edgeFunctionResult.warning = 'Usuário não foi criado no Auth. Contate o suporte.';
      }

      // 3. Persistência garantida na camada documental (admin_users e usuarios_sistema)
      await Promise.all([
        setDoc(doc(db, COLLECTIONS.ADMIN_USERS, docId), dataToSave, { merge: true }),
        setDoc(doc(db, COLLECTIONS.USUARIOS_SISTEMA, docId), dataToSave, { merge: true }),
      ]);

      return edgeFunctionResult;
    } catch (error) {
      logDbError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async deleteAdminUser(docId: string): Promise<void> {
    const cleanId = docId.trim().toLowerCase();
    const path = `${COLLECTIONS.ADMIN_USERS}/${cleanId}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      await Promise.all([
        deleteDoc(doc(db, COLLECTIONS.ADMIN_USERS, cleanId)),
        deleteDoc(doc(db, COLLECTIONS.USUARIOS_SISTEMA, cleanId))
      ]);
    } catch (error) {
      logDbError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // SISTEMA DE AUDITORIA E LOGS DE ALTERAÇÃO (AUDIT TRAIL)
  // -------------------------------------------------------------

  subscribeAuditLogs(
    onSuccess: (logs: AuditLog[]) => void,
    onError?: (error: Error) => void,
    maxLimit: number = 300
  ): Unsubscribe {
    return auditService.subscribeAuditLogs(onSuccess, onError, maxLimit);
  },

  async registrarLogAuditoria(params: RegisterAuditParams): Promise<void> {
    return registrarLogAuditoria(params);
  },

  async logAuditEvent(params: RegisterAuditParams): Promise<void> {
    return auditService.logAction(params);
  },

  async logSystemEvent(event: {
    tipo: string;
    descricao: string;
    usuario?: string;
    matricula?: string;
    detalhes?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.ensureAuthenticatedWriteSession();
      const logId = `log-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const logData = sanitizeDbData({
        id: logId,
        tipo: event.tipo || 'LOG_SISTEMA',
        descricao: event.descricao || '',
        usuario: event.usuario || 'SISTEMA',
        matricula: event.matricula || '',
        detalhes: event.detalhes || {},
        timestamp: new Date().toISOString(),
      });
      await setDoc(doc(db, COLLECTIONS.SYSTEM_LOGS, logId), logData);
    } catch (err) {
      console.warn('Erro não bloqueante ao registrar log de auditoria no Firestore:', err);
    }
  },

  // -------------------------------------------------------------
  // GESTÃO DE CANTEIROS DE OBRAS & SEDES UNIFICADAS
  // -------------------------------------------------------------

  subscribeConstructionSites(
    onSuccess: (sites: ConstructionSite[]) => void,
    onError?: (error: Error) => void,
    realtime = true
  ): Unsubscribe {
    return canteiroService.subscribeCanteiros(onSuccess, onError, realtime);
  },

  async getConstructionSites(): Promise<ConstructionSite[]> {
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTIONS.CANTEIROS), limit(200)));
      const list: ConstructionSite[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const rawBranch = (data.sedeCodigo || data.sede || data.branch || '').toUpperCase();
        list.push({
          id: docSnap.id,
          codigo: data.codigo || data.code || '',
          code: data.code || data.codigo || '',
          nome: data.nome || data.name || '',
          name: data.name || data.nome || '',
          sede: rawBranch,
          branch: rawBranch,
          sedeCodigo: rawBranch,
          chefe: data.chefe || data.chefeCanteiro || data.chief || '',
          chief: data.chief || data.chefeCanteiro || data.chefe || '',
          chefeCanteiro: data.chefeCanteiro || data.chefe || data.chief || '',
          encarregado: data.encarregado || '',
          uoVinculadaCodigo: data.uoVinculadaCodigo || '',
          chefeDa: data.chefeDa,
          gerente: data.gerente || data.manager,
          auxDa: data.auxDa,
          status: data.status || 'ACTIVE',
          grauInsalubridade: data.grauInsalubridade || data.insalubrityLevel,
          dataInicio: data.dataInicio || data.startDate,
          dataPrevisaoFim: data.dataPrevisaoFim || data.expectedEndDate,
          observacoes: data.observacoes || data.notes,
          criadoEm: data.criadoEm || data.createdAt,
          atualizadoEm: data.atualizadoEm || data.updatedAt,
          ...data,
        } as ConstructionSite);
      });
      return list;
    } catch (error) {
      logDbError(error, OperationType.GET, COLLECTIONS.CANTEIROS);
      return [];
    }
  },

  async saveConstructionSite(site: Partial<ConstructionSite> & { chiefContact?: string; chefeContato?: string }): Promise<void> {
    await canteiroService.saveCanteiro(site);
  },

  async deleteConstructionSite(id: string): Promise<void> {
    await canteiroService.deleteCanteiro(id);
  },

  // -------------------------------------------------------------
  // CONTRACHEQUES DIGITAIS COMARA (PDF PARSER & VISUALIZADOR)
  // -------------------------------------------------------------

  subscribePaystubs(
    onSuccess: (paystubs: PaystubRecord[]) => void,
    onError?: (error: Error) => void,
    canteiroId?: string,
    matricula?: string,
    realtime = true
  ): Unsubscribe {
    const path = COLLECTIONS.CONTRACHEQUES;
    try {
      const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;
      const normalizedMatricula = matricula?.trim().toUpperCase();
      let q;
      if (normalizedMatricula) {
        q = query(collection(db, path), where('matricula', '==', normalizedMatricula), limit(500));
      } else if (normalizedCanteiro) {
        q = query(collection(db, path), where('sede', '==', normalizedCanteiro), limit(500));
      } else {
        // Carrega os contracheques de todas as competências para visualização unificada na gestão
        q = query(collection(db, path), limit(1000));
      }

      return onSnapshot(
        q,
        (snapshot) => {
          const items: PaystubRecord[] = snapshot.docs
            .map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                matricula: data.matricula || '',
                nome: data.nome || '',
                cargo: data.cargo || '',
                sede: data.sede || 'KO-DL',
                periodo: data.periodo || '',
                mesAno: data.mesAno || '',
                ano: Number(data.ano || 2026),
                mes: Number(data.mes || 1),
                dataInicio: data.dataInicio || '',
                dataFim: data.dataFim || '',
                cpf: data.cpf || '',
                banco: data.banco || '',
                agencia: data.agencia || '',
                conta: data.conta || '',
                rubricas: Array.isArray(data.rubricas) ? data.rubricas : [],
                totalProventos: Number(data.totalProventos || 0),
                totalDescontos: Number(data.totalDescontos || 0),
                valorLiquido: Number(data.valorLiquido || 0),
                salarioBase: data.salarioBase !== undefined ? Number(data.salarioBase) : undefined,
                baseInss: data.baseInss !== undefined ? Number(data.baseInss) : undefined,
                baseFgts: data.baseFgts !== undefined ? Number(data.baseFgts) : undefined,
                fgtsMes: data.fgtsMes !== undefined ? Number(data.fgtsMes) : undefined,
                baseIrrf: data.baseIrrf !== undefined ? Number(data.baseIrrf) : undefined,
                importadoEm: data.importadoEm || '',
                importadoPorEmail: data.importadoPorEmail || '',
                observacoes: data.observacoes || ''
              };
            })
            .filter((p) => {
              if (!normalizedCanteiro) return true;
              const empSede = (p.sede || '').toUpperCase();
              return empSede.includes(normalizedCanteiro);
            });
          onSuccess(items);
        },
        (error) => {
          logDbError(error, OperationType.LIST, path);
          if (onError) onError(error);
        },
        { realtime }
      );
    } catch (error) {
      logDbError(error, OperationType.LIST, path);
      if (onError) onError(error as Error);
      return () => {};
    }
  },

  async savePaystub(paystub: PaystubRecord): Promise<void> {
    const cleanMatricula = paystub.matricula.trim().toUpperCase();
    const cleanMesAno = paystub.mesAno.trim();
    const docId = paystub.id || `${cleanMatricula}_${cleanMesAno}`;
    const path = `${COLLECTIONS.CONTRACHEQUES}/${docId}`;

    try {
      await this.ensureAuthenticatedWriteSession();
      const sanitized = preparePaystubForDb(paystub);
      await setDoc(doc(db, COLLECTIONS.CONTRACHEQUES, docId), sanitized, { merge: true });
    } catch (error) {
      handleDbError(error, OperationType.WRITE, path);
    }
  },

  async savePaystubsBatch(
    paystubs: PaystubRecord[],
    onProgress?: (info: BatchProgressInfo) => void
  ): Promise<void> {
    await this.ensureAuthenticatedWriteSession();
    const CHUNK_SIZE = 300;
    const total = paystubs.length;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = paystubs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((p) => {
          const cleanMatricula = p.matricula.trim().toUpperCase();
          const cleanMesAno = p.mesAno.trim();
          const docId = p.id || `${cleanMatricula}_${cleanMesAno}`;
          const ref = doc(db, COLLECTIONS.CONTRACHEQUES, docId);
          const sanitized = preparePaystubForDb(p);
          batch.set(ref, sanitized, { merge: true });
        });

        await batch.commit();

        if (onProgress) {
          const processed = Math.min(i + CHUNK_SIZE, total);
          onProgress({
            processed,
            total,
            percent: Math.round((processed / total) * 100),
            chunkIndex: Math.floor(i / CHUNK_SIZE) + 1,
            totalChunks,
          });
        }
      }
    } catch (error) {
      logDbError(error, OperationType.WRITE, COLLECTIONS.CONTRACHEQUES);
      throw error;
    }
  },

  async saveBatchPaystubs(
    paystubs: PaystubRecord[],
    onProgress?: (info: BatchProgressInfo) => void
  ): Promise<void> {
    return this.savePaystubsBatch(paystubs, onProgress);
  },

  async deletePaystub(id: string): Promise<void> {
    const path = `${COLLECTIONS.CONTRACHEQUES}/${id}`;
    try {
      await this.ensureAuthenticatedWriteSession();
      await deleteDoc(doc(db, COLLECTIONS.CONTRACHEQUES, id));
    } catch (error) {
      handleDbError(error, OperationType.DELETE, path);
    }
  },

  // -------------------------------------------------------------
  // DISPENSAS DE SPTF (EMISSÃO EM 2 VIAS E DÉBITO AUTOMÁTICO)
  // -------------------------------------------------------------

  subscribeDispensasSptf(
    onSuccess: (dispensas: DispensaSptfRecord[]) => void,
    onError?: (error: Error) => void,
    canteiroId?: string,
    realtime = true
  ): Unsubscribe {
    const path = COLLECTIONS.DISPENSAS_SPTF;
    try {
      const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;
      const q = normalizedCanteiro
        ? query(collection(db, path), where('employeeSede', '==', normalizedCanteiro), limit(1000))
        : query(collection(db, path), limit(1000));

      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: DispensaSptfRecord[] = [];
            const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;

            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (normalizedCanteiro) {
                const empSede = (data.employeeSede || '').toUpperCase();
                const secao = (data.secaoCanteiro || '').toUpperCase();
                const canteiro = (data.canteiroId || '').toUpperCase();
                if (empSede !== normalizedCanteiro && !secao.includes(normalizedCanteiro) && canteiro !== normalizedCanteiro) {
                  return;
                }
              }

              list.push({
                id: docSnap.id,
                numeroGuia: data.numeroGuia || '',
                matricula: (data.matricula || '').toString().trim().toUpperCase(),
                nome: data.nome || '',
                saram: data.saram || data.matricula || '',
                secaoCanteiro: data.secaoCanteiro || 'DECO-KO',
                data: data.data || '',
                horarioInicio: data.horarioInicio || '13:00',
                horarioFim: data.horarioFim || '16:00',
                totalHoras: typeof data.totalHoras === 'number' ? data.totalHoras : (Number(data.totalHoras) || 0),
                motivo: data.motivo || 'COMPENSAÇÃO BANCO DE HORAS',
                observacoes: data.observacoes || '',
                emitidoPorNome: data.emitidoPorNome || '',
                emitidoPorEmail: data.emitidoPorEmail || '',
                emitidoEm: data.emitidoEm || '',
                lancamentoId: data.lancamentoId || '',
                status: data.status || 'EMITIDA',
              });
            });

            // Ordenar por emissão mais recente
            list.sort((a, b) => (b.emitidoEm || b.data || '').localeCompare(a.emitidoEm || a.data || ''));
            onSuccess(list);
          } catch (err: any) {
            console.error('Erro ao processar snapshot de dispensas SPTF:', err);
            if (onError) onError(err);
          }
        },
        (error) => {
          logDbError(error, OperationType.LIST, path);
          if (onError) onError(error);
        },
        { realtime }
      );
    } catch (error: any) {
      logDbError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  async getDispensasByMonth(anoMes: string, canteiroId?: string): Promise<DispensaSptfRecord[]> {
    const path = COLLECTIONS.DISPENSAS_SPTF;
    const [yearStr, monthStr] = (anoMes || '').split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;

    try {
      const q = query(
        collection(db, path),
        where('data', '>=', startDate),
        where('data', '<=', endDate),
        limit(500)
      );

      const snapshot = await getDocs(q);
      const list: DispensaSptfRecord[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (normalizedCanteiro) {
          const secao = (data.secaoCanteiro || '').toUpperCase();
          const canteiro = (data.canteiroId || '').toUpperCase();
          if (!secao.includes(normalizedCanteiro) && canteiro !== normalizedCanteiro) {
            return;
          }
        }

        list.push({
          id: docSnap.id,
          numeroGuia: data.numeroGuia || '',
          matricula: (data.matricula || '').toString().trim().toUpperCase(),
          nome: data.nome || '',
          saram: data.saram || data.matricula || '',
          secaoCanteiro: data.secaoCanteiro || 'DECO-KO',
          data: data.data || '',
          horarioInicio: data.horarioInicio || '13:00',
          horarioFim: data.horarioFim || '16:00',
          totalHoras: typeof data.totalHoras === 'number' ? data.totalHoras : (Number(data.totalHoras) || 0),
          motivo: data.motivo || 'COMPENSAÇÃO BANCO DE HORAS',
          observacoes: data.observacoes || '',
          emitidoPorNome: data.emitidoPorNome || '',
          emitidoPorEmail: data.emitidoPorEmail || '',
          emitidoEm: data.emitidoEm || '',
          lancamentoId: data.lancamentoId || '',
          status: data.status || 'EMITIDA',
        });
      });

      list.sort((a, b) => (b.emitidoEm || b.data || '').localeCompare(a.emitidoEm || a.data || ''));
      return list;
    } catch (error: any) {
      logDbError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async emitDispensaSptf(
    dispensa: DispensaSptfRecord,
    record: TimeRecord,
    userEmail?: string
  ): Promise<void> {
    await this.ensureAuthenticatedWriteSession();
    const batch = writeBatch(db);

    // 1. Sanitizar dados do lançamento de débito no Banco de Horas
    const lancRef = doc(db, COLLECTIONS.LANCAMENTOS, record.id);
    const cleanRecord = sanitizeDbData({
      id: record.id,
      matricula: (record.matricula || '').trim().toUpperCase(),
      employeeName: record.employeeName || '',
      employeeSede: record.employeeSede || 'KO',
      employeeFuncao: record.employeeFuncao || 'Técnico de Manutenção',
      employeeAvatarUrl: record.employeeAvatarUrl || '',
      dataRegistro: record.dataRegistro || '',
      data_ocorrencia: record.data_ocorrencia || record.dataRegistro || '',
      tipoOcorrencia: 'DISPENSA_SPTF',
      horasBrutas: Number(record.horasBrutas) || 0,
      multiplicador: 1.0,
      saldoCalculado: -(Number(record.horasBrutas) || 0),
      saldo_remanescente: 0,
      status_compensacao: 'TOTALMENTE_COMPENSADO',
      liquidacoes: [],
      eFeriado: false,
      diaSemana: Number(record.diaSemana) || 1,
      diaSemanaNome: record.diaSemanaNome || '',
      observacao: record.observacao || `Dispensa de SPTF Nº ${dispensa.numeroGuia || ''} (${dispensa.horarioInicio} às ${dispensa.horarioFim})`,
      criadoEm: record.criadoEm || new Date().toISOString(),
      criadoPorEmail: userEmail || record.criadoPorEmail || '',
      atualizadoEm: new Date().toISOString(),
    });
    batch.set(lancRef, cleanRecord, { merge: true });

    // 2. Sanitizar dados da Guia de Dispensa de SPTF
    const dispensaRef = doc(db, COLLECTIONS.DISPENSAS_SPTF, dispensa.id);
    const cleanDispensa = prepareDispensaSptfForDb({
      ...dispensa,
      lancamentoId: record.id,
      employeeSede: dispensa.employeeSede || record.employeeSede || '',
      emitidoPorEmail: userEmail || dispensa.emitidoPorEmail,
    });
    batch.set(dispensaRef, cleanDispensa, { merge: true });

    try {
      await batch.commit();
    } catch (error) {
      logDbError(error, OperationType.WRITE, COLLECTIONS.DISPENSAS_SPTF);
      throw error;
    }
  },

  async deleteDispensaSptf(dispensaId: string, lancamentoId?: string): Promise<void> {
    await this.ensureAuthenticatedWriteSession();
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.DISPENSAS_SPTF, dispensaId));
    if (lancamentoId) {
      batch.delete(doc(db, COLLECTIONS.LANCAMENTOS, lancamentoId));
    }
    try {
      await batch.commit();
    } catch (error) {
      logDbError(error, OperationType.DELETE, COLLECTIONS.DISPENSAS_SPTF);
      throw error;
    }
  },

  async clearAllData(userRole?: AdminRole | string): Promise<void> {
    await this.ensureAuthenticatedWriteSession();
    // S-006: Strict validation — only SUPER_ADMIN can execute clearAllData
    if (!userRole || userRole !== 'SUPER_ADMIN') {
      throw new Error('Acesso negado: Limpeza da base central restrita estritamente a Super Administradores (SUPER_ADMIN).');
    }
    const CHUNK_SIZE = 400;
    try {
      // 1. Deletar todos os colaboradores em lotes
      const colabsSnap = await getDocs(collection(db, COLLECTIONS.COLABORADORES));
      const colabDocs = colabsSnap.docs;
      for (let i = 0; i < colabDocs.length; i += CHUNK_SIZE) {
        const chunk = colabDocs.slice(i, i + CHUNK_SIZE);
        const colabBatch = writeBatch(db);
        chunk.forEach((d) => colabBatch.delete(d.ref));
        await colabBatch.commit();
      }

      // 2. Deletar todos os lançamentos em lotes
      const lancsSnap = await getDocs(collection(db, COLLECTIONS.LANCAMENTOS));
      const lancDocs = lancsSnap.docs;
      for (let i = 0; i < lancDocs.length; i += CHUNK_SIZE) {
        const chunk = lancDocs.slice(i, i + CHUNK_SIZE);
        const lancBatch = writeBatch(db);
        chunk.forEach((d) => lancBatch.delete(d.ref));
        await lancBatch.commit();
      }

      // 3. Deletar contracheques em lotes
      const paystubsSnap = await getDocs(collection(db, COLLECTIONS.CONTRACHEQUES));
      const paystubDocs = paystubsSnap.docs;
      for (let i = 0; i < paystubDocs.length; i += CHUNK_SIZE) {
        const chunk = paystubDocs.slice(i, i + CHUNK_SIZE);
        const pBatch = writeBatch(db);
        chunk.forEach((d) => pBatch.delete(d.ref));
        await pBatch.commit();
      }
    } catch (error) {
      logDbError(error, OperationType.DELETE, 'all');
      throw error;
    }
  },

  async autoSeedDefaultAdminMaster(): Promise<{ success: boolean; message: string }> {
    return autoSeedDefaultAdminMaster();
  }
};
