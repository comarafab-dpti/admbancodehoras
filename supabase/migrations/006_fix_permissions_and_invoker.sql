-- ============================================================================
-- COMARA — Migração 006: Correção de Permissões RLS (Erro 42501 meu_canteiro)
-- ============================================================================
-- Causa do erro 42501:
-- A migração 005 revogou EXECUTE de authenticated em funções chamadas pelas
-- políticas RLS (como meu_canteiro, is_super_admin, documento_do_meu_canteiro).
-- Quando um usuário logado consulta uma tabela, o PostgreSQL avalia as policies
-- no papel do usuário (authenticated) e aborta com 42501 caso o papel não tenha
-- permissão EXECUTE nas funções da expressão.
--
-- Solução definitiva e limpa:
-- 1. Transforma as funções de RLS em SECURITY INVOKER (remove SECURITY DEFINER).
--    Assim o Supabase Linter NÃO as sinaliza como risco de privilégio elevado.
-- 2. Concede EXECUTE ao papel 'authenticated' para que as queries RLS funcionem.
-- 3. Mantém 'anon' bloqueado (revogado) para evitar chamadas de usuários não logados.
-- 4. Mantém search_path = public, pg_temp fixado em todas as funções.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RECRIAÇÃO DAS FUNÇÕES COMO SECURITY INVOKER (Exceto admin_data e triggers)
-- ----------------------------------------------------------------------------

create or replace function public.meu_email()
returns text language sql stable set search_path = public, pg_temp as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_master_email()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.meu_email() in ('comarafab@gmail.com', 'coari.comara@gmail.com')
$$;

-- admin_data precisa de security definer para ler admin_users em fallback
create or replace function public.admin_data()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select a.data from public.admin_users a where lower(a.id) = public.meu_email() limit 1
$$;

create or replace function public.has_admin_doc()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.admin_users a where lower(a.id) = public.meu_email())
$$;

create or replace function public.raw_role()
returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'nivel_acesso', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'nivel_acesso', ''),
    nullif(public.admin_data() ->> 'nivelAcesso', ''),
    nullif(public.admin_data() ->> 'role', ''),
    ''
  )
$$;

create or replace function public.admin_status()
returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'status', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'status', ''),
    nullif(public.admin_data() ->> 'status', ''),
    case when (public.admin_data() ->> 'ativo') = 'false' then 'inativo' else 'ativo' end
  )
$$;

create or replace function public.is_admin_active()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select (public.has_admin_doc() or public.is_master_email())
    and public.admin_status() = 'ativo'
    and (public.raw_role() not in ('', 'NENHUM') or public.is_master_email())
$$;

create or replace function public.normalize_role()
returns text language sql stable set search_path = public, pg_temp as $$
  select case
    when public.is_master_email() then 'SUPER_ADMIN'
    when public.raw_role() in ('SUPER_ADMIN') then 'SUPER_ADMIN'
    when public.raw_role() in ('RH_ADMIN', 'GESTOR_RH') then 'RH_ADMIN'
    when public.raw_role() in ('GERENTE_CANTEIRO', 'GERENTE', 'GERENTE_CAMPO', 'ROLE_GERENTE') then 'GERENTE_CANTEIRO'
    when public.raw_role() in ('CHEFE_CANTEIRO', 'ENCARREGADO_CANTEIRO') then 'CHEFE_CANTEIRO'
    when public.raw_role() in ('CHEFE_DA', 'ENCARREGADO_DA') then 'CHEFE_DA'
    when public.raw_role() in ('AUX_DA', 'AUXILIAR_DA') then 'AUX_DA'
    when public.raw_role() in ('AUDITOR') then 'AUDITOR'
    else ''
  end
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_master_email()
      or (public.is_admin_active() and public.normalize_role() = 'SUPER_ADMIN')
$$;

create or replace function public.is_rh()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_admin_active() and public.normalize_role() = 'RH_ADMIN'
$$;

create or replace function public.is_global_admin()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_super_admin() or public.is_rh()
$$;

create or replace function public.is_gerente_canteiro()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_admin_active() and public.normalize_role() = 'GERENTE_CANTEIRO'
$$;

