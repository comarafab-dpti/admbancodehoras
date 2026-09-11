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
import { Employee } from '../types';
import { dbService, mapEmployeeDocument, prepareEmployeeForDb, sanitizeDbData, COLLECTIONS, BatchProgressInfo } from './dbService';
import { hashPassword } from './authService';

export const colaboradorService = {
  /**
   * Monitoramento em tempo real dos colaboradores no Firestore
   */
  subscribeColaboradores(
    onSuccess: (employees: Employee[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const path = COLLECTIONS.COLABORADORES;
    try {
      const q = query(collection(db, path), orderBy('nome', 'asc'));
      return onSnapshot(
        q,
        (snapshot) => {
          try {
            const list: Employee[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
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
        }
      );
    } catch (error: any) {
      logDbError(error, OperationType.LIST, path);
      if (onError) onError(error);
      return () => {};
    }
  },

  /**
   * Lista todos os colaboradores
   */
  async listColaboradores(): Promise<Employee[]> {
    const path = COLLECTIONS.COLABORADORES;
    try {
      const q = query(collection(db, path), orderBy('nome', 'asc'));
      const snapshot = await getDocs(q);
      const list: Employee[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push(mapEmployeeDocument(data, docSnap.id));
      });
      return list;
    } catch (error) {
      logDbError(error, OperationType.GET, path);
      return [];
    }
  },

  /**
   * Salva ou atualiza um colaborador no Firestore
   */
  async saveColaborador(employee: Employee): Promise<void> {
    const docId = (employee.matricula || employee.id || '').trim().toUpperCase();
    const path = `${COLLECTIONS.COLABORADORES}/${docId}`;
    try {
      await dbService.ensureAuthenticatedWriteSession();
      const cleanData = prepareEmployeeForDb(employee);
      await setDoc(doc(db, COLLECTIONS.COLABORADORES, docId), cleanData, { merge: true });

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

  /**
   * Importa lote de colaboradores
   */
  async importColaboradoresBatch(
    employees: Employee[],
    onProgress?: (info: BatchProgressInfo) => void
  ): Promise<{ count: number; total: number; errors: string[] }> {
    const CHUNK_SIZE = 400;
    const total = employees.length;
    let count = 0;
    const errors: string[] = [];
    const totalChunks = Math.ceil(total / CHUNK_SIZE);

    try {
      await dbService.ensureAuthenticatedWriteSession();
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = employees.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;

        chunk.forEach((emp) => {
          const docId = (emp.matricula || emp.id || '').trim().toUpperCase();
          if (docId) {
            const ref = doc(db, COLLECTIONS.COLABORADORES, docId);
            const cleanData = prepareEmployeeForDb(emp);
            batch.set(ref, cleanData, { merge: true });
          }
        });

        await batch.commit();
        count += chunk.length;

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
      errors.push(error?.message || 'Erro no processamento em lote de colaboradores');
      return { count, total, errors };
    }
  },

  /**
   * Exclui um colaborador
   */
  async deleteColaborador(docId: string): Promise<void> {
    const path = `${COLLECTIONS.COLABORADORES}/${docId}`;
    try {
      await dbService.ensureAuthenticatedWriteSession();
      await Promise.all([
        deleteDoc(doc(db, COLLECTIONS.COLABORADORES, docId)),
        deleteDoc(doc(db, COLLECTIONS.COLABORADORES_AUTH, docId)).catch(() => {}),
      ]);
    } catch (error) {
      logDbError(error, OperationType.DELETE, path);
      throw error;
    }
  }
};
