import {
  DocumentReference,
  collection,
  DocumentData,
  doc,
  getDocs,
  writeBatch,
  Timestamp,
} from './db';
import { db, getDbFriendlyMessage, isPermissionError, isQuotaError } from './db';
import { dbService } from './dbService';

/**
 * Firestore Web SDK does not expose listCollectionIds/getCollections. Keep this
 * registry as the client-side source of truth for known subcollections.
 * Collection discovery for arbitrary subcollections requires Admin SDK/REST.
 */
export const COLLECTIONS = [
  'admin_users',
  'usuarios_sistema',
  'colaboradores',
  'colaboradores_auth',
  'canteiros_obras',
  'dispensas_sptf',
  'contracheques',
  'insalubridade_records',
  'lancamentos',
  'resumo_mensal',
  'system_config',
  'institution_settings',
  'system_logs',
  'logs_auditoria',
] as const;

export const SUBCOLLECTIONS: Record<string, readonly string[]> = {
  // Add a subcollection here when it is introduced in the data model.
};

export interface BackupDocument {
  id: string;
  data: DocumentData;
  subcollections: Record<string, BackupDocument[]>;
}

export interface BackupData {
  version: '1.0';
  exportedAt: Timestamp;
  collections: Record<string, BackupDocument[]>;
}

export interface BackupProgress {
  phase: 'reading' | 'deleting' | 'writing';
  collection: string;
  processed: number;
  total: number;
  percent: number;
}

const MAX_BATCH_OPERATIONS = 500;
const TIMESTAMP_MARKER = '__firestoreTimestamp';

export class BackupError extends Error {
  constructor(
    message: string,
    public readonly collectionName: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

function getErrorMessage(error: unknown): string {
  if (isQuotaError(error)) {
    return 'Cota do Cloud Firestore excedida durante a exportação.';
  }
  if (isPermissionError(error)) {
    return 'Permissão insuficiente para ler os dados desta coleção.';
  }
  return getDbFriendlyMessage(error);
}

async function exportDocuments(
  collectionPath: string,
  subcollectionNames: readonly string[],
  onProgress?: (progress: BackupProgress) => void,
): Promise<BackupDocument[]> {
  let snapshot;
  try {
    snapshot = await getDocs(collection(db, collectionPath));
  } catch (error) {
    throw new BackupError(
      `Falha ao ler "${collectionPath}": ${getErrorMessage(error)}`,
      collectionPath,
      error,
    );
  }

  const documents: BackupDocument[] = [];
  snapshot.forEach((documentSnapshot) => {
    documents.push({
      id: documentSnapshot.id,
      data: documentSnapshot.data(),
      subcollections: {},
    });
  });

  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index];
    for (const subcollectionName of subcollectionNames) {
      const subcollectionPath = `${collectionPath}/${document.id}/${subcollectionName}`;
      document.subcollections[subcollectionName] = await exportDocuments(
        subcollectionPath,
        SUBCOLLECTIONS[subcollectionPath] || SUBCOLLECTIONS[subcollectionName] || [],
        onProgress,
      );
    }
    onProgress?.({
      phase: 'reading',
      collection: collectionPath,
      processed: index + 1,
      total: documents.length,
      percent: documents.length === 0 ? 100 : Math.round(((index + 1) / documents.length) * 100),
    });
  }

  return documents;
}

/**
 * Exports every configured root collection, preserving document IDs, native
 * Firestore values (including Timestamp), and registered subcollections.
 */
export async function exportAllData(
  onProgress?: (progress: BackupProgress) => void,
): Promise<BackupData> {
  const exportedCollections: Record<string, BackupDocument[]> = {};

  for (const collectionName of COLLECTIONS) {
    exportedCollections[collectionName] = await exportDocuments(
      collectionName,
      SUBCOLLECTIONS[collectionName] || [],
      onProgress,
    );
  }

  return {
    version: '1.0',
    exportedAt: Timestamp.now(),
    collections: exportedCollections,
  };
}

function toSerializable(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { [TIMESTAMP_MARKER]: value.toDate().toISOString() };
  }
  if (value instanceof Date) {
    return { [TIMESTAMP_MARKER]: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toSerializable(nestedValue)]),
    );
  }
  return value;
}

