-- ============================================================================
-- COMARA — Sistema de Gestão de Banco de Horas SPTF
-- Migração 001: Esquema PostgreSQL (Supabase)
-- ============================================================================
--
-- MODELO: compatibilidade documental com o legado do Firestore.
--
-- Cada coleção do Firestore torna-se uma tabela PostgreSQL com:
--   id         text       -> ID do documento (mesmos IDs legados)
--   data       jsonb      -> conteúdo integral do documento (campos camelCase legados)
--   updated_at timestamptz -> última gravação
--
-- Esta escolha garante migração 1:1 dos dados sem risco de perda de campos
-- e permite normalização incremental futura (ver README-SUPABASE.md).
-- Índices expressionais cobrem os campos de consulta mais usados.
-- ============================================================================

-- Coleções de dados
create table if not exists public.colaboradores (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.lancamentos (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.dispensas_sptf (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.contracheques (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.insalubridade_records (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Coleção legada (mantida por compatibilidade com regras antigas)
create table if not exists public.insalubridade (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.resumo_mensal (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.competencias_controle (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.canteiros_obras (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Coleção legada (mantida por compatibilidade)
create table if not exists public.canteiros (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.unidades_organizacionais (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Acesso / usuários administrativos
create table if not exists public.colaboradores_auth (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id text primary key,       -- e-mail (minúsculas), igual ao legado
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.usuarios_sistema (
  id text primary key,       -- e-mail (minúsculas), igual ao legado
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Configurações e logs
create table if not exists public.system_config (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.institution_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.system_logs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.logs_auditoria (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.logs_acesso (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Tabela de teste de conexão (espelha /test do legado)
create table if not exists public.test (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ÍNDICES (GIN + expressionais nos campos de consulta frequente)
-- ============================================================================
create index if not exists idx_colaboradores_data on public.colaboradores using gin (data);
create index if not exists idx_colaboradores_nome on public.colaboradores ((data->>'nome'));
create index if not exists idx_colaboradores_sede on public.colaboradores ((data->>'sedeCodigo'));

create index if not exists idx_lancamentos_data on public.lancamentos using gin (data);
create index if not exists idx_lancamentos_matricula on public.lancamentos ((data->>'matricula'));
create index if not exists idx_lancamentos_sede on public.lancamentos ((data->>'employeeSede'));
create index if not exists idx_lancamentos_data_registro on public.lancamentos ((data->>'dataRegistro'));
create index if not exists idx_lancamentos_competencia on public.lancamentos ((data->>'competencia'));

create index if not exists idx_dispensas_data on public.dispensas_sptf using gin (data);
create index if not exists idx_dispensas_matricula on public.dispensas_sptf ((data->>'matricula'));
create index if not exists idx_dispensas_sede on public.dispensas_sptf ((data->>'employeeSede'));
create index if not exists idx_dispensas_competencia on public.dispensas_sptf ((data->>'competencia'));

create index if not exists idx_contracheques_data on public.contracheques using gin (data);
create index if not exists idx_contracheques_matricula on public.contracheques ((data->>'matricula'));
create index if not exists idx_contracheques_sede on public.contracheques ((data->>'sede'));

create index if not exists idx_insalubridade_data on public.insalubridade_records using gin (data);
create index if not exists idx_insalubridade_sede on public.insalubridade_records ((data->>'sede'));
create index if not exists idx_insalubridade_data_evento on public.insalubridade_records ((data->>'dataEvento'));
create index if not exists idx_insalubridade_matricula on public.insalubridade_records ((data->>'matricula'));

create index if not exists idx_admin_users_data on public.admin_users using gin (data);
create index if not exists idx_admin_users_status on public.admin_users ((data->>'status'));
create index if not exists idx_admin_users_canteiro on public.admin_users ((data->>'canteiroSede'));

create index if not exists idx_logs_auditoria_data on public.logs_auditoria using gin (data);
create index if not exists idx_logs_auditoria_ts on public.logs_auditoria ((data->>'timestamp'));
create index if not exists idx_logs_acesso_ts on public.logs_acesso ((data->>'timestamp'));

-- ============================================================================
-- REALTIME (Supabase Realtime para substituir onSnapshot do Firestore)
-- ============================================================================
alter publication supabase_realtime add table public.colaboradores;
alter publication supabase_realtime add table public.lancamentos;
alter publication supabase_realtime add table public.dispensas_sptf;
alter publication supabase_realtime add table public.contracheques;
alter publication supabase_realtime add table public.insalubridade_records;
alter publication supabase_realtime add table public.resumo_mensal;
alter publication supabase_realtime add table public.competencias_controle;
alter publication supabase_realtime add table public.canteiros_obras;
alter publication supabase_realtime add table public.canteiros;
alter publication supabase_realtime add table public.unidades_organizacionais;
alter publication supabase_realtime add table public.colaboradores_auth;
alter publication supabase_realtime add table public.admin_users;
alter publication supabase_realtime add table public.usuarios_sistema;
alter publication supabase_realtime add table public.system_config;
alter publication supabase_realtime add table public.institution_settings;
alter publication supabase_realtime add table public.system_logs;
alter publication supabase_realtime add table public.logs_auditoria;
alter publication supabase_realtime add table public.logs_acesso;
