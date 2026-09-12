import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase (PostgreSQL) — camada de dados e autenticação oficial.
 *
 * As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são injetadas
 * em tempo de build pelo Vite a partir do ambiente ou dos arquivos .env.
 */
const isProd = typeof import.meta !== 'undefined' && Boolean((import.meta as any)?.env?.PROD);
const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any)?.env ? (import.meta as any).env : {};

const rawUrl = metaEnv.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '');
const rawKey = metaEnv.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '');

if (isProd) {
  if (!rawUrl) {
    throw new Error('[Supabase] VITE_SUPABASE_URL não configurada em produção. Verifique as env vars da plataforma de hospedagem.');
  }
  if (!rawKey) {
    throw new Error('[Supabase] VITE_SUPABASE_ANON_KEY não configurada em produção. Verifique as env vars da plataforma de hospedagem.');
  }
}

// Em desenvolvimento ou testes unitários locais, aceita fallback caso as variáveis estejam ausentes
const SUPABASE_URL = rawUrl || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = rawKey || 'placeholder-anon-key';

// Log de diagnóstico no boot
console.log('[Supabase] URL configurada:', SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Sessão persistente no navegador
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Teste de conectividade com o banco (espelha o legado testConnection). */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('system_config').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