function fromSerializable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(fromSerializable);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  if (typeof record[TIMESTAMP_MARKER] === 'string') {
    const date = new Date(record[TIMESTAMP_MARKER]);
    if (!Number.isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }

  // Accept the shape produced by Timestamp.toJSON in older local backups.
  if (record.type === 'timestamp' && typeof record.seconds === 'number') {
    return new Timestamp(record.seconds, Number(record.nanoseconds || 0));
  }

  return Object.fromEntries(
    Object.entries(record)
      .map(([key, nestedValue]) => [key, fromSerializable(nestedValue)])
      .filter(([_, v]) => v !== undefined),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateBackupData(data: any): boolean {
  if (!isRecord(data) || data.version !== '1.0' || !('exportedAt' in data) || !isRecord(data.collections)) {
    return false;
  }

  return Object.values(data.collections).every((documents) => {
    if (!Array.isArray(documents)) return false;
    return documents.every((backupDocument) => {
      if (!isRecord(backupDocument) || typeof backupDocument.id !== 'string' || !isRecord(backupDocument.data)) {
        return false;
      }
      if (!isRecord(backupDocument.subcollections)) return false;
      return Object.values(backupDocument.subcollections).every((nestedDocuments) => (
        Array.isArray(nestedDocuments) && nestedDocuments.every((nestedDocument) => (
          isRecord(nestedDocument) &&
          typeof nestedDocument.id === 'string' &&
          isRecord(nestedDocument.data) &&
          isRecord(nestedDocument.subcollections)
        ))
      ));
    });
  });
}

export function downloadBackup(data: BackupData): void {
  const serialized = JSON.stringify(toSerializable(data), null, 2);
  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_SPTF_${today}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface ImportProgress extends BackupProgress {
  mode: 'replace' | 'merge';
}

function getImportErrorMessage(error: unknown): string {
  if (isQuotaError(error)) return 'Cota do Cloud Firestore excedida durante a restauração.';
  if (isPermissionError(error)) return 'Permissão insuficiente para alterar os dados desta coleção.';
  return getDbFriendlyMessage(error);
}

async function commitDeletes(references: DocumentReference[], collectionName: string, onProgress?: (progress: ImportProgress) => void, processed = 0, total = references.length): Promise<number> {
  await dbService.ensureAuthenticatedWriteSession();
  for (let start = 0; start < references.length; start += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(db);
    const chunk = references.slice(start, start + MAX_BATCH_OPERATIONS);
    chunk.forEach((reference) => batch.delete(reference));
    try {
      await batch.commit();
    } catch (error) {
      throw new BackupError(`Falha ao apagar "${collectionName}": ${getImportErrorMessage(error)}`, collectionName, error);
    }
    processed += chunk.length;
    onProgress?.({ phase: 'deleting', collection: collectionName, processed, total, percent: total ? Math.round((processed / total) * 100) : 100, mode: 'replace' });
  }
  return processed;
}

async function collectDocumentReferences(collectionPath: string, subcollectionNames: readonly string[]): Promise<DocumentReference[]> {
  const snapshot = await getDocs(collection(db, collectionPath));
  const references: DocumentReference[] = [];
  for (const documentSnapshot of snapshot.docs) {
    for (const subcollectionName of subcollectionNames) {
      references.push(...await collectDocumentReferences(
        `${collectionPath}/${documentSnapshot.id}/${subcollectionName}`,
        SUBCOLLECTIONS[`${collectionPath}/${documentSnapshot.id}/${subcollectionName}`] || SUBCOLLECTIONS[subcollectionName] || [],
      ));
    }
    references.push(doc(db, collectionPath, documentSnapshot.id));
  }
  return references;
}

async function writeBackupDocuments(
  collectionPath: string,
  documents: BackupDocument[],
  mode: 'replace' | 'merge',
  onProgress?: (progress: ImportProgress) => void,
): Promise<void> {
  await dbService.ensureAuthenticatedWriteSession();
  const operations: Array<{ collectionPath: string; document: BackupDocument }> = [];
  const flatten = (path: string, backupDocuments: BackupDocument[]) => {
    backupDocuments.forEach((backupDocument) => {
      operations.push({ collectionPath: path, document: backupDocument });
      Object.entries(backupDocument.subcollections).forEach(([subcollectionName, nestedDocuments]) => {
        flatten(`${path}/${backupDocument.id}/${subcollectionName}`, nestedDocuments);
      });
    });
  };
  flatten(collectionPath, documents);

  for (let start = 0; start < operations.length; start += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(db);
    const chunk = operations.slice(start, start + MAX_BATCH_OPERATIONS);
    chunk.forEach(({ collectionPath: path, document: backupDocument }) => {
      batch.set(doc(db, path, backupDocument.id), fromSerializable(backupDocument.data) as DocumentData, { merge: mode === 'merge' });
    });
    try {
      await batch.commit();
    } catch (error) {
      throw new BackupError(`Falha ao gravar "${collectionPath}": ${getImportErrorMessage(error)}`, collectionPath, error);
    }
    onProgress?.({ phase: 'writing', collection: collectionPath, processed: Math.min(start + chunk.length, operations.length), total: operations.length, percent: operations.length ? Math.round(((start + chunk.length) / operations.length) * 100) : 100, mode });
  }
}

export async function importAllData(
  file: File,
  mode: 'replace' | 'merge',
  onProgress?: (progress: ImportProgress) => void,
): Promise<void> {
  await dbService.ensureAuthenticatedWriteSession();
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(await file.text());
  } catch (error) {
    throw new BackupError('Arquivo inválido: não foi possível ler um JSON válido.', 'arquivo', error);
  }
  if (!validateBackupData(parsedData)) {
    throw new BackupError('Arquivo inválido: formato de backup SPTF não reconhecido.', 'arquivo');
  }

  const backup = parsedData as BackupData;
  if (mode === 'replace') {
    for (const collectionName of COLLECTIONS) {
      let references: DocumentReference[];
      try {
        references = await collectDocumentReferences(collectionName, SUBCOLLECTIONS[collectionName] || []);
      } catch (error) {
        throw new BackupError(`Falha ao localizar dados para apagar em "${collectionName}": ${getImportErrorMessage(error)}`, collectionName, error);
      }
      await commitDeletes(references, collectionName, onProgress);
    }
  }

  for (const collectionName of COLLECTIONS) {
    await writeBackupDocuments(collectionName, backup.collections[collectionName] || [], mode, onProgress);
  }
}
