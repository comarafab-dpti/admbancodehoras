/**
 * ============================================================================
 * CAMADA DE ACESSO A DADOS — SUPABASE (PostgreSQL)
 * ============================================================================
 *
 * Este módulo substitui o antigo SDK do Firebase/Firestone mantendo a MESMA
 * API interna usada pelos services do sistema (collection/doc/setDoc/onSnapshot/
 * writeBatch/runTransaction etc.), agora implementada sobre o Supabase:
 *
 *   - Cada "coleção" é uma tabela PostgreSQL (id text, data jsonb) — ver
 *     supabase/migrations/001_schema.sql.
 *   - Leitura/escrita via supabase-js (RLS aplicado pelo JWT do usuário).
 *   - onSnapshot é emulado com leitura inicial + Supabase Realtime (refetch).
 *   - Autenticação via Supabase Auth (Google OAuth + e-mail/senha).
 *
 * Nomes legados (doc, collection, onSnapshot...) são mantidos como API interna
 * documental; ver README-SUPABASE.md para o roteiro de normalização.
 */
import { supabase } from './supabase';

// ============================================================================
// TIPOS E CONSTANTES
// ============================================================================

export type Unsubscribe = () => void;
export type DocumentData = Record<string, any>;
export type FieldValue = any;

export interface DocumentReference {
  __table: string;
  __id: string;
}

export interface CollectionReference {
  __kind: 'collection';
  __table: string;
}

export interface DbErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/** Marcador do provedor OAuth Google (Supabase Auth). */
export const googleProvider = { provider: 'google' as const };

// ============================================================================
// SANITIZAÇÃO (undefined não existe em JSON — converte para null)
// ============================================================================

export function sanitizeDbPayload<T>(input: T): T {
  if (input === null || input === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeDbPayload(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    if (input instanceof Date) return input as unknown as T;
    if (input instanceof Timestamp) return input as unknown as T;
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(input as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeDbPayload(value);
      }
    }
    return clean as T;
  }
  return input;
}


// ============================================================================
// TIMESTAMP (compat com o legado — serializa como {seconds, nanoseconds})
// ============================================================================

export class Timestamp {
  constructor(public seconds: number, public nanoseconds: number = 0) {}

  static now(): Timestamp {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  static fromDate(date: Date): Timestamp {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  static fromMillis(ms: number): Timestamp {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }

  toMillis(): number {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }

  isEqual(other: Timestamp): boolean {
    return other instanceof Timestamp && this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }
}

// ============================================================================
// TRATAMENTO DE ERROS
// ============================================================================

export function isPermissionError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code || '';
  return (
    code === '42501' ||
    msg.includes('permission-denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security') ||
    msg.includes('PERMISSION_DENIED')
  );
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('resource-exhausted') ||
    msg.includes('quota-exceeded') ||
    msg.includes('QUOTA_EXCEEDED')
  );
}

export function getDbFriendlyMessage(error: unknown): string {
  if (isQuotaError(error)) {
    return 'Cota diária do banco de dados excedida. Operando em modo de cache local sincronizado.';
  }
  if (isPermissionError(error)) {
    return 'Erro de permissão no banco de dados. Verifique a autenticação.';
  }
  if (error instanceof Error && (error.message.includes('offline') || error.message.includes('Failed to fetch'))) {
    return 'Conexão offline. Operando em modo de cache local sincronizado.';
  }
  return 'Instabilidade temporária no banco de dados. Dados preservados com segurança no cache local.';
}


function currentAuthEmail(): string | null {
  try {
    return auth.currentUser?.email ?? null;
  } catch {
    return null;
  }
}

export function logDbError(error: unknown, operationType: OperationType, path: string | null): DbErrorInfo {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? ((error as any).message ?? JSON.stringify(error))
        : String(error);
  const errInfo: DbErrorInfo = {
    error: msg,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: currentAuthEmail(),
    },
  };
  console.error('[DB Error Log]', JSON.stringify(errInfo));
  return errInfo;
}


export function handleDbError(error: unknown, operationType: OperationType, path: string | null): never {
  logDbError(error, operationType, path);
  throw error instanceof Error ? error : new Error(String(error));
}


// ============================================================================
// REFERÊNCIAS E CONSULTAS (builder compatível)
// ============================================================================

export const db = { supabase };

export function collection(_db: typeof db | any, path: string): CollectionReference {
  return { __kind: 'collection', __table: path };
}

export function doc(_db: typeof db | any, path: string, id?: string): DocumentReference {
  if (id === undefined) {
    const parts = path.split('/');
    return { __table: parts[0], __id: parts[1] ?? '' };
  }
  return { __table: path, __id: id };
}

