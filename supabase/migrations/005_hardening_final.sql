-- ============================================================================
-- COMARA — Migração 005: Hardening de Segurança e Políticas de RLS
-- ============================================================================
-- 1. anon_security_definer_function_executable:
--    - Revoga EXECUTE de 'anon' (requisições deslogadas/públicas).
--    - Assegura EXECUTE para 'authenticated' nas funções exigidas pelas políticas RLS.
-- 2. function_search_path_mutable:
--    - Fixa search_path = public, pg_temp em todas as funções.
-- 3. rls_policy_always_true:
--    - Políticas de INSERT em logs com WITH CHECK (auth.uid() IS NOT NULL).
-- ============================================================================

-- 1. BLOQUEAR CONCESSÃO AUTOMÁTICA EM FUTURAS FUNÇÕES PARA ANON
alter default privileges in schema public revoke execute on functions from anon;

-- 2. FIXAR SEARCH_PATH (SET search_path = public, pg_temp)
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

-- 3. PERMISSÕES DE EXECUÇÃO: REVOGAR DE ANON, CONCEDER A AUTHENTICATED
-- anon (usuários sem login) NÃO podem executar nenhuma função interna de RLS
revoke execute on function public.meu_email() from anon;
revoke execute on function public.admin_data() from anon;
revoke execute on function public.has_admin_doc() from anon;
revoke execute on function public.raw_role() from anon;
revoke execute on function public.admin_status() from anon;
revoke execute on function public.is_admin_active() from anon;
revoke execute on function public.is_master_email() from anon;
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

-- authenticated (usuários logados) PRECISAM de permissão para que as políticas RLS executem
grant execute on function public.meu_email() to authenticated;
grant execute on function public.admin_data() to authenticated;
grant execute on function public.has_admin_doc() to authenticated;
grant execute on function public.raw_role() to authenticated;
grant execute on function public.admin_status() to authenticated;
grant execute on function public.is_admin_active() to authenticated;
grant execute on function public.is_master_email() to authenticated;
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

-- 4. REAPLICAR POLÍTICAS RESTRITIVAS DE INSERT EM LOGS
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