create or replace function public.is_chefe_canteiro()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_admin_active() and public.normalize_role() = 'CHEFE_CANTEIRO'
$$;

create or replace function public.is_chefe_da()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_admin_active() and public.normalize_role() = 'CHEFE_DA'
$$;

create or replace function public.is_aux_da()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_admin_active() and public.normalize_role() = 'AUX_DA'
$$;

create or replace function public.is_da()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_chefe_da() or public.is_aux_da()
$$;

create or replace function public.pode_lancar()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_global_admin() or public.is_gerente_canteiro()
      or public.is_da() or public.is_chefe_canteiro()
$$;

create or replace function public.pode_gerenciar_competencia()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_global_admin() or public.is_gerente_canteiro()
      or public.is_da() or public.is_chefe_canteiro()
$$;

create or replace function public.meu_canteiro()
returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'canteiro_sede', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'canteiro_sede', ''),
    nullif(public.admin_data() ->> 'sede', ''),
    nullif(public.admin_data() ->> 'canteiroSede', ''),
    'TODAS'
  )
$$;

create or replace function public.documento_do_meu_canteiro(doc jsonb)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.meu_canteiro() = 'TODAS'
    or (
      public.meu_canteiro() <> ''
      and (
        coalesce(doc ->> 'sedeCodigo', '') = public.meu_canteiro()
        or coalesce(doc ->> 'employeeSede', '') = public.meu_canteiro()
        or coalesce(doc ->> 'sede', '') = public.meu_canteiro()
      )
    )
$$;

create or replace function public.canteiro_do_documento(doc jsonb)
returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    nullif(doc ->> 'employeeSede', ''),
    nullif(doc ->> 'sedeCodigo', ''),
    nullif(doc ->> 'sede', '')
  )
$$;

create or replace function public.canteiro_permitido(canteiro text)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_global_admin()
      or (
        public.is_admin_active()
        and (
          public.meu_canteiro() = 'TODAS'
          or public.meu_canteiro() = canteiro
        )
      )
$$;

create or replace function public.contracheque_canteiro_permitido(doc jsonb)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_global_admin()
      or (
        public.is_admin_active()
        and (
          public.meu_canteiro() = 'TODAS'
          or coalesce(doc ->> 'employeeSede', '') = public.meu_canteiro()
          or coalesce(doc ->> 'sedeCodigo', '') = public.meu_canteiro()
          or coalesce(doc ->> 'sede', '') = public.meu_canteiro()
        )
      )
$$;

create or replace function public.competencia_atual()
returns text language sql stable set search_path = public, pg_temp as $$
  select to_char(timezone('America/Manaus', now()), 'YYYY-MM')
$$;

create or replace function public.competencia_anterior(competencia text)
returns text language sql stable set search_path = public, pg_temp as $$
  select to_char(
    (to_date(competencia || '-01', 'YYYY-MM-DD') - interval '1 day'),
    'YYYY-MM'
  )
$$;

create or replace function public.status_competencia_canteiro(competencia text, canteiro text)
returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    (select c.data -> 'statusCanteiros' -> canteiro ->> 'status'
     from public.competencias_controle c
     where c.id = competencia),
    ''
  )
$$;

create or replace function public.competencia_atual_aberta(canteiro text)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.status_competencia_canteiro(public.competencia_atual(), canteiro) in ('', 'ABERTO')
$$;

create or replace function public.competencia_anterior_fechada(canteiro text)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select case
    when not exists (select 1 from public.competencias_controle c where c.id = public.competencia_anterior(public.competencia_atual())) then true
    when public.status_competencia_canteiro(public.competencia_anterior(public.competencia_atual()), canteiro) = '' then true
    when public.status_competencia_canteiro(public.competencia_anterior(public.competencia_atual()), canteiro) = 'FECHADO' then true
    else false
  end
$$;

create or replace function public.lancamento_competencia_permitido(doc jsonb)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select public.is_super_admin()
      or (
        public.pode_lancar()
        and (
          public.canteiro_do_documento(doc) is null
          or (
            public.competencia_atual_aberta(public.canteiro_do_documento(doc))
            and public.competencia_anterior_fechada(public.canteiro_do_documento(doc))
          )
        )
      )
$$;

