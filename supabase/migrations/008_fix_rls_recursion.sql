-- ============================================================================
-- COMARA SPTF — Migração 008: Correção Definitiva da Recursão RLS e Permissões
-- ============================================================================
-- Diagnóstico da falha (Onda 1):
-- 1. A migração 006 removeu SECURITY DEFINER de has_admin_doc(), tornando-a
--    SECURITY INVOKER. Como has_admin_doc() faz SELECT em public.admin_users, e
--    a policy admin_users_select chama is_super_admin() -> is_admin_active() ->
--    has_admin_doc(), criou-se um ciclo de recursão infinita.
-- 2. Para usuários sem e-mail master (especialmente perfis de campo como AUX_DA),
--    toda consulta a admin_users ou qualquer tabela protegida disparava o erro
--    54001: "stack depth limit exceeded" (HTTP 500 no PostgREST).
-- 3. Além disso, a revogação de privilégios de execução no passado gerava o
--    erro 42501 ("permission denied for function meu_canteiro").
--
-- Solução implementada nesta migração:
-- 1. Recriar TODAS as funções de autenticação e RBAC (especialmente has_admin_doc,
--    admin_data, is_admin_active e is_super_admin) como SECURITY DEFINER com
--    search_path = public, pg_temp explícito e fixo.
--    Ao rodar como SECURITY DEFINER (com privilégios de owner/postgres), as
--    leituras internas em admin_users IGNORAM as políticas RLS, eliminando por
--    completo a recursão infinita (erro 54001).
-- 2. Conceder explicitamente GRANT EXECUTE ao papel 'authenticated' (e 'anon') em
--    todas as funções do schema public.
--
-- REGRA DE OURO SOBRE GRANT EXECUTE:
-- NUNCA revogue o privilégio EXECUTE de funções públicas utilizadas por políticas
-- RLS. No PostgreSQL, quando uma política RLS é avaliada sob o papel 'authenticated',
-- o banco EXIGE permissão de execução nas funções que compõem a expressão da policy,
-- mesmo quando declaradas como SECURITY DEFINER. Revogar EXECUTE resulta no erro 42501.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNÇÕES DE SUPORTE À IDENTIDADE E ACESSO (SECURITY DEFINER + search_path)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.meu_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

CREATE OR REPLACE FUNCTION public.is_master_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.meu_email() IN ('comarafab@gmail.com', 'coari.comara@gmail.com')
$$;

-- Leitura de admin_users executada como owner (postgres), ignorando RLS
CREATE OR REPLACE FUNCTION public.admin_data()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.data 
    FROM public.admin_users a 
   WHERE lower(a.id) = public.meu_email() 
   LIMIT 1
$$;

-- Verificação de existência em admin_users executada como owner (postgres), ignorando RLS
CREATE OR REPLACE FUNCTION public.has_admin_doc()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
      FROM public.admin_users a 
     WHERE lower(a.id) = public.meu_email()
  )
$$;

CREATE OR REPLACE FUNCTION public.raw_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'nivel_acesso', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'nivel_acesso', ''),
    nullif(public.admin_data() ->> 'nivelAcesso', ''),
    nullif(public.admin_data() ->> 'role', ''),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.admin_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'status', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'status', ''),
    nullif(public.admin_data() ->> 'status', ''),
    CASE WHEN (public.admin_data() ->> 'ativo') = 'false' THEN 'inativo' ELSE 'ativo' END
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (public.has_admin_doc() OR public.is_master_email())
    AND public.admin_status() = 'ativo'
    AND (public.raw_role() NOT IN ('', 'NENHUM') OR public.is_master_email())
$$;

CREATE OR REPLACE FUNCTION public.normalize_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN public.is_master_email() THEN 'SUPER_ADMIN'
    WHEN public.raw_role() IN ('SUPER_ADMIN') THEN 'SUPER_ADMIN'
    WHEN public.raw_role() IN ('RH_ADMIN', 'GESTOR_RH') THEN 'RH_ADMIN'
    WHEN public.raw_role() IN ('GERENTE_CANTEIRO', 'GERENTE', 'GERENTE_CAMPO', 'ROLE_GERENTE') THEN 'GERENTE_CANTEIRO'
    WHEN public.raw_role() IN ('CHEFE_CANTEIRO', 'ENCARREGADO_CANTEIRO') THEN 'CHEFE_CANTEIRO'
    WHEN public.raw_role() IN ('CHEFE_DA', 'ENCARREGADO_DA') THEN 'CHEFE_DA'
    WHEN public.raw_role() IN ('AUX_DA', 'AUXILIAR_DA') THEN 'AUX_DA'
    WHEN public.raw_role() IN ('AUDITOR') THEN 'AUDITOR'
    ELSE ''
  END
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_master_email()
      OR (public.is_admin_active() AND public.normalize_role() = 'SUPER_ADMIN')
$$;

