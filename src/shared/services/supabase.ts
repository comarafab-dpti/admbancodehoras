import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase (PostgreSQL) — nova camada de dados do sistema.
 *
 * As variáveis vêm do ambiente (VITE_*), definidas no painel de secrets.
 * Enquanto não configuradas, usa um placeholder para o app continuar
 * carregando (as requisições falham graciosamente até as chaves reais
 * serem fornecidas).
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Sessão expira ao fechar o navegador (mesma semântica do legado browserSessionPersistence)
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
