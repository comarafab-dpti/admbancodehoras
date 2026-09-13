-- ============================================================================
-- COMARA — Migração 010: Normalização dos Dados Migrados do Firestore
-- ============================================================================
--
-- Corrige 3 tipos de inconsistência identificados na auditoria de migração:
--   1. Timestamps em formato Firestore ({_seconds, _nanoseconds} → ISO-8601)
--   2. Campos de sede não padronizados (sedeCodigo extraído de sede)
--   3. Competência ausente ou inválida (derivada de dataRegistro ou mesAno)
--
-- IDEMPOTENTE: seguro para reexecução. Os WHERE filtram apenas registros
-- que ainda não foram normalizados.
--
-- ⚠️ IMPORTANTE: NÃO atualiza updated_at nas linhas, para não embaralhar
-- a ordenação por updated_at DESC. A auditoria fica em logs_normalizacao.
-- ============================================================================

-- ============================================================================
-- PASSO 1: Criar tabela de auditoria para rastrear alterações
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.logs_normalizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  documento_id text NOT NULL,
  campo text NOT NULL,
  valor_anterior jsonb,
  valor_novo jsonb,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_normalizacao_tabela
  ON public.logs_normalizacao (tabela, criado_em DESC);

ALTER TABLE public.logs_normalizacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS logs_normalizacao_select ON public.logs_normalizacao;
CREATE POLICY logs_normalizacao_select ON public.logs_normalizacao
  FOR SELECT TO authenticated
  USING (public.is_global_admin());

DROP POLICY IF EXISTS logs_normalizacao_insert ON public.logs_normalizacao;
CREATE POLICY logs_normalizacao_insert ON public.logs_normalizacao
  FOR INSERT TO authenticated
  WITH CHECK (public.is_global_admin());

-- ============================================================================
-- PASSO 2: Função auxiliar para conversão de timestamp Firestore → ISO-8601
-- ============================================================================

