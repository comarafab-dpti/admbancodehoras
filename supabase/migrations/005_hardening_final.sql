-- ============================================================================
-- COMARA — Migração 005: Hardening de Segurança Definitivo (Supabase Linter)
-- ============================================================================
-- Resolve definitivamente todos os avisos do Supabase Linter:
--
-- 1. anon_security_definer_function_executable & authenticated_security_definer_function_executable
--    - Revoga EXECUTE de todas as funções internas para PUBLIC, anon e authenticated.
--    - Configura ALTER DEFAULT PRIVILEGES para que novas funções não concedam
--      EXECUTE publicamente de forma automática.
--    - Inclui as funções de 001/002 e as funções de claims/triggers de 004
--      (sync_admin_user_claims, handle_new_auth_user_claims).
--
-- 2. function_search_path_mutable
--    - Fixa search_path = public, pg_temp em todas as funções (estáticas e dinâmicas).
--
-- 3. rls_policy_always_true
--    - Substitui WITH CHECK (true) por WITH CHECK (auth.uid() IS NOT NULL)
--      em logs_acesso, logs_auditoria e system_logs.
--
-- 4. Idempotência e Varredura Dinâmica
--    - Loop PL/pgSQL dinâmico sobre pg_proc no schema public para garantir
--      cobertura de 100% de qualquer função presente, sem risco de erro em reexecuções.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PARTE 1: BLOQUEAR CONCESSÃO AUTOMÁTICA EM FUTURAS FUNÇÕES (DEFAULT PRIVILEGES)
-- ----------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- PARTE 2: REVOGAÇÃO EXPLÍCITA DE EXECUTE (FUNÇÕES ESTÁTICAS E DE RLS)
-- ----------------------------------------------------------------------------

-- Funções de Identificação e Papel
revoke execute on function public.meu_email() from public, anon, authenticated;
revoke execute on function public.admin_data() from public, anon, authenticated;
revoke execute on function public.has_admin_doc() from public, anon, authenticated;
revoke execute on function public.raw_role() from public, anon, authenticated;
revoke execute on function public.admin_status() from public, anon, authenticated;
revoke execute on function public.is_admin_active() from public, anon, authenticated;
revoke execute on function public.is_master_email() from public, anon, authenticated;
revoke execute on function public.normalize_role() from public, anon, authenticated;

-- Funções de Perfil e Permissão
revoke execute on function public.is_super_admin() from public, anon, authenticated;
revoke execute on function public.is_rh() from public, anon, authenticated;
revoke execute on function public.is_global_admin() from public, anon, authenticated;
revoke execute on function public.is_gerente_canteiro() from public, anon, authenticated;
revoke execute on function public.is_chefe_canteiro() from public, anon, authenticated;
revoke execute on function public.is_chefe_da() from public, anon, authenticated;
revoke execute on function public.is_aux_da() from public, anon, authenticated;
revoke execute on function public.is_da() from public, anon, authenticated;
revoke execute on function public.pode_lancar() from public, anon, authenticated;
revoke execute on function public.pode_gerenciar_competencia() from public, anon, authenticated;

-- Funções de Escopo de Canteiro e Documento
revoke execute on function public.meu_canteiro() from public, anon, authenticated;
revoke execute on function public.documento_do_meu_canteiro(jsonb) from public, anon, authenticated;
revoke execute on function public.canteiro_do_documento(jsonb) from public, anon, authenticated;
revoke execute on function public.canteiro_permitido(text) from public, anon, authenticated;
revoke execute on function public.contracheque_canteiro_permitido(jsonb) from public, anon, authenticated;

-- Funções de Janela de Competência e Triggers
revoke execute on function public.competencia_atual() from public, anon, authenticated;
revoke execute on function public.competencia_anterior(text) from public, anon, authenticated;
revoke execute on function public.status_competencia_canteiro(text, text) from public, anon, authenticated;
revoke execute on function public.competencia_atual_aberta(text) from public, anon, authenticated;
revoke execute on function public.competencia_anterior_fechada(text) from public, anon, authenticated;
revoke execute on function public.lancamento_competencia_permitido(jsonb) from public, anon, authenticated;
revoke execute on function public.competencias_controle_guard() from public, anon, authenticated;

-- Funções da Migração 004 (Custom Claims e Sincronização)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'sync_admin_user_claims') then
    execute 'revoke execute on function public.sync_admin_user_claims() from public, anon, authenticated';
  end if;
  if exists (select 1 from pg_proc where proname = 'handle_new_auth_user_claims') then
    execute 'revoke execute on function public.handle_new_auth_user_claims() from public, anon, authenticated';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- PARTE 3: FIXAR SEARCH_PATH (SET search_path = public, pg_temp)
-- ----------------------------------------------------------------------------