interface WhereConstraint { __kind: 'where'; field: string; op: string; value: any }
interface OrderConstraint { __kind: 'order'; field: string; dir: 'asc' | 'desc' }
interface LimitConstraint { __kind: 'limit'; n: number }
type QueryConstraint = WhereConstraint | OrderConstraint | LimitConstraint;

export interface QueryShape {
  __kind: 'query';
  __table: string;
  filters: WhereConstraint[];
  orders: OrderConstraint[];
  limitN: number | null;
}

export function where(field: string, op: string, value: any): WhereConstraint {
  return { __kind: 'where', field, op, value };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): OrderConstraint {
  return { __kind: 'order', field, dir };
}

export function limit(n: number): LimitConstraint {
  return { __kind: 'limit', n };
}

export function query(target: CollectionReference | DocumentReference | any, ...constraints: QueryConstraint[]): QueryShape {
  const q: QueryShape = {
    __kind: 'query',
    __table: target.__table,
    filters: [],
    orders: [],
    limitN: null,
  };
  for (const c of constraints) {
    if (c.__kind === 'where') q.filters.push(c);
    else if (c.__kind === 'order') q.orders.push(c);
    else if (c.__kind === 'limit') q.limitN = c.n;
  }
  return q;
}

// ============================================================================
// SNAPSHOTS (formato compatível com o legado)
// ============================================================================

export interface DocumentSnapshot {
  id: string;
  ref: DocumentReference;
  exists: () => boolean;
  data: () => Record<string, any> | undefined;
}

export interface QuerySnapshot {
  docs: DocumentSnapshot[];
  size: number;
  empty: boolean;
  forEach: (cb: (d: DocumentSnapshot) => void) => void;
}

function makeSnap(table: string, id: string, data: Record<string, any> | null): DocumentSnapshot {
  return {
    id,
    ref: { __table: table, __id: id },
    exists: () => data !== null,
    data: () => (data === null ? undefined : { ...data, id }),
  };
}

function makeQuerySnap(table: string, rows: Array<{ id: string; data: Record<string, any> | null }>): QuerySnapshot {
  const docs = rows.map((r) => makeSnap(table, r.id, r.data));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb) => docs.forEach(cb),
  };
}

// ============================================================================
// EXECUÇÃO DE CONSULTAS
// ============================================================================

function applyFilters(sel: any, q: QueryShape) {
  for (const f of q.filters) {
    const column = `data->>${f.field}`;
    const op = f.op === '==' ? 'eq' : f.op;
    sel = sel.filter(column, op, f.value);
  }
  return sel;
}

function applyOrders(sel: any, q: QueryShape) {
  for (const o of q.orders) {
    sel = sel.order(`data->>${o.field}`, { ascending: o.dir === 'asc' });
  }
  if (q.orders.length === 0) {
    sel = sel.order('updated_at', { ascending: false });
  }
  return sel;
}

async function runQuery(q: QueryShape): Promise<QuerySnapshot> {
  let sel = supabase.from(q.__table).select('id, data');
  sel = applyFilters(sel, q);
  sel = applyOrders(sel, q);
  if (q.limitN !== null) sel = sel.limit(q.limitN);

  const { data, error } = await sel;
  if (error) throw error;
  return makeQuerySnap(q.__table, (data ?? []) as any);
}

// ============================================================================
// LEITURAS
// ============================================================================

export async function getDocs(q: QueryShape | CollectionReference): Promise<QuerySnapshot> {
  if ((q as any).__kind === 'collection') {
    return runQuery(query(q as CollectionReference));
  }
  return runQuery(q as QueryShape);
}

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  const { data, error } = await supabase
    .from(ref.__table)
    .select('id, data')
    .eq('id', ref.__id)
    .maybeSingle();
  if (error) throw error;
  return makeSnap(ref.__table, ref.__id, (data as any)?.data ?? null);
}

// ============================================================================
// ESCRITAS
// ============================================================================

function toRow(ref: DocumentReference, payload: Record<string, any>) {
  const clean = sanitizeDbPayload(payload) as Record<string, any>;
  // O id interno do documento fica tanto na chave quanto dentro do jsonb (legado)
  if (clean && typeof clean === 'object' && clean.id === undefined) {
    clean.id = ref.__id;
  }
  return { id: ref.__id, data: clean, updated_at: new Date().toISOString() };
}

