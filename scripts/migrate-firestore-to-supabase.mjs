#!/usr/bin/env node
/**
 * ============================================================================
 * MIGRAÇÃO DE DADOS — FIRESTORE (JSON) → SUPABASE (PostgreSQL)
 * ============================================================================
 *
 * Uso:
 *   1. Exporte cada coleção do Firebase Console como JSON para a pasta
 *      scripts/firestore-export/ (um arquivo por coleção, ex.: colaboradores.json).
 *      Formatos aceitos por arquivo:
 *        a) Array de documentos:  [ { ...campos }, ... ]
 *           - O ID do documento é obtido do campo "__docId" | "__name__" | "id",
 *             se presente; caso contrário, informe o formato (b).
 *        b) Mapa { idDoDocumento: { ...campos } }
 *   2. Configure as variáveis de ambiente (ou um .env na raiz):
 *        SUPABASE_URL=https://<projeto>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service_role — NUNCA exponha no frontend>
 *   3. Execute:  npm run migrate:firestore
 *
 * O script usa a service_role key (bypassa RLS) e insere na ordem de
 * dependência. Ao final, valida a contagem de registros por tabela.
 * ============================================================================
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXPORT_DIR = path.join(__dirname, 'firestore-export');

// Ordem respeitando dependências lógicas
const COLLECTION_ORDER = [
  'canteiros_obras',
  'canteiros',
  'unidades_organizacionais',
  'admin_users',
  'usuarios_sistema',
  'colaboradores_auth',
  'colaboradores',
  'competencias_controle',
  'lancamentos',
  'dispensas_sptf',
  'contracheques',
  'insalubridade_records',
  'insalubridade',
  'resumo_mensal',
  'system_config',
  'institution_settings',
  'system_logs',
  'logs_auditoria',
  'logs_acesso',
];

function loadJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

/**
 * Normaliza o export para [{ id, data }] conforme o formato aceito.
 */
function normalizeExport(fileName, parsed) {
  const docs = [];

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      // Wrapper { id, data } ou documento direto
      if (item.__docId || item.__name__) {
        const id = String(item.__docId || item.__name__);
        const data = item.data && typeof item.data === 'object' && !Array.isArray(item.data) ? item.data : item;
        docs.push({ id, data: data.id === undefined ? { ...data, id } : data });
      } else if (typeof item.id === 'string' || typeof item.id === 'number') {
        docs.push({ id: String(item.id), data: item });
      } else if (typeof item.matricula === 'string') {
        docs.push({ id: item.matricula.toUpperCase(), data: item });
      } else {
        throw new Error(
          `Documento em ${fileName} sem ID identificável. Exporte a coleção no formato { "idDoDocumento": { ...campos } } ou garanta que cada documento tenha o campo "id".`
        );
      }
    }
    return docs;
  }

  if (parsed && typeof parsed === 'object') {
    for (const [id, data] of Object.entries(parsed)) {
      if (data && typeof data === 'object') {
        docs.push({ id: String(id), data: { ...data, id: data.id ?? String(id) } });
      }
    }
    return docs;
  }

  throw new Error(`Formato não reconhecido em ${fileName}.`);
}

async function migrate() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de executar.');
    process.exit(1);
  }
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error(`Pasta de export não encontrada: ${EXPORT_DIR}`);
    console.error('Crie a pasta e adicione um arquivo JSON por coleção (ver cabeçalho do script).');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];

  for (const coll of COLLECTION_ORDER) {
    const file = path.join(EXPORT_DIR, `${coll}.json`);
    if (!fs.existsSync(file)) {
      console.log(`— ${coll}: (sem export, pulando)`);
      continue;
    }

    const docs = normalizeExport(file, loadJson(file));
    console.log(`— ${coll}: ${docs.length} documento(s) do export`);

    // Remove chaves com valor undefined (inválidas em JSON)
    const CHUNK = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < docs.length; i += CHUNK) {
      const rows = docs.slice(i, i + CHUNK).map(({ id, data }) => {
        const clean = JSON.parse(
          JSON.stringify(data, (k, v) => (v === undefined ? null : v))
        );
        return { id, data: clean, updated_at: new Date().toISOString() };
      });

      const { error } = await supabase.from(coll).upsert(rows, { onConflict: 'id' });
      if (error) {
        errors++;
        console.error(`  ERRO no lote ${i / CHUNK + 1}: ${error.message}`);
      } else {
        inserted += rows.length;
      }
    }

    // Validação de contagem
    const { count, error: countErr } = await supabase
      .from(coll)
      .select('id', { count: 'exact', head: true });
    results.push({ table: coll, export: docs.length, inserted, db: countErr ? '?' : count, errors });
    console.log(`  inseridos: ${inserted}, total na tabela: ${countErr ? '?' : count}${errors ? `, lotes com erro: ${errors}` : ''}`);
  }

  console.log('\n================ RESUMO ================');
  console.table(results);
  console.log('Migração concluída. Compare "export" e "db" — devem ser iguais.');
}

migrate().catch((err) => {
  console.error('Falha na migração:', err);
  process.exit(1);
});