-- ----------------------------------------------------------------------------
-- 2. CONCEDER EXECUTE A AUTHENTICATED E REVOGAR DE ANON
-- ----------------------------------------------------------------------------

-- Concessão explícita para todas as funções de RLS para usuários logados (authenticated)
grant execute on function public.meu_email() to authenticated;
grant execute on function public.is_master_email() to authenticated;
grant execute on function public.admin_data() to authenticated;
grant execute on function public.has_admin_doc() to authenticated;
grant execute on function public.raw_role() to authenticated;
grant execute on function public.admin_status() to authenticated;
grant execute on function public.is_admin_active() to authenticated;
grant execute on function public.normalize_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_rh() to authenticated;
grant execute on function public.is_global_admin() to authenticated;
grant execute on function public.is_gerente_canteiro() to authenticated;
grant execute on function public.is_chefe_canteiro() to authenticated;
grant execute on function public.is_chefe_da() to authenticated;
grant execute on function public.is_aux_da() to authenticated;
grant execute on function public.is_da() to authenticated;
grant execute on function public.pode_lancar() to authenticated;
grant execute on function public.pode_gerenciar_competencia() to authenticated;
grant execute on function public.meu_canteiro() to authenticated;
grant execute on function public.documento_do_meu_canteiro(jsonb) to authenticated;
grant execute on function public.canteiro_do_documento(jsonb) to authenticated;
grant execute on function public.canteiro_permitido(text) to authenticated;
grant execute on function public.contracheque_canteiro_permitido(jsonb) to authenticated;
grant execute on function public.competencia_atual() to authenticated;
grant execute on function public.competencia_anterior(text) to authenticated;
grant execute on function public.status_competencia_canteiro(text, text) to authenticated;
grant execute on function public.competencia_atual_aberta(text) to authenticated;
grant execute on function public.competencia_anterior_fechada(text) to authenticated;
grant execute on function public.lancamento_competencia_permitido(jsonb) to authenticated;

-- Revogar de anon (usuários deslogados não executam funções internas de RLS via RPC)
revoke execute on function public.meu_email() from anon;
revoke execute on function public.is_master_email() from anon;
revoke execute on function public.admin_data() from anon;
revoke execute on function public.has_admin_doc() from anon;
revoke execute on function public.raw_role() from anon;
revoke execute on function public.admin_status() from anon;
revoke execute on function public.is_admin_active() from anon;
revoke execute on function public.normalize_role() from anon;
revoke execute on function public.is_super_admin() from anon;
revoke execute on function public.is_rh() from anon;
revoke execute on function public.is_global_admin() from anon;
revoke execute on function public.is_gerente_canteiro() from anon;
revoke execute on function public.is_chefe_canteiro() from anon;
revoke execute on function public.is_chefe_da() from anon;
revoke execute on function public.is_aux_da() from anon;
revoke execute on function public.is_da() from anon;
revoke execute on function public.pode_lancar() from anon;
revoke execute on function public.pode_gerenciar_competencia() from anon;
revoke execute on function public.meu_canteiro() from anon;
revoke execute on function public.documento_do_meu_canteiro(jsonb) from anon;
revoke execute on function public.canteiro_do_documento(jsonb) from anon;
revoke execute on function public.canteiro_permitido(text) from anon;
revoke execute on function public.contracheque_canteiro_permitido(jsonb) from anon;
revoke execute on function public.competencia_atual() from anon;
revoke execute on function public.competencia_anterior(text) from anon;
revoke execute on function public.status_competencia_canteiro(text, text) from anon;
revoke execute on function public.competencia_atual_aberta(text) from anon;
revoke execute on function public.competencia_anterior_fechada(text) from anon;
revoke execute on function public.lancamento_competencia_permitido(jsonb) from anon;

-- Triggers de sistema (apenas postgres e service_role)
revoke execute on function public.competencias_controle_guard() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_proc where proname = 'sync_admin_user_claims') then
    execute 'revoke execute on function public.sync_admin_user_claims() from public, anon, authenticated';
  end if;
  if exists (select 1 from pg_proc where proname = 'handle_new_auth_user_claims') then
    execute 'revoke execute on function public.handle_new_auth_user_claims() from public, anon, authenticated';
  end if;
end $$;
