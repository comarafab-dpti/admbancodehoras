import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  onSnapshot, 
  query, 
  orderBy,
  Unsubscribe 
} from './db';
import { db, logDbError, OperationType } from './db';
import { InsalubrityRecord } from '../types';
import { dbService, sanitizeDbData } from './dbService';

export const INSALUBRIDADE_COLLECTION = 'insalubridade_records';

export const insalubridadeService = {
  /**
   * Monitora em tempo real a coleção de insalubridade com filtro de período
   */
  subscribeInsalubrityRecords(
    onSuccess: (records: InsalubrityRecord[]) => void,
    onError?: (error: Error) => void,
    options?: {
      canteiroId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Unsubscribe {
    return dbService.subscribeInsalubrityRecords(onSuccess, onError, options);
  },

  /**
   * Busca registros de insalubridade por período específico com estratégia Cache-First
   */
  async getInsalubrityRecordsByPeriod(params: {
    startDate: string;
    endDate: string;
    canteiroId?: string;
    forceRefresh?: boolean;
  }): Promise<InsalubrityRecord[]> {
    return dbService.fetchInsalubrityRecordsByPeriod(params);
  },

  /**
   * Lista registros de insalubridade (limitado ao período vigente ou especificado)
   */
  async listInsalubrityRecords(startDate?: string, endDate?: string, canteiroId?: string): Promise<InsalubrityRecord[]> {
    const now = new Date();
    const sDate = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const eDate = endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    return dbService.fetchInsalubrityRecordsByPeriod({
      startDate: sDate,
      endDate: eDate,
      canteiroId,
    });
  },

  /**
   * Grava um registro de insalubridade diretamente no Cloud Firestore
   */
  async saveInsalubrityRecord(record: InsalubrityRecord): Promise<void> {
    const cleanMat = record.matricula.trim().toUpperCase();
    const docId = record.id || `insalubre-${cleanMat}-${record.dataEvento}`;
    const path = `${INSALUBRIDADE_COLLECTION}/${docId}`;
    try {
      await dbService.ensureAuthenticatedWriteSession();
      const dataToSave = sanitizeDbData({
        id: docId,
        matricula: cleanMat,
        nomeColaborador: record.nomeColaborador.trim(),
        sede: record.sede || 'KO',
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
      });
      await setDoc(doc(db, INSALUBRIDADE_COLLECTION, docId), dataToSave, { merge: true });
    } catch (error) {
      logDbError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  /**
   * Grava um lote de registros de insalubridade diretamente no Cloud Firestore (Matriz Simples / Lançamento Rápido)
   */
  async saveInsalubrityBatch(records: InsalubrityRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    await dbService.ensureAuthenticatedWriteSession();
    const CHUNK_SIZE = 400;
    let savedCount = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((rec) => {
        const cleanMat = rec.matricula.trim().toUpperCase();
        const docId = rec.id || `insalubre-${cleanMat}-${rec.dataEvento}`;
        const ref = doc(db, INSALUBRIDADE_COLLECTION, docId);
        const cleanData = sanitizeDbData({
          id: docId,
          matricula: cleanMat,
          nomeColaborador: rec.nomeColaborador.trim(),
          sede: rec.sede || 'KO',
          funcao: rec.funcao || 'Operacional',
          dataEvento: rec.dataEvento,
          atividadeDesempenhada: rec.atividadeDesempenhada.trim().toUpperCase(),
          grauExposicao: rec.grauExposicao || '20%',
          quantidadeHorasDias: Number(rec.quantidadeHorasDias) || 1,
          unidade: rec.unidade || 'DIAS',
          responsavelLancamento: rec.responsavelLancamento || 'Encarregado / RH',
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

  /**
   * Exclui um registro de insalubridade
   */
  async deleteInsalubrityRecord(docId: string): Promise<void> {
    const path = `${INSALUBRIDADE_COLLECTION}/${docId}`;
    try {
      await dbService.ensureAuthenticatedWriteSession();
      await deleteDoc(doc(db, INSALUBRIDADE_COLLECTION, docId));
    } catch (error) {
      logDbError(error, OperationType.DELETE, path);
      throw error;
    }
  }
};