CREATE OR REPLACE FUNCTION public.firestore_ts_to_iso(valor jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN valor IS NULL THEN NULL
    WHEN jsonb_typeof(valor) = 'string' THEN valor #>> '{}'
    WHEN jsonb_typeof(valor) = 'object'
      AND (valor ? '_seconds')
      AND (valor ->> '_seconds') ~ '^\d+$'
    THEN to_char(
      to_timestamp((valor ->> '_seconds')::bigint),
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
    ELSE NULL
  END
$$;

-- ============================================================================
-- PASSO 3: Converter timestamps em LANCAMENTOS
-- ============================================================================

-- criadoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.lancamentos
  WHERE jsonb_typeof(data -> 'criadoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'lancamentos', id, 'criadoEm', data -> 'criadoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'criadoEm'))
FROM docs_para_converter;

UPDATE public.lancamentos
SET data = jsonb_set(data, '{criadoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'criadoEm')))
WHERE jsonb_typeof(data -> 'criadoEm') = 'object';

-- atualizadoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.lancamentos
  WHERE jsonb_typeof(data -> 'atualizadoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'lancamentos', id, 'atualizadoEm', data -> 'atualizadoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'atualizadoEm'))
FROM docs_para_converter;

UPDATE public.lancamentos
SET data = jsonb_set(data, '{atualizadoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'atualizadoEm')))
WHERE jsonb_typeof(data -> 'atualizadoEm') = 'object';

-- dataRegistro
WITH docs_para_converter AS (
  SELECT id, data FROM public.lancamentos
  WHERE jsonb_typeof(data -> 'dataRegistro') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'lancamentos', id, 'dataRegistro', data -> 'dataRegistro',
       to_jsonb(public.firestore_ts_to_iso(data -> 'dataRegistro'))
FROM docs_para_converter;

UPDATE public.lancamentos
SET data = jsonb_set(data, '{dataRegistro}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'dataRegistro')))
WHERE jsonb_typeof(data -> 'dataRegistro') = 'object';

-- ============================================================================
-- PASSO 3b: Converter timestamps em DISPENSAS_SPTF
-- ============================================================================

-- emitidoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.dispensas_sptf
  WHERE jsonb_typeof(data -> 'emitidoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'dispensas_sptf', id, 'emitidoEm', data -> 'emitidoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'emitidoEm'))
FROM docs_para_converter;

UPDATE public.dispensas_sptf
SET data = jsonb_set(data, '{emitidoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'emitidoEm')))
WHERE jsonb_typeof(data -> 'emitidoEm') = 'object';

-- data
WITH docs_para_converter AS (
  SELECT id, data FROM public.dispensas_sptf
  WHERE jsonb_typeof(data -> 'data') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'dispensas_sptf', id, 'data', data -> 'data',
       to_jsonb(public.firestore_ts_to_iso(data -> 'data'))
FROM docs_para_converter;

UPDATE public.dispensas_sptf
SET data = jsonb_set(data, '{data}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'data')))
WHERE jsonb_typeof(data -> 'data') = 'object';

-- ============================================================================
-- PASSO 3c: Converter timestamps em CONTRACHEQUES
-- ============================================================================

-- importadoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.contracheques
  WHERE jsonb_typeof(data -> 'importadoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'contracheques', id, 'importadoEm', data -> 'importadoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'importadoEm'))
FROM docs_para_converter;

UPDATE public.contracheques
SET data = jsonb_set(data, '{importadoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'importadoEm')))
WHERE jsonb_typeof(data -> 'importadoEm') = 'object';

-- ============================================================================
-- PASSO 3d: Converter timestamps em INSALUBRIDADE_RECORDS
-- ============================================================================

-- criadoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.insalubridade_records
  WHERE jsonb_typeof(data -> 'criadoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'insalubridade_records', id, 'criadoEm', data -> 'criadoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'criadoEm'))
FROM docs_para_converter;

UPDATE public.insalubridade_records
SET data = jsonb_set(data, '{criadoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'criadoEm')))
WHERE jsonb_typeof(data -> 'criadoEm') = 'object';

-- dataEvento
WITH docs_para_converter AS (
  SELECT id, data FROM public.insalubridade_records
  WHERE jsonb_typeof(data -> 'dataEvento') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'insalubridade_records', id, 'dataEvento', data -> 'dataEvento',
       to_jsonb(public.firestore_ts_to_iso(data -> 'dataEvento'))
FROM docs_para_converter;

UPDATE public.insalubridade_records
SET data = jsonb_set(data, '{dataEvento}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'dataEvento')))
WHERE jsonb_typeof(data -> 'dataEvento') = 'object';

-- ============================================================================
-- PASSO 3e: Converter timestamps em COMPETENCIAS_CONTROLE
-- ============================================================================

-- fechadoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.competencias_controle
  WHERE jsonb_typeof(data -> 'fechadoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'competencias_controle', id, 'fechadoEm', data -> 'fechadoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'fechadoEm'))
FROM docs_para_converter;

UPDATE public.competencias_controle
SET data = jsonb_set(data, '{fechadoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'fechadoEm')))
WHERE jsonb_typeof(data -> 'fechadoEm') = 'object';

-- ============================================================================
-- PASSO 3f: Converter timestamps em ADMIN_USERS
-- ============================================================================

-- criadoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.admin_users
  WHERE jsonb_typeof(data -> 'criadoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'admin_users', id, 'criadoEm', data -> 'criadoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'criadoEm'))
FROM docs_para_converter;

UPDATE public.admin_users
SET data = jsonb_set(data, '{criadoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'criadoEm')))
WHERE jsonb_typeof(data -> 'criadoEm') = 'object';

-- atualizadoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.admin_users
  WHERE jsonb_typeof(data -> 'atualizadoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'admin_users', id, 'atualizadoEm', data -> 'atualizadoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'atualizadoEm'))
FROM docs_para_converter;

UPDATE public.admin_users
SET data = jsonb_set(data, '{atualizadoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'atualizadoEm')))
WHERE jsonb_typeof(data -> 'atualizadoEm') = 'object';

-- ============================================================================
-- PASSO 3g: Converter timestamps em LOGS_AUDITORIA
-- ============================================================================

-- criadoEm
WITH docs_para_converter AS (
  SELECT id, data FROM public.logs_auditoria
  WHERE jsonb_typeof(data -> 'criadoEm') = 'object'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'logs_auditoria', id, 'criadoEm', data -> 'criadoEm',
       to_jsonb(public.firestore_ts_to_iso(data -> 'criadoEm'))
FROM docs_para_converter;

UPDATE public.logs_auditoria
SET data = jsonb_set(data, '{criadoEm}',
       to_jsonb(public.firestore_ts_to_iso(data -> 'criadoEm')))
WHERE jsonb_typeof(data -> 'criadoEm') = 'object';

-- ============================================================================
-- PASSO 4: Normalizar campos de sede em COLABORADORES
-- ============================================================================

WITH docs AS (
  SELECT id, data FROM public.colaboradores
  WHERE (data ->> 'sedeCodigo') IS NULL
    AND (data ->> 'sede') IS NOT NULL
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'colaboradores', id, 'sedeCodigo', NULL,
       to_jsonb(split_part(data ->> 'sede', '-', 1))
FROM docs;

UPDATE public.colaboradores
SET data = jsonb_set(data, '{sedeCodigo}',
       to_jsonb(split_part(data ->> 'sede', '-', 1)))
WHERE (data ->> 'sedeCodigo') IS NULL
  AND (data ->> 'sede') IS NOT NULL;

-- ============================================================================
-- PASSO 4b: Normalizar campos de sede em LANCAMENTOS
-- ============================================================================

WITH docs AS (
  SELECT id, data FROM public.lancamentos
  WHERE (data ->> 'sedeCodigo') IS NULL
    AND (data ->> 'sede') IS NOT NULL
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'lancamentos', id, 'sedeCodigo', NULL,
       to_jsonb(split_part(data ->> 'sede', '-', 1))
FROM docs;

UPDATE public.lancamentos
SET data = jsonb_set(data, '{sedeCodigo}',
       to_jsonb(split_part(data ->> 'sede', '-', 1)))
WHERE (data ->> 'sedeCodigo') IS NULL
  AND (data ->> 'sede') IS NOT NULL;

-- ============================================================================
-- PASSO 4c: Normalizar campos de sede em DISPENSAS_SPTF
-- ============================================================================

WITH docs AS (
  SELECT id, data FROM public.dispensas_sptf
  WHERE (data ->> 'sedeCodigo') IS NULL
    AND (data ->> 'employeeSede') IS NULL
    AND (data ->> 'sede') IS NOT NULL
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'dispensas_sptf', id, 'sedeCodigo', NULL,
       to_jsonb(split_part(data ->> 'sede', '-', 1))
FROM docs;

UPDATE public.dispensas_sptf
SET data = jsonb_set(data, '{sedeCodigo}',
       to_jsonb(split_part(data ->> 'sede', '-', 1)))
WHERE (data ->> 'sedeCodigo') IS NULL
  AND (data ->> 'sede') IS NOT NULL;

-- Preencher employeeSede a partir de sedeCodigo
WITH docs AS (
  SELECT id, data FROM public.dispensas_sptf
  WHERE (data ->> 'employeeSede') IS NULL
    AND (data ->> 'sedeCodigo') IS NOT NULL
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'dispensas_sptf', id, 'employeeSede', NULL, data -> 'sedeCodigo'
FROM docs;

UPDATE public.dispensas_sptf
SET data = jsonb_set(data, '{employeeSede}', data -> 'sedeCodigo')
WHERE (data ->> 'employeeSede') IS NULL
  AND (data ->> 'sedeCodigo') IS NOT NULL;

-- ============================================================================
-- PASSO 4d: Normalizar campos de sede em CONTRACHEQUES
-- ============================================================================

WITH docs AS (
  SELECT id, data FROM public.contracheques
  WHERE (data ->> 'sedeCodigo') IS NULL
    AND (data ->> 'sede') IS NOT NULL
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'contracheques', id, 'sedeCodigo', NULL,
       to_jsonb(split_part(data ->> 'sede', '-', 1))
FROM docs;

UPDATE public.contracheques
SET data = jsonb_set(data, '{sedeCodigo}',
       to_jsonb(split_part(data ->> 'sede', '-', 1)))
WHERE (data ->> 'sedeCodigo') IS NULL
  AND (data ->> 'sede') IS NOT NULL;

-- ============================================================================
-- PASSO 4e: Normalizar campos de sede em INSALUBRIDADE_RECORDS
-- ============================================================================

WITH docs AS (
  SELECT id, data FROM public.insalubridade_records
  WHERE (data ->> 'sedeCodigo') IS NULL
    AND (data ->> 'sede') IS NOT NULL
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'insalubridade_records', id, 'sedeCodigo', NULL,
       to_jsonb(split_part(data ->> 'sede', '-', 1))
FROM docs;

UPDATE public.insalubridade_records
SET data = jsonb_set(data, '{sedeCodigo}',
       to_jsonb(split_part(data ->> 'sede', '-', 1)))
WHERE (data ->> 'sedeCodigo') IS NULL
  AND (data ->> 'sede') IS NOT NULL;

-- ============================================================================
-- PASSO 5: Derivar competência em LANCAMENTOS
-- ============================================================================

WITH docs AS (
  SELECT id, data FROM public.lancamentos
  WHERE (data ->> 'competencia') IS NULL
    AND (data ->> 'dataRegistro') IS NOT NULL
    AND (data ->> 'dataRegistro') ~ '^\d{4}-\d{2}'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'lancamentos', id, 'competencia', NULL,
       to_jsonb(substring(data ->> 'dataRegistro' FROM 1 FOR 7))
FROM docs;

UPDATE public.lancamentos
SET data = jsonb_set(data, '{competencia}',
       to_jsonb(substring(data ->> 'dataRegistro' FROM 1 FOR 7)))
WHERE (data ->> 'competencia') IS NULL
  AND (data ->> 'dataRegistro') IS NOT NULL
  AND (data ->> 'dataRegistro') ~ '^\d{4}-\d{2}';

-- ============================================================================
-- PASSO 5b: Derivar competência em CONTRACHEQUES
-- ============================================================================

WITH docs AS (
  SELECT id, data FROM public.contracheques
  WHERE (data ->> 'competencia') IS NULL
    AND (data ->> 'mesAno') ~ '^\d{2}-\d{4}$'
)
INSERT INTO public.logs_normalizacao (tabela, documento_id, campo, valor_anterior, valor_novo)
SELECT 'contracheques', id, 'competencia', NULL,
       to_jsonb(
         substring(data ->> 'mesAno' FROM 4 FOR 4) || '-' ||
         substring(data ->> 'mesAno' FROM 1 FOR 2)
       )
FROM docs;

UPDATE public.contracheques
SET data = jsonb_set(data, '{competencia}',
       to_jsonb(
         substring(data ->> 'mesAno' FROM 4 FOR 4) || '-' ||
         substring(data ->> 'mesAno' FROM 1 FOR 2)
       ))
WHERE (data ->> 'competencia') IS NULL
  AND (data ->> 'mesAno') ~ '^\d{2}-\d{4}$';

-- ============================================================================
-- FIM DA MIGRAÇÃO 010
-- ============================================================================