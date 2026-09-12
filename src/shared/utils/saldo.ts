import { Employee, TimeRecord } from '../types';

export interface SaldoColaborador {
  saldoTotalHoras: number;
  saldoTotalDias: number;
  saldoInicial: number;
  totalCreditos: number;
  totalDebitos: number;
  totalAtestados: number;
  totalFaltas: number;
  totalHorasDescontoFolha: number;
  totalHorasExtras50: number;
  totalHorasExtras100: number;
  status: 'CREDOR' | 'DEVEDOR' | 'ZERADO';
}

export function chaveMatricula(matricula: string | undefined | null): string {
  return (matricula || '').trim().toUpperCase().replace(/^0+/, '') || '0';
}

export function calcularSaldosConsolidados(
  employees: Employee[],
  records: TimeRecord[],
): Map<string, SaldoColaborador> {
  const initial = new Map<string, {
    saldoInicial: number;
    totalCreditos: number;
    totalDebitos: number;
    totalAtestados: number;
    totalFaltas: number;
    totalHorasDescontoFolha: number;
    totalHorasExtras50: number;
    totalHorasExtras100: number;
  }>();

  employees.forEach((employee) => {
    initial.set(chaveMatricula(employee.matricula), {
      saldoInicial: employee.saldoInicialHoras || 0,
      totalCreditos: 0,
      totalDebitos: 0,
      totalAtestados: 0,
      totalFaltas: 0,
      totalHorasDescontoFolha: 0,
      totalHorasExtras50: 0,
      totalHorasExtras100: 0,
    });
  });

  records.forEach((record) => {
    const totals = initial.get(chaveMatricula(record.matricula));
    if (!totals) return;

    if (record.saldoCalculado > 0) totals.totalCreditos += record.saldoCalculado;
    if (record.saldoCalculado < 0) totals.totalDebitos += Math.abs(record.saldoCalculado);

    if (record.tipoOcorrencia === 'FALTA_INJUSTIFICADA') {
      totals.totalFaltas += 1;
      totals.totalHorasDescontoFolha += record.horasDescontoFolha || (record.horasBrutas > 0 ? record.horasBrutas : 8);
    }
    if (record.tipoOcorrencia === 'ATESTADO_MEDICO' || record.tipoOcorrencia === 'FALTA_JUSTIFICADA') {
      totals.totalAtestados += 1;
    }
    if (record.tipoOcorrencia === 'TRABALHO' && record.multiplicador === 1.5) {
      totals.totalHorasExtras50 += record.horasBrutas;
    }
    if (record.tipoOcorrencia === 'TRABALHO' && record.multiplicador === 2) {
      totals.totalHorasExtras100 += record.horasBrutas;
    }
  });

  const result = new Map<string, SaldoColaborador>();
  initial.forEach((totals, matricula) => {
    const saldoTotalHoras = Number((totals.saldoInicial + totals.totalCreditos - totals.totalDebitos).toFixed(2));
    const status = saldoTotalHoras > 0.05 ? 'CREDOR' : saldoTotalHoras < -0.05 ? 'DEVEDOR' : 'ZERADO';
    result.set(matricula, {
      ...totals,
      saldoTotalHoras,
      saldoTotalDias: Number((saldoTotalHoras / 8).toFixed(2)),
      status,
    });
  });

  return result;
}
