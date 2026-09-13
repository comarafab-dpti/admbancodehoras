-- ============================================================================
-- COMARA — Migração 011: Restringir Read Policies Amplas
-- ============================================================================
--
-- Restringe a leitura das coleções administrativas que eram abertas para
-- qualquer usuário autenticado. Agora exigem `is_admin_active()`.
--
-- Tabelas afetadas:
-- - competencias_controle: histórico de fechamentos de competência
-- - canteiros_obras: cadastro de canteiros/sedes
-- - unidades_organizacionais: cadastro de unidades organizacionais
--
-- Motivação: essas coleções contêm dados estratégicos. A leitura deve ser
-- restrita a administradores ativos (não colaboradores finais).
--
-- ============================================================================

-- ============================================================================
-- 1. COMPETENCIAS_CONTROLE — Restringir SELECT
-- ============================================================================

-- Remover policy SELECT ampla existente (se houver)
DROP POLICY IF EXISTS competencias_controle_select ON public.competencias_controle;

-- Nova policy: apenas admins ativos
CREATE POLICY competencias_controle_select ON public.competencias_controle
  FOR SELECT TO authenticated
  USING (public.is_admin_active());

-- Manter policies de escrita inalteradas (UPSERT/DELETE para admins globais)
-- DROP POLICY IF EXISTS competencias_controle_upsert ON public.competencias_controle;
-- CREATE POLICY competencias_controle_upsert ON public.competencias_controle
--   FOR INSERT TO authenticated
--   WITH CHECK (public.is_global_admin());
-- 
-- DROP POLICY IF EXISTS competencias_controle_update ON public.competencias_controle
--   FOR UPDATE TO authenticated
--   USING (public.is_global_admin())
--   WITH CHECK (public.is_global_admin());
-- 
-- DROP POLICY IF EXISTS competencias_controle_delete ON public.competencias_controle
--   FOR DELETE TO authenticated
--   USING (public.is_global_admin());

-- ============================================================================
-- 2. CANTEIROS_OBRAS — Restringir SELECT
-- ============================================================================

-- Remover policy SELECT ampla existente (se houver)
DROP POLICY IF EXISTS canteiros_obras_select ON public.canteiros_obras;

-- Nova policy: apenas admins ativos
CREATE POLICY canteiros_obras_select ON public.canteiros_obras
  FOR SELECT TO authenticated
  USING (public.is_admin_active());

-- Manter policies de escrita inalteradas
-- DROP POLICY IF EXISTS canteiros_obras_insert ON public.canteiros_obras;
-- CREATE POLICY canteiros_obras_insert ON public.canteiros_obras
--   FOR INSERT TO authenticated
--   WITH CHECK (public.is_global_admin());
-- 
-- DROP POLICY IF EXISTS canteiros_obras_update ON public.canteiros_obras
--   FOR UPDATE TO authenticated
--   USING (public.is_global_admin())
--   WITH CHECK (public.is_global_admin());
-- 
-- DROP POLICY IF EXISTS canteiros_obras_delete ON public.canteiros_obras
--   FOR DELETE TO authenticated
--   USING (public.is_global_admin());

-- ============================================================================
-- 3. UNIDADES_ORGANIZACIONAIS — Restringir SELECT
-- ============================================================================

-- Remover policy SELECT ampla existente (se houver)
DROP POLICY IF EXISTS unidades_organizacionais_select ON public.unidades_organizacionais;

-- Nova policy: apenas admins ativos
CREATE POLICY unidades_organizacionais_select ON public.unidades_organizacionais
  FOR SELECT TO authenticated
  USING (public.is_admin_active());

-- Manter policies de escrita inalteradas
-- DROP POLICY IF EXISTS unidades_organizacionais_insert ON public.unidades_organizacionais;
-- CREATE POLICY unidades_organizacionais_insert ON public.unidades_organizacionais
--   FOR INSERT TO authenticated
--   WITH CHECK (public.is_global_admin());
-- 
-- DROP POLICY IF EXISTS unidades_organizacionais_update ON public.unidades_organizacionais
--   FOR UPDATE TO authenticated
--   USING (public.is_global_admin())
--   WITH CHECK (public.is_global_admin());
-- 
-- DROP POLICY IF EXISTS unidades_organizacionais_delete ON public.unidades_organizacionais
--   FOR DELETE TO authenticated
--   USING (public.is_global_admin());

-- ============================================================================
-- Verificação de Saúde
-- ============================================================================
-- Estas queries confirmam que as policies foram aplicadas corretamente:

-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE tablename IN ('competencias_controle', 'canteiros_obras', 'unidades_organizacionais')
-- ORDER BY tablename, policyname;

-- ============================================================================
-- FIM DA MIGRAÇÃO 011
-- ============================================================================
