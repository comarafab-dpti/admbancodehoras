-- ============================================================================
-- COMARA — Migração 003: Hardening de Segurança (Supabase Linter)
-- ============================================================================
-- Resolve os 4 tipos de avisos do Supabase Linter:
--
-- 1. anon_security_definer_function_executable / authenticated_security_definer_function_executable:
--    Revoga permissão EXECUTE das funções internas de RLS para anon e authenticated.
--    As funções continuam sendo executadas internamente pelas políticas RLS (contexto
--    do banco), mas não ficam mais expostas na API REST pública (/rest/v1/rpc/{funcao}).
--
-- 2. function_search_path_mutable:
--    Fixa search_path = public, pg_temp em todas as funções para blindagem
--    contra search_path hijacking.
--
-- 3. rls_policy_always_true:
--    Substitui WITH CHECK (true) nas tabelas de logs por WITH CHECK (auth.uid() IS NOT NULL),
--    impedindo inserções anônimas e mantendo auditoria restrita a usuários autenticados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOGAR EXECUTE DAS FUNÇÕES INTERNAS PARA anon E authenticated
-- ----------------------------------------------------------------------------

-- Funções de Identificação e Papel
revoke execute on function public.meu_email() from anon, authenticated;
revoke execute on function public.admin_data() from anon, authenticated;
revoke execute on function public.has_admin_doc() from anon, authenticated;
revoke execute on function public.raw_role() from anon, authenticated;
revoke execute on function public.admin_status() from anon, authenticated;
revoke execute on function public.is_admin_active() from anon, authenticated;
revoke execute on function public.is_master_email() from anon, authenticated;
revoke execute on function public.normalize_role() from anon, authenticated;

-- Funções de Perfil e Permissão
revoke execute on function public.is_super_admin() from anon, authenticated;
revoke execute on function public.is_rh() from anon, authenticated;
revoke execute on function public.is_global_admin() from anon, authenticated;
revoke execute on function public.is_gerente_canteiro() from anon, authenticated;
revoke execute on function public.is_chefe_canteiro() from anon, authenticated;
revoke execute on function public.is_chefe_da() from anon, authenticated;
revoke execute on function public.is_aux_da() from anon, authenticated;
revoke execute on function public.is_da() from anon, authenticated;
revoke execute on function public.pode_lancar() from anon, authenticated;
revoke execute on function public.pode_gerenciar_competencia() from anon, authenticated;

-- Funções de Escopo de Canteiro e Documento
revoke execute on function public.meu_canteiro() from anon, authenticated;
revoke execute on function public.documento_do_meu_canteiro(jsonb) from anon, authenticated;
revoke execute on function public.canteiro_do_documento(jsonb) from anon, authenticated;
revoke execute on function public.canteiro_permitido(text) from anon, authenticated;
revoke execute on function public.contracheque_canteiro_permitido(jsonb) from anon, authenticated;

-- Funções de Janela de Competência e Triggers
revoke execute on function public.competencia_atual() from anon, authenticated;
revoke execute on function public.competencia_anterior(text) from anon, authenticated;
revoke execute on function public.status_competencia_canteiro(text, text) from anon, authenticated;
revoke execute on function public.competencia_atual_aberta(text) from anon, authenticated;
revoke execute on function public.competencia_anterior_fechada(text) from anon, authenticated;
revoke execute on function public.lancamento_competencia_permitido(jsonb) from anon, authenticated;
revoke execute on function public.competencias_controle_guard() from anon, authenticated;

-- Funções de sincronização de claims (se já criadas)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'sync_admin_user_claims') then
    execute 'revoke execute on function public.sync_admin_user_claims() from anon, authenticated';
  end if;
  if exists (select 1 from pg_proc where proname = 'handle_new_auth_user_claims') then
    execute 'revoke execute on function public.handle_new_auth_user_claims() from anon, authenticated';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. FIXAR SEARCH_PATH (SET search_path = public, pg_temp)
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
-- 3. RESTRINGIR POLÍTICAS DE INSERT DE LOGS (auth.uid() IS NOT NULL)
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
