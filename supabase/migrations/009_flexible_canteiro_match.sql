-- ============================================================================
-- COMARA SPTF — Migração 009: Match Flexível de Canteiros nas Funções RLS
-- ============================================================================
-- Motivação (Onda 2B):
-- 1. As funções contracheque_canteiro_permitido, documento_do_meu_canteiro e
--    canteiro_permitido realizavam comparações de igualdade estrita entre o
--    canteiro do usuário (ex.: 'KO') e os campos do documento.
-- 2. Nos contracheques e outros registros legados/folha, os canteiros costumam
--    vir com sufixos ou prefixos como 'KO-DL', 'DECO-MN', 'BE-SEDE'.
-- 3. A checagem estrita retornava falso para perfis restritos ao canteiro
--    (como AUX_DA em Coari 'KO'), deixando suas consultas vazias.
--
-- Solução:
-- 1. Atualizar contracheque_canteiro_permitido, documento_do_meu_canteiro e
--    canteiro_permitido com correspondência flexível (igualdade exata, prefixo
--    com hífen, sufixo com hífen ou substring).
-- 2. Considerar também o campo 'secaoCanteiro' além de employeeSede, sedeCodigo e sede.
-- 3. Manter SECURITY DEFINER e SET search_path = public, pg_temp.
-- 4. Conceder explicitamente privilégios de execução a authenticated e anon.
-- ============================================================================

-- 1. CONTRACHEQUE CANTEIRO PERMITIDO (Flexível)
CREATE OR REPLACE FUNCTION public.contracheque_canteiro_permitido(doc jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_global_admin()
      OR (
        public.is_admin_active()
        AND (
          public.meu_canteiro() = 'TODAS'
          OR EXISTS (
            SELECT 1 FROM unnest(ARRAY[
              doc ->> 'employeeSede',
              doc ->> 'sedeCodigo',
              doc ->> 'sede',
              doc ->> 'secaoCanteiro'
            ]) AS v(valor)
            WHERE valor IS NOT NULL
              AND valor <> ''
              AND (
                valor = public.meu_canteiro()
                OR valor LIKE public.meu_canteiro() || '-%'
                OR valor LIKE '%-' || public.meu_canteiro()
                OR valor LIKE '%' || public.meu_canteiro() || '%'
              )
          )
        )
      )
$$;

-- 2. DOCUMENTO DO MEU CANTEIRO (Flexível para lançamentos, insalubridade, dispensas, etc.)
CREATE OR REPLACE FUNCTION public.documento_do_meu_canteiro(doc jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.meu_canteiro() = 'TODAS'
    OR (
      public.meu_canteiro() <> ''
      AND EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          doc ->> 'employeeSede',
          doc ->> 'sedeCodigo',
          doc ->> 'sede',
          doc ->> 'secaoCanteiro'
        ]) AS v(valor)
        WHERE valor IS NOT NULL
          AND valor <> ''
          AND (
            valor = public.meu_canteiro()
            OR valor LIKE public.meu_canteiro() || '-%'
            OR valor LIKE '%-' || public.meu_canteiro()
            OR valor LIKE '%' || public.meu_canteiro() || '%'
          )
      )
    )
$$;

-- 3. CANTEIRO PERMITIDO (Flexível para verificação pontual de código de canteiro)
CREATE OR REPLACE FUNCTION public.canteiro_permitido(canteiro text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_global_admin()
      OR (
        public.is_admin_active()
        AND (
          public.meu_canteiro() = 'TODAS'
          OR (
            canteiro IS NOT NULL
            AND canteiro <> ''
            AND (
              canteiro = public.meu_canteiro()
              OR canteiro LIKE public.meu_canteiro() || '-%'
              OR canteiro LIKE '%-' || public.meu_canteiro()
              OR canteiro LIKE '%' || public.meu_canteiro() || '%'
            )
          )
        )
      )
$$;

-- ----------------------------------------------------------------------------
-- 4. CONCESSÃO EXPLÍCITA DE PRIVILÉGIOS DE EXECUÇÃO
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT EXECUTE ON FUNCTION public.contracheque_canteiro_permitido(jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.documento_do_meu_canteiro(jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.canteiro_permitido(text) TO authenticated, anon;