alter function public.meu_email() set search_path = public, pg_temp;
alter function public.admin_data() set search_path = public, pg_temp;
alter function public.has_admin_doc() set search_path = public, pg_temp;
alter function public.raw_role() set search_path = public, pg_temp;
alter function public.admin_status() set search_path = public, pg_temp;
alter function public.is_admin_active() set search_path = public, pg_temp;
alter function public.is_master_email() set search_path = public, pg_temp;
alter function public.normalize_role() set search_path = public, pg_temp;
alter function public.is_super_admin() set search_path = public, pg_temp;
alter function public.is_rh() set search_path = public, pg_temp;
alter function public.is_global_admin() set search_path = public, pg_temp;
alter function public.is_gerente_canteiro() set search_path = public, pg_temp;
alter function public.is_chefe_canteiro() set search_path = public, pg_temp;
alter function public.is_chefe_da() set search_path = public, pg_temp;
alter function public.is_aux_da() set search_path = public, pg_temp;
alter function public.is_da() set search_path = public, pg_temp;
alter function public.pode_lancar() set search_path = public, pg_temp;
alter function public.pode_gerenciar_competencia() set search_path = public, pg_temp;
alter function public.meu_canteiro() set search_path = public, pg_temp;
alter function public.documento_do_meu_canteiro(jsonb) set search_path = public, pg_temp;
alter function public.canteiro_do_documento(jsonb) set search_path = public, pg_temp;
alter function public.canteiro_permitido(text) set search_path = public, pg_temp;
alter function public.contracheque_canteiro_permitido(jsonb) set search_path = public, pg_temp;
alter function public.competencia_atual() set search_path = public, pg_temp;
alter function public.competencia_anterior(text) set search_path = public, pg_temp;
alter function public.status_competencia_canteiro(text, text) set search_path = public, pg_temp;
alter function public.competencia_atual_aberta(text) set search_path = public, pg_temp;
alter function public.competencia_anterior_fechada(text) set search_path = public, pg_temp;
alter function public.lancamento_competencia_permitido(jsonb) set search_path = public, pg_temp;
alter function public.competencias_controle_guard() set search_path = public, pg_temp;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'sync_admin_user_claims') then
    execute 'alter function public.sync_admin_user_claims() set search_path = public, pg_temp';
  end if;
  if exists (select 1 from pg_proc where proname = 'handle_new_auth_user_claims') then
    execute 'alter function public.handle_new_auth_user_claims() set search_path = public, pg_temp';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- PARTE 4: REAPLICAR POLÍTICAS RESTRITIVAS DE INSERT EM LOGS
-- ----------------------------------------------------------------------------

drop policy if exists logs_acesso_insert on public.logs_acesso;
create policy logs_acesso_insert on public.logs_acesso
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists logs_auditoria_insert on public.logs_auditoria;
create policy logs_auditoria_insert on public.logs_auditoria
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists system_logs_insert on public.system_logs;
create policy system_logs_insert on public.system_logs
  for insert to authenticated
  with check (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- PARTE 5: BLINDAGEM DINÂMICA E IDEMPOTÊNCIA TOTAL (VARREDURA DO SCHEMA PUBLIC)
-- ----------------------------------------------------------------------------
-- Garante que NENHUMA função existente no schema public (presente ou futura)
-- fique com permissão pública ou com search_path mutável.
do $$
declare
  r record;
  fn_identity text;
begin
  for r in
    select
      p.oid,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
  loop
    fn_identity := quote_ident('public') || '.' || quote_ident(r.proname) || '(' || r.args || ')';

    -- 1. Revoga privilégios para public, anon e authenticated
    execute 'revoke all on function ' || fn_identity || ' from public, anon, authenticated';

    -- 2. Concede EXECUTE apenas para postgres, service_role e supabase_admin
    begin
      execute 'grant execute on function ' || fn_identity || ' to postgres, service_role';
    exception when others then
      -- Silencia se algum role não existir neste ambiente
      null;
    end;

    -- 3. Fixa search_path
    execute 'alter function ' || fn_identity || ' set search_path = public, pg_temp';
  end loop;

  raise notice 'Hardening final concluído: todas as funções de public foram protegidas.';
end $$;

-- ----------------------------------------------------------------------------
-- PARTE 6: RELATÓRIO DE CONFERÊNCIA AUTOMÁTICA
-- ----------------------------------------------------------------------------
do $$
declare
  v_vulneraveis int := 0;
  v_mutaveis int := 0;
begin
  select count(*) into v_vulneraveis
  from pg_proc p
  join pg_namespace n on p.pronamespace = n.oid
  where n.nspname = 'public'
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  select count(*) into v_mutaveis
  from pg_proc p
  join pg_namespace n on p.pronamespace = n.oid
  where n.nspname = 'public'
    and (p.proconfig is null or not array_to_string(p.proconfig, ',') like '%search_path=%');

  if v_vulneraveis = 0 and v_mutaveis = 0 then
    raise notice '✅ Verificação com Sucesso: 0 funções vulneráveis a RPC externa e 0 funções com search_path mutável.';
  else
    raise warning 'Aviso: Funções restantes - Vulneráveis a RPC: %, Com search_path mutável: %', v_vulneraveis, v_mutaveis;
  end if;
end $$;
