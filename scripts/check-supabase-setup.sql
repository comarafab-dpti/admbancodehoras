-- ============================================================================
-- COMARA — Script de Diagnóstico e Verificação do Supabase
-- Arquivo: scripts/check-supabase-setup.sql
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para verificar se o banco de
-- dados está 100% configurado e pronto para a aplicação.
-- ============================================================================

-- 1. DIAGNÓSTICO GERAL DAS TABELAS, RLS E POLÍTICAS
select
  t.tablename as "Tabela",
  case when c.relrowsecurity then '✅ Ativo' else '❌ INATIVO' end as "RLS",
  coalesce(p.policy_count, 0) as "Políticas RLS",
  case when rt.tablename is not null then '✅ Sim' else '⚠️ Não' end as "Realtime Ativo"
from (
  values
    ('colaboradores'),
    ('lancamentos'),
    ('dispensas_sptf'),
    ('contracheques'),
    ('insalubridade_records'),
    ('insalubridade'),
    ('resumo_mensal'),
    ('competencias_controle'),
    ('canteiros_obras'),
    ('canteiros'),
    ('unidades_organizacionais'),
    ('colaboradores_auth'),
    ('admin_users'),
    ('usuarios_sistema'),
    ('system_config'),
    ('institution_settings'),
    ('system_logs'),
    ('logs_auditoria'),
    ('logs_acesso')
) as t(tablename)
left join pg_tables pt on pt.schemaname = 'public' and pt.tablename = t.tablename
left join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
left join (
  select tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
  group by tablename
) p on p.tablename = t.tablename
left join (
  select tablename
  from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public'
) rt on rt.tablename = t.tablename
order by t.tablename;

-- 2. VERIFICAÇÃO ESPECÍFICA DA PUBLICAÇÃO REALTIME
-- Exibe o status da publicação 'supabase_realtime'
select
  pubname as "Publicação",
  schemaname as "Esquema",
  tablename as "Tabela em Realtime"
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;

-- 3. VERIFICAÇÃO DE FUNÇÕES AUXILIARES DE SEGURANÇA (SECURITY DEFINER)
select
  p.proname as "Função",
  pg_catalog.pg_get_function_result(p.oid) as "Retorno",
  case when p.prosecdef then '✅ Security Definer' else '⚠️ Normal' end as "Segurança"
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public'
  and p.proname in (
    'meu_email',
    'admin_data',
    'has_admin_doc',
    'is_super_admin',
    'is_rh',
    'is_global_admin',
    'is_admin_active',
    'is_gerente_canteiro',
    'is_chefe_canteiro',
    'is_da',
    'pode_lancar',
    'pode_gerenciar_competencia',
    'meu_canteiro',
    'documento_do_meu_canteiro',
    'competencia_atual_aberta',
    'competencia_anterior_fechada',
    'lancamento_competencia_permitido'
  )
order by p.proname;

-- 4. VERIFICAÇÃO DE TRIGGERS
select
  event_object_table as "Tabela",
  trigger_name as "Gatilho",
  action_timing as "Momento",
  event_manipulation as "Evento"
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'trg_competencias_controle_guard';

-- 5. VERIFICAÇÃO DE HARDENING (FUNÇÕES REVOGADAS E SEARCH_PATH FIXADO)
select
  p.proname as "Função",
  case when not has_function_privilege('anon', p.oid, 'EXECUTE') then '✅ Protegido (anon bloqueado)' else '❌ AVISO: Executável por anon' end as "Acesso Anon",
  case when not has_function_privilege('authenticated', p.oid, 'EXECUTE') then '✅ Protegido (auth bloqueado)' else '⚠️ Executável por auth' end as "Acesso Auth",
  coalesce(array_to_string(p.proconfig, ', '), '❌ Mutable (não configurado)') as "Config search_path"
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public'
  and p.proname in ('meu_email', 'admin_data', 'is_super_admin', 'pode_lancar', 'competencia_atual_aberta', 'sync_admin_user_claims', 'handle_new_auth_user_claims')
order by p.proname;

-- 5.1 TOTALIZADOR GERAL DE HARDENING NO SCHEMA PUBLIC
select
  count(*) as "Total Funções em public",
  count(*) filter (where not has_function_privilege('anon', p.oid, 'EXECUTE')) as "Bloqueadas para Anon",
  count(*) filter (where not has_function_privilege('authenticated', p.oid, 'EXECUTE')) as "Bloqueadas para Auth",
  count(*) filter (where array_to_string(p.proconfig, ',') like '%search_path=%') as "Com search_path Fixo"
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public';

-- 6. RESUMO DE CONTAGEM DE DOCUMENTOS (se já houver dados migrados)
select
  'colaboradores' as tabela, count(*) as total from public.colaboradores
union all select 'lancamentos', count(*) from public.lancamentos
union all select 'dispensas_sptf', count(*) from public.dispensas_sptf
union all select 'contracheques', count(*) from public.contracheques
union all select 'insalubridade_records', count(*) from public.insalubridade_records
union all select 'competencias_controle', count(*) from public.competencias_controle
union all select 'canteiros_obras', count(*) from public.canteiros_obras
union all select 'unidades_organizacionais', count(*) from public.unidades_organizacionais
union all select 'admin_users', count(*) from public.admin_users
union all select 'system_config', count(*) from public.system_config;
