import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase (PostgreSQL) — camada de dados e autenticação oficial.
 *
 * As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são injetadas
 * em tempo de build pelo Vite a partir do ambiente ou dos arquivos .env.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log de diagnóstico no boot
console.log('[Supabase] URL configurada:', SUPABASE_URL);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Supabase] Configuração ausente! As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ' +
    'devem ser obrigatoriamente configuradas no ambiente de build.'
  );
}

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