CREATE OR REPLACE FUNCTION public.is_rh()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin_active() AND public.normalize_role() = 'RH_ADMIN'
$$;

CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_super_admin() OR public.is_rh()
$$;

CREATE OR REPLACE FUNCTION public.is_gerente_canteiro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin_active() AND public.normalize_role() = 'GERENTE_CANTEIRO'
$$;

CREATE OR REPLACE FUNCTION public.is_chefe_canteiro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin_active() AND public.normalize_role() = 'CHEFE_CANTEIRO'
$$;

CREATE OR REPLACE FUNCTION public.is_chefe_da()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin_active() AND public.normalize_role() = 'CHEFE_DA'
$$;

CREATE OR REPLACE FUNCTION public.is_aux_da()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin_active() AND public.normalize_role() = 'AUX_DA'
$$;

CREATE OR REPLACE FUNCTION public.is_da()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_chefe_da() OR public.is_aux_da()
$$;

CREATE OR REPLACE FUNCTION public.pode_lancar()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_global_admin() 
      OR public.is_gerente_canteiro()
      OR public.is_da() 
      OR public.is_chefe_canteiro()
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_competencia()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_global_admin() 
      OR public.is_gerente_canteiro()
      OR public.is_da() 
      OR public.is_chefe_canteiro()
$$;

-- ----------------------------------------------------------------------------
-- 2. FUNÇÕES DE ESCOPO DE CANTEIRO E COMPETÊNCIA (SECURITY DEFINER + search_path)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.meu_canteiro()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'canteiro_sede', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'canteiro_sede', ''),
    nullif(public.admin_data() ->> 'sede', ''),
    nullif(public.admin_data() ->> 'canteiroSede', ''),
    'TODAS'
  )
$$;

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
      AND (
        coalesce(doc ->> 'sedeCodigo', '') = public.meu_canteiro()
        OR coalesce(doc ->> 'employeeSede', '') = public.meu_canteiro()
        OR coalesce(doc ->> 'sede', '') = public.meu_canteiro()
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.canteiro_do_documento(doc jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    nullif(doc ->> 'employeeSede', ''),
    nullif(doc ->> 'sedeCodigo', ''),
    nullif(doc ->> 'sede', '')
  )
$$;

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
          OR public.meu_canteiro() = canteiro
        )
      )
$$;

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
          OR coalesce(doc ->> 'employeeSede', '') = public.meu_canteiro()
          OR coalesce(doc ->> 'sedeCodigo', '') = public.meu_canteiro()
          OR coalesce(doc ->> 'sede', '') = public.meu_canteiro()
        )
      )
$$;

CREATE OR REPLACE FUNCTION public.competencia_atual()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT to_char(now(), 'YYYY-MM')
$$;

CREATE OR REPLACE FUNCTION public.competencia_anterior(competencia text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN competencia IS NULL OR competencia !~ '^[0-9]{4}-[0-9]{2}$' THEN NULL
    ELSE to_char((competencia || '-01')::date - INTERVAL '1 month', 'YYYY-MM')
  END
$$;

CREATE OR REPLACE FUNCTION public.status_competencia_canteiro(competencia text, canteiro text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT c.data -> 'statusCanteiros' -> canteiro ->> 'status'
       FROM public.competencias_controle c
      WHERE c.id = competencia
      LIMIT 1),
    'ABERTO'
  )
$$;

CREATE OR REPLACE FUNCTION public.competencia_atual_aberta(canteiro text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.status_competencia_canteiro(public.competencia_atual(), canteiro) = 'ABERTO'
$$;

CREATE OR REPLACE FUNCTION public.competencia_anterior_fechada(canteiro text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.competencias_controle c
     WHERE c.id = public.competencia_anterior(public.competencia_atual())
  )
  OR (
    (SELECT c.data -> 'statusCanteiros' -> canteiro
       FROM public.competencias_controle c
      WHERE c.id = public.competencia_anterior(public.competencia_atual())
      LIMIT 1) IS NULL
  )
  OR (
    (SELECT c.data -> 'statusCanteiros' -> canteiro ->> 'status'
       FROM public.competencias_controle c
      WHERE c.id = public.competencia_anterior(public.competencia_atual())
      LIMIT 1) = 'FECHADO'
  )
$$;

CREATE OR REPLACE FUNCTION public.lancamento_competencia_permitido(doc jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_global_admin()
      OR (
        public.canteiro_permitido(public.canteiro_do_documento(doc))
        AND public.competencia_atual_aberta(public.canteiro_do_documento(doc))
        AND public.competencia_anterior_fechada(public.canteiro_do_documento(doc))
      )
$$;

-- ----------------------------------------------------------------------------
-- 3. CONCESSÃO DE PRIVILÉGIOS DE EXECUÇÃO (Elimina erro 42501 definitivamente)
-- ----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Concede EXECUTE para os papéis de conexão da API REST/GraphQL do Supabase
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Garante que quaisquer funções futuras criadas no schema herdem EXECUTE
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