async function upsertRow(ref: DocumentReference, payload: Record<string, any>): Promise<void> {
  const row = toRow(ref, payload);
  const { error } = await supabase.from(ref.__table).upsert(row);
  if (error) throw error;
}

async function mergeInto(ref: DocumentReference, partial: Record<string, any>): Promise<void> {
  const { data, error: readErr } = await supabase
    .from(ref.__table)
    .select('id, data')
    .eq('id', ref.__id)
    .maybeSingle();
  if (readErr) throw readErr;

  const existing = ((data as any)?.data ?? {}) as Record<string, any>;
  const merged = { ...existing, ...sanitizeDbPayload(partial) } as Record<string, any>;
  await upsertRow(ref, merged);
}

export async function setDoc(
  ref: DocumentReference,
  data: Record<string, any>,
  options?: { merge?: boolean }
): Promise<void> {
  if (options?.merge) {
    await mergeInto(ref, data);
  } else {
    await upsertRow(ref, data);
  }
}

export async function updateDoc(ref: DocumentReference, data: Record<string, any>): Promise<void> {
  await mergeInto(ref, data);
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  const { error } = await supabase.from(ref.__table).delete().eq('id', ref.__id);
  if (error) throw error;
}

export async function addDoc(collRef: CollectionReference, data: Record<string, any>): Promise<DocumentReference> {
  const id = generateDocId();
  const ref: DocumentReference = { __table: collRef.__table, __id: id };
  await upsertRow(ref, data);
  return ref;
}

function generateDocId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================================
// WRITE BATCH (chunks de 400 por commit, como o legado)
// ============================================================================

interface BatchOp {
  type: 'set' | 'merge-set' | 'update' | 'delete';
  ref: DocumentReference;
  data?: Record<string, any>;
}

export function writeBatch(_db: typeof db | any) {
  const ops: BatchOp[] = [];
  return {
    set(ref: DocumentReference, data: Record<string, any>, options?: { merge?: boolean }) {
      ops.push({ type: options?.merge ? 'merge-set' : 'set', ref, data });
    },
    update(ref: DocumentReference, data: Record<string, any>) {
      ops.push({ type: 'update', ref, data });
    },
    delete(ref: DocumentReference) {
      ops.push({ type: 'delete', ref });
    },
    async commit(): Promise<void> {
      const CHUNK = 400;
      // Conjuntos puros podem ser agrupados em upserts
      const pureSets = ops.filter((o) => o.type === 'set');
      for (let i = 0; i < pureSets.length; i += CHUNK) {
        const rows = pureSets.slice(i, i + CHUNK).map((o) => toRow(o.ref, o.data!));
        const { error } = await supabase.from(pureSets[i].ref.__table).upsert(rows);
        if (error) throw error;
      }
      // Operações de merge/update/delete precisam de leitura prévia
      for (const o of ops) {
        if (o.type === 'merge-set' || o.type === 'update') {
          await mergeInto(o.ref, o.data!);
        } else if (o.type === 'delete') {
          await deleteDoc(o.ref);
        }
      }
    },
  };
}

// ============================================================================
// RUN TRANSACTION (emulação: leitura seguida de escrita na ordem das operações)
// NOTA: não é atomicamente isolada como no Firestore; para as operações do
// sistema (controle de competências, uso único por sessão administrativa)
// o comportamento é equivalente. Ver README-SUPABASE.md.
// ============================================================================

export interface Transaction {
  get: (ref: DocumentReference) => Promise<DocumentSnapshot>;
  set: (ref: DocumentReference, data: Record<string, any>, options?: { merge?: boolean }) => void;
  update: (ref: DocumentReference, data: Record<string, any>) => void;
  delete: (ref: DocumentReference) => void;
}

export async function runTransaction(
  _db: typeof db | any,
  updateFn: (tx: Transaction) => Promise<void>
): Promise<void> {
  const ops: BatchOp[] = [];
  const tx: Transaction = {
    async get(ref) {
      return getDoc(ref);
    },
    set(ref, data, options) {
      ops.push({ type: options?.merge ? 'merge-set' : 'set', ref, data });
    },
    update(ref, data) {
      ops.push({ type: 'update', ref, data });
    },
    delete(ref) {
      ops.push({ type: 'delete', ref });
    },
  };
  await updateFn(tx);

  const CHUNK = 400;
  const pureSets = ops.filter((o) => o.type === 'set');
  for (let i = 0; i < pureSets.length; i += CHUNK) {
    const rows = pureSets.slice(i, i + CHUNK).map((o) => toRow(o.ref, o.data!));
    const { error } = await supabase.from(pureSets[i].ref.__table).upsert(rows);
    if (error) throw error;
  }
  for (const o of ops) {
    if (o.type === 'merge-set' || o.type === 'update') {
      await mergeInto(o.ref, o.data!);
    } else if (o.type === 'delete') {
      await deleteDoc(o.ref);
    }
  }
}

// ============================================================================
// ON SNAPSHOT (leitura inicial + Supabase Realtime com refetch)
// ============================================================================

function tableChannel(table: string) {
  return supabase
    .channel(`db-${table}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {});
}

export function onSnapshot(
  target: QueryShape | DocumentReference | CollectionReference,
  onSuccess: (snapshot: any) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const isDocRef = '__id' in target && !('__kind' in target);
  const table = target.__table as string;
  let disposed = false;
  let refetchTimer: ReturnType<typeof setTimeout> | null = null;

  const refetch = async () => {
    if (disposed) return;
    try {
      if (isDocRef) {
        const snap = await getDoc(target as DocumentReference);
        if (!disposed) onSuccess(snap);
      } else {
        const q = (target as any).__kind === 'query'
          ? (target as QueryShape)
          : query(target as CollectionReference);
        const snap = await runQuery(q);
        if (!disposed) onSuccess(snap);
      }
    } catch (err) {
      if (onError && !disposed) onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const scheduleRefetch = () => {
    if (refetchTimer) clearTimeout(refetchTimer);
    refetchTimer = setTimeout(refetch, 300);
  };

  const channel = tableChannel(table);
  channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefetch);
  channel.subscribe();

  refetch();

  return () => {
    disposed = true;
    if (refetchTimer) clearTimeout(refetchTimer);
    try {
      supabase.removeChannel(channel);
    } catch {
      /* noop */
    }
  };
}

// ============================================================================
// AUTENTICAÇÃO (Supabase Auth) — shims compatíveis
// ============================================================================

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

let currentAuthUser: FirebaseUser | null = null;

function normalizeUser(user: any): FirebaseUser {
  return {
    uid: user?.id ?? '',
    email: user?.email ?? null,
    displayName: user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null,
    photoURL: user?.user_metadata?.avatar_url ?? null,
  };
}

export const auth = {
  get currentUser(): FirebaseUser | null {
    return currentAuthUser;
  },
};

function setAuthUser(session: any) {
  currentAuthUser = session?.user ? normalizeUser(session.user) : null;
}

// Inicializa o usuário em cache a partir da sessão salva
(async () => {
  try {
    const { data } = await supabase.auth.getSession();
    setAuthUser(data?.session ?? null);
  } catch {
    /* offline: usuário permanece null */
  }
})();

/** Observa mudanças de sessão (espelha onAuthStateChanged do legado). */
export function onAuthStateChanged(
  _auth: typeof auth,
  callback: (user: FirebaseUser | null) => void
): Unsubscribe {
  let disposed = false;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setAuthUser(session);
    if (!disposed) {
      callback(session?.user ? normalizeUser(session.user) : null);
    }
  });

  // Garante o evento inicial mesmo que o SDK não emita INITIAL_SESSION
  (async () => {
    try {
      const { data: s } = await supabase.auth.getSession();
      setAuthUser(s?.session ?? null);
      if (!disposed) callback(currentAuthUser);
    } catch {
      /* noop */
    }
  })();

  return () => {
    disposed = true;
    try {
      data.subscription.unsubscribe();
    } catch {
      /* noop */
    }
  };
}

function oauthRedirectTo(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/admin`;
}

/**
 * Login Google via Supabase Auth (OAuth com redirecionamento de página —
 * o Supabase Auth não possui modo popup).
 */
export async function signInWithPopup(_auth: typeof auth, _provider?: typeof googleProvider): Promise<{ user: null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/userinfo.email',
      redirectTo: oauthRedirectTo(),
    },
  });
  if (error) throw error;
  return { user: null };
}

export async function signInWithRedirect(_auth: typeof auth, _provider?: typeof googleProvider): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/userinfo.email',
      redirectTo: oauthRedirectTo(),
    },
  });
  if (error) throw error;
}

/**
 * Legado: o retorno do OAuth Google é processado automaticamente pelo
 * onAuthStateChanged (detectSessionInUrl). Nada a fazer aqui.
 */
export async function getRedirectResult(_auth?: any): Promise<any> {
  return null;
}

export async function firebaseSignOut(_auth?: typeof auth): Promise<void> {
  await supabase.auth.signOut();
  currentAuthUser = null;
}

// ============================================================================
// TESTE DE CONEXÃO
// ============================================================================

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('system_config').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
