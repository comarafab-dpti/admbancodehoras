-- ============================================================================
-- COMARA — Sistema de Gestão de Banco de Horas SPTF
-- 000_BOOTSTRAP.SQL: Migração Consolidada e 100% Idempotente
-- ============================================================================
-- Este arquivo consolida o esquema (001_schema.sql) e as regras RLS (002_rls.sql).
-- Pode ser executado repetidas vezes no SQL Editor do Supabase sem gerar nenhum erro
-- (incluindo o erro 42710 do Realtime ou duplicidade de políticas/índices).
-- ============================================================================

-- ============================================================================
-- PARTE 1: TABELAS DOCUMENTAIS
-- ============================================================================

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

create table if not exists public.colaboradores_auth (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.usuarios_sistema (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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

create table if not exists public.test (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- PARTE 2: ÍNDICES (GIN + EXPRESSIONAIS)
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

create index if not exists idx_canteiros_obras_data on public.canteiros_obras using gin (data);
create index if not exists idx_canteiros_obras_status on public.canteiros_obras ((data->>'status'));
create index if not exists idx_canteiros_obras_codigo on public.canteiros_obras ((data->>'codigo'));

create index if not exists idx_unidades_organizacionais_data on public.unidades_organizacionais using gin (data);
create index if not exists idx_unidades_organizacionais_codigo on public.unidades_organizacionais ((data->>'codigo'));
create index if not exists idx_unidades_organizacionais_status on public.unidades_organizacionais ((data->>'ativa'));
create index if not exists idx_unidades_organizacionais_tipo on public.unidades_organizacionais ((data->>'tipo'));
create index if not exists idx_unidades_organizacionais_pai on public.unidades_organizacionais ((data->>'pai'));

create index if not exists idx_logs_auditoria_data on public.logs_auditoria using gin (data);
create index if not exists idx_logs_auditoria_ts on public.logs_auditoria ((data->>'timestamp'));
create index if not exists idx_logs_acesso_ts on public.logs_acesso ((data->>'timestamp'));

-- ============================================================================
-- PARTE 3: FUNÇÕES AUXILIARES DE SEGURANÇA (SECURITY DEFINER)
-- ============================================================================

create or replace function public.meu_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.admin_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select a.data from public.admin_users a where a.id = public.meu_email() limit 1
$$;

create or replace function public.has_admin_doc()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.id = public.meu_email())
$$;

create or replace function public.raw_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(public.admin_data() ->> 'nivelAcesso', ''),
    nullif(public.admin_data() ->> 'role', ''),
    ''
  )
$$;

create or replace function public.admin_status()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(public.admin_data() ->> 'status', ''),
    case when (public.admin_data() ->> 'ativo') = 'false' then 'inativo' else 'ativo' end
  )
$$;

create or replace function public.is_admin_active()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_doc()
    and public.admin_status() = 'ativo'
    and public.raw_role() not in ('', 'NENHUM')
$$;

create or replace function public.is_master_email()
returns boolean language sql stable security definer set search_path = public as $$
  select public.meu_email() in ('comarafab@gmail.com', 'coari.comara@gmail.com')
$$;

create or replace function public.normalize_role()
returns text language sql stable security definer set search_path = public as $$
  select case public.raw_role()
    when 'SUPER_ADMIN' then 'SUPER_ADMIN'
    when 'RH_ADMIN' then 'RH_ADMIN'
    when 'GESTOR_RH' then 'RH_ADMIN'
    when 'GERENTE_CANTEIRO' then 'GERENTE_CANTEIRO'
    when 'GERENTE' then 'GERENTE_CANTEIRO'
    when 'GERENTE_CAMPO' then 'GERENTE_CANTEIRO'
    when 'ROLE_GERENTE' then 'GERENTE_CANTEIRO'
    when 'CHEFE_CANTEIRO' then 'CHEFE_CANTEIRO'
    when 'ENCARREGADO_CANTEIRO' then 'CHEFE_CANTEIRO'
    when 'CHEFE_DA' then 'CHEFE_DA'
    when 'ENCARREGADO_DA' then 'CHEFE_DA'
    when 'AUX_DA' then 'AUX_DA'
    when 'AUXILIAR_DA' then 'AUX_DA'
    when 'AUDITOR' then 'AUDITOR'
    else ''
  end
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select (public.is_admin_active() and public.normalize_role() = 'SUPER_ADMIN')
      or (not public.has_admin_doc() and public.is_master_email())
$$;

create or replace function public.is_rh()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_active() and public.normalize_role() = 'RH_ADMIN'
$$;

create or replace function public.is_global_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or public.is_rh()
$$;

create or replace function public.is_gerente_canteiro()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_active() and public.normalize_role() = 'GERENTE_CANTEIRO'
$$;

create or replace function public.is_chefe_canteiro()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_active() and public.normalize_role() = 'CHEFE_CANTEIRO'
$$;

create or replace function public.is_chefe_da()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_active() and public.normalize_role() = 'CHEFE_DA'
$$;

create or replace function public.is_aux_da()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_active() and public.normalize_role() = 'AUX_DA'
$$;

create or replace function public.is_da()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_chefe_da() or public.is_aux_da()
$$;

create or replace function public.pode_lancar()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_global_admin() or public.is_gerente_canteiro()
      or public.is_da() or public.is_chefe_canteiro()
$$;

create or replace function public.pode_gerenciar_competencia()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_global_admin() or public.is_gerente_canteiro()
      or public.is_da() or public.is_chefe_canteiro()
$$;

create or replace function public.meu_canteiro()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_data() ->> 'canteiroSede', '')
$$;

create or replace function public.documento_do_meu_canteiro(doc jsonb)
returns boolean language sql stable as $$
  select public.meu_canteiro() <> ''
    and (
      coalesce(doc ->> 'sedeCodigo', '') = public.meu_canteiro()
      or coalesce(doc ->> 'employeeSede', '') = public.meu_canteiro()
      or coalesce(doc ->> 'sede', '') = public.meu_canteiro()
    )
$$;

create or replace function public.canteiro_do_documento(doc jsonb)
returns text language sql stable as $$
  select coalesce(
    nullif(doc ->> 'employeeSede', ''),
    nullif(doc ->> 'sedeCodigo', ''),
    nullif(doc ->> 'sede', '')
  )
$$;

create or replace function public.canteiro_permitido(canteiro text)
returns boolean language sql stable as $$
  select public.is_global_admin()
      or (public.is_admin_active()
          and coalesce(canteiro, '') <> ''
          and canteiro = public.meu_canteiro())
$$;

create or replace function public.contracheque_canteiro_permitido(doc jsonb)
returns boolean language sql stable as $$
  select public.is_global_admin()
      or (
        public.meu_canteiro() <> ''
        and coalesce(doc ->> 'sede', '') <> ''
        and lower(doc ->> 'sede') like '%' || lower(public.meu_canteiro()) || '%'
      )
$$;

create or replace function public.competencia_atual()
returns text language sql stable as $$
  select to_char(now(), 'YYYY-MM')
$$;

create or replace function public.competencia_anterior(competencia text)
returns text language sql immutable as $$
  select case
    when competencia is null or competencia !~ '^[0-9]{4}-[0-9]{2}$' then null
    else to_char((competencia || '-01')::date - interval '1 month', 'YYYY-MM')
  end
$$;

create or replace function public.status_competencia_canteiro(competencia text, canteiro text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.data -> 'statusCanteiros' -> canteiro ->> 'status'
       from public.competencias_controle c
      where c.id = competencia
      limit 1),
    'ABERTO'
  )
$$;

create or replace function public.competencia_atual_aberta(canteiro text)
returns boolean language sql stable as $$
  select public.status_competencia_canteiro(public.competencia_atual(), canteiro) = 'ABERTO'
$$;

create or replace function public.competencia_anterior_fechada(canteiro text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.competencias_controle c
     where c.id = public.competencia_anterior(public.competencia_atual())
  )
  or (
    (select c.data -> 'statusCanteiros' -> canteiro
       from public.competencias_controle c
      where c.id = public.competencia_anterior(public.competencia_atual())
      limit 1) is null
  )
  or (
    (select c.data -> 'statusCanteiros' -> canteiro ->> 'status'
       from public.competencias_controle c
      where c.id = public.competencia_anterior(public.competencia_atual())
      limit 1) = 'FECHADO'
  )
$$;

create or replace function public.lancamento_competencia_permitido(doc jsonb)
returns boolean language sql stable as $$
  select public.is_global_admin()
      or (
        public.canteiro_permitido(public.canteiro_do_documento(doc))
        and public.competencia_atual_aberta(public.canteiro_do_documento(doc))
        and public.competencia_anterior_fechada(public.canteiro_do_documento(doc))
      )
$$;

create or replace function public.competencias_controle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meu text;
  novo_status_canteiros jsonb;
begin
  if public.is_global_admin() then
    return new;
  end if;

  if (public.is_gerente_canteiro() or public.is_da() or public.is_chefe_canteiro()) then
    meu := public.meu_canteiro();
    if meu = '' then
      raise exception 'Perfil sem canteiro vinculado não pode alterar competências.';
    end if;

    novo_status_canteiros := coalesce(old.data -> 'statusCanteiros', '{}'::jsonb);
    if new.data ? 'statusCanteiros' and (new.data -> 'statusCanteiros') ? meu then
      novo_status_canteiros := jsonb_set(
        novo_status_canteiros,
        array[meu],
        new.data -> 'statusCanteiros' -> meu
      );
    else
      raise exception 'Você só pode alterar o status do canteiro %.', meu;
    end if;

    new.data := jsonb_set(old.data, '{statusCanteiros}', novo_status_canteiros);
    return new;
  end if;

  raise exception 'Perfil sem permissão para gerenciar competências.';
end
$$;

drop trigger if exists trg_competencias_controle_guard on public.competencias_controle;
create trigger trg_competencias_controle_guard
  before update on public.competencias_controle
  for each row execute function public.competencias_controle_guard();

-- ============================================================================
-- PARTE 4: ATIVAÇÃO DE ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table public.colaboradores enable row level security;
alter table public.colaboradores_auth enable row level security;
alter table public.lancamentos enable row level security;
alter table public.dispensas_sptf enable row level security;
alter table public.contracheques enable row level security;
alter table public.insalubridade_records enable row level security;
alter table public.insalubridade enable row level security;
alter table public.resumo_mensal enable row level security;
alter table public.competencias_controle enable row level security;
alter table public.canteiros_obras enable row level security;
alter table public.canteiros enable row level security;
alter table public.unidades_organizacionais enable row level security;
alter table public.admin_users enable row level security;
alter table public.usuarios_sistema enable row level security;
alter table public.system_config enable row level security;
alter table public.institution_settings enable row level security;
alter table public.system_logs enable row level security;
alter table public.logs_auditoria enable row level security;
alter table public.logs_acesso enable row level security;

-- ============================================================================
-- PARTE 5: POLÍTICAS RLS (IDEMPOTENTES COM DROP IF EXISTS)
-- ============================================================================

-- COLABORADORES
drop policy if exists colaboradores_select on public.colaboradores;
create policy colaboradores_select on public.colaboradores
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

drop policy if exists colaboradores_write on public.colaboradores;
create policy colaboradores_write on public.colaboradores
  for insert to authenticated with check ((select public.is_global_admin()));

drop policy if exists colaboradores_update on public.colaboradores;
create policy colaboradores_update on public.colaboradores
  for update to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

drop policy if exists colaboradores_delete on public.colaboradores;
create policy colaboradores_delete on public.colaboradores
  for delete to authenticated using ((select public.is_global_admin()));

-- COLABORADORES_AUTH
drop policy if exists colaboradores_auth_all on public.colaboradores_auth;
create policy colaboradores_auth_all on public.colaboradores_auth
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

-- LANÇAMENTOS
drop policy if exists lancamentos_select on public.lancamentos;
create policy lancamentos_select on public.lancamentos
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

drop policy if exists lancamentos_insert on public.lancamentos;
create policy lancamentos_insert on public.lancamentos
  for insert to authenticated with check (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

drop policy if exists lancamentos_update on public.lancamentos;
create policy lancamentos_update on public.lancamentos
  for update to authenticated
  using ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data))
  with check ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data));

drop policy if exists lancamentos_delete on public.lancamentos;
create policy lancamentos_delete on public.lancamentos
  for delete to authenticated using (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

-- DISPENSAS SPTF
drop policy if exists dispensas_select on public.dispensas_sptf;
create policy dispensas_select on public.dispensas_sptf
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

drop policy if exists dispensas_insert on public.dispensas_sptf;
create policy dispensas_insert on public.dispensas_sptf
  for insert to authenticated with check (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

drop policy if exists dispensas_update on public.dispensas_sptf;
create policy dispensas_update on public.dispensas_sptf
  for update to authenticated
  using ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data))
  with check ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data));

drop policy if exists dispensas_delete on public.dispensas_sptf;
create policy dispensas_delete on public.dispensas_sptf
  for delete to authenticated using (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

-- CONTRACHEQUES
drop policy if exists contracheques_select on public.contracheques;
create policy contracheques_select on public.contracheques
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.contracheque_canteiro_permitido(data)
    )
  );

drop policy if exists contracheques_insert on public.contracheques;
create policy contracheques_insert on public.contracheques
  for insert to authenticated with check (
    (select public.pode_lancar()) and public.contracheque_canteiro_permitido(data)
  );

drop policy if exists contracheques_update on public.contracheques;
create policy contracheques_update on public.contracheques
  for update to authenticated
  using ((select public.pode_lancar()) and public.contracheque_canteiro_permitido(data))
  with check ((select public.pode_lancar()) and public.contracheque_canteiro_permitido(data));

drop policy if exists contracheques_delete on public.contracheques;
create policy contracheques_delete on public.contracheques
  for delete to authenticated using ((select public.is_global_admin()));

-- INSALUBRIDADE
drop policy if exists insalubridade_select on public.insalubridade_records;
create policy insalubridade_select on public.insalubridade_records
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

drop policy if exists insalubridade_insert on public.insalubridade_records;
create policy insalubridade_insert on public.insalubridade_records
  for insert to authenticated with check (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

drop policy if exists insalubridade_update on public.insalubridade_records;
create policy insalubridade_update on public.insalubridade_records
  for update to authenticated
  using ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data))
  with check ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data));

drop policy if exists insalubridade_delete on public.insalubridade_records;
create policy insalubridade_delete on public.insalubridade_records
  for delete to authenticated using (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

drop policy if exists insalubridade_legacy on public.insalubridade;
create policy insalubridade_legacy on public.insalubridade
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

-- RESUMO MENSAL
drop policy if exists resumo_mensal_select on public.resumo_mensal;
create policy resumo_mensal_select on public.resumo_mensal
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

drop policy if exists resumo_mensal_write on public.resumo_mensal;
create policy resumo_mensal_write on public.resumo_mensal
  for insert to authenticated with check ((select public.is_global_admin()));

drop policy if exists resumo_mensal_update on public.resumo_mensal;
create policy resumo_mensal_update on public.resumo_mensal
  for update to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

drop policy if exists resumo_mensal_delete on public.resumo_mensal;
create policy resumo_mensal_delete on public.resumo_mensal
  for delete to authenticated using ((select public.is_super_admin()));

-- COMPETÊNCIAS CONTROLE
drop policy if exists competencias_select on public.competencias_controle;
create policy competencias_select on public.competencias_controle
  for select to authenticated using (true);

drop policy if exists competencias_insert on public.competencias_controle;
create policy competencias_insert on public.competencias_controle
  for insert to authenticated with check ((select public.pode_gerenciar_competencia()));

drop policy if exists competencias_update on public.competencias_controle;
create policy competencias_update on public.competencias_controle
  for update to authenticated
  using (
    (select public.is_global_admin())
    or ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
  )
  with check (
    (select public.is_global_admin())
    or ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
  );

drop policy if exists competencias_delete on public.competencias_controle;
create policy competencias_delete on public.competencias_controle
  for delete to authenticated using ((select public.is_global_admin()));

-- CANTEIROS E UNIDADES ORGANIZACIONAIS
drop policy if exists canteiros_obras_select on public.canteiros_obras;
create policy canteiros_obras_select on public.canteiros_obras
  for select to authenticated using (true);

drop policy if exists canteiros_obras_write on public.canteiros_obras;
create policy canteiros_obras_write on public.canteiros_obras
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

drop policy if exists canteiros_select on public.canteiros;
create policy canteiros_select on public.canteiros
  for select to authenticated using (true);

drop policy if exists canteiros_write on public.canteiros;
create policy canteiros_write on public.canteiros
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

drop policy if exists unidades_select on public.unidades_organizacionais;
create policy unidades_select on public.unidades_organizacionais
  for select to authenticated using (true);

drop policy if exists unidades_write on public.unidades_organizacionais;
create policy unidades_write on public.unidades_organizacionais
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

-- ADMIN USERS
drop policy if exists admin_users_select on public.admin_users;
create policy admin_users_select on public.admin_users
  for select to authenticated using (
    (select public.is_super_admin())
    or (select public.is_rh())
    or (
      (select public.is_gerente_canteiro())
      and coalesce(data ->> 'canteiroSede', '') = public.meu_canteiro()
    )
    or id = public.meu_email()
    or ((select public.is_master_email()) and not (select public.has_admin_doc()))
  );

drop policy if exists admin_users_insert on public.admin_users;
create policy admin_users_insert on public.admin_users
  for insert to authenticated with check (
    (select public.is_super_admin())
    or ((select public.is_master_email()) and not (select public.has_admin_doc()))
    or (select public.is_rh())
  );

drop policy if exists admin_users_update on public.admin_users;
create policy admin_users_update on public.admin_users
  for update to authenticated
  using (
    (select public.is_super_admin())
    or (select public.is_rh())
    or (
      (select public.is_gerente_canteiro())
      and coalesce(data ->> 'canteiroSede', '') = public.meu_canteiro()
      and coalesce(data ->> 'role', data ->> 'nivelAcesso', '') in ('CHEFE_DA', 'AUX_DA', 'ENCARREGADO_DA', 'CHEFE_CANTEIRO')
    )
  )
  with check (
    (select public.is_super_admin())
    or (select public.is_rh())
    or (
      (select public.is_gerente_canteiro())
      and id <> public.meu_email()
      and coalesce(data ->> 'canteiroSede', '') = public.meu_canteiro()
      and coalesce(data ->> 'role', data ->> 'nivelAcesso', '') in ('CHEFE_DA', 'AUX_DA', 'ENCARREGADO_DA', 'CHEFE_CANTEIRO')
    )
  );

drop policy if exists admin_users_delete on public.admin_users;
create policy admin_users_delete on public.admin_users
  for delete to authenticated using ((select public.is_super_admin()));

-- USUARIOS SISTEMA
drop policy if exists usuarios_sistema_select on public.usuarios_sistema;
create policy usuarios_sistema_select on public.usuarios_sistema
  for select to authenticated using (
    (select public.is_super_admin())
    or (select public.is_rh())
    or (
      (select public.is_gerente_canteiro())
      and coalesce(data ->> 'canteiroSede', '') = public.meu_canteiro()
    )
    or id = public.meu_email()
  );

drop policy if exists usuarios_sistema_insert on public.usuarios_sistema;
create policy usuarios_sistema_insert on public.usuarios_sistema
  for insert to authenticated with check ((select public.is_super_admin()));

drop policy if exists usuarios_sistema_update on public.usuarios_sistema;
create policy usuarios_sistema_update on public.usuarios_sistema
  for update to authenticated
  using ((select public.is_super_admin()) or (select public.is_rh()))
  with check ((select public.is_super_admin()) or (select public.is_rh()));

drop policy if exists usuarios_sistema_delete on public.usuarios_sistema;
create policy usuarios_sistema_delete on public.usuarios_sistema
  for delete to authenticated using ((select public.is_super_admin()));

-- LOGS
drop policy if exists logs_acesso_select on public.logs_acesso;
create policy logs_acesso_select on public.logs_acesso
  for select to authenticated using ((select public.is_global_admin()));

drop policy if exists logs_acesso_insert on public.logs_acesso;
create policy logs_acesso_insert on public.logs_acesso
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists logs_acesso_update on public.logs_acesso;
create policy logs_acesso_update on public.logs_acesso
  for update to authenticated using ((select public.is_super_admin()));

drop policy if exists logs_acesso_delete on public.logs_acesso;
create policy logs_acesso_delete on public.logs_acesso
  for delete to authenticated using ((select public.is_super_admin()));

drop policy if exists logs_auditoria_select on public.logs_auditoria;
create policy logs_auditoria_select on public.logs_auditoria
  for select to authenticated using ((select public.is_global_admin()));

drop policy if exists logs_auditoria_insert on public.logs_auditoria;
create policy logs_auditoria_insert on public.logs_auditoria
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists system_logs_select on public.system_logs;
create policy system_logs_select on public.system_logs
  for select to authenticated using ((select public.is_global_admin()));

drop policy if exists system_logs_insert on public.system_logs;
create policy system_logs_insert on public.system_logs
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists system_logs_update on public.system_logs;
create policy system_logs_update on public.system_logs
  for update to authenticated using ((select public.is_super_admin()));

drop policy if exists system_logs_delete on public.system_logs;
create policy system_logs_delete on public.system_logs
  for delete to authenticated using ((select public.is_super_admin()));

-- CONFIGURAÇÕES
drop policy if exists system_config_select on public.system_config;
create policy system_config_select on public.system_config
  for select to anon, authenticated using (true);

drop policy if exists system_config_write on public.system_config;
create policy system_config_write on public.system_config
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

drop policy if exists institution_settings_select on public.institution_settings;
create policy institution_settings_select on public.institution_settings
  for select to anon, authenticated using (true);

drop policy if exists institution_settings_write on public.institution_settings;
create policy institution_settings_write on public.institution_settings
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

-- ============================================================================
-- PARTE 6: REALTIME (PUBLICAÇÃO IDEMPOTENTE)
-- ============================================================================

do $$
declare
  t text;
  tabelas text[] := array[
    'colaboradores',
    'lancamentos',
    'dispensas_sptf',
    'contracheques',
    'insalubridade_records',
    'resumo_mensal',
    'competencias_controle',
    'canteiros_obras',
    'canteiros',
    'unidades_organizacionais',
    'colaboradores_auth',
    'admin_users',
    'usuarios_sistema',
    'system_config',
    'institution_settings',
    'system_logs',
    'logs_auditoria',
    'logs_acesso'
  ];
begin
  foreach t in array tabelas loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- PARTE 7: HARDENING DE SEGURANÇA (REVOGAÇÃO DE EXECUTE E SEARCH_PATH FIXO)
-- ============================================================================

-- 1. Revogação de EXECUTE para anon e authenticated em funções internas de RLS
revoke execute on function public.meu_email() from anon, authenticated;
revoke execute on function public.admin_data() from anon, authenticated;
revoke execute on function public.has_admin_doc() from anon, authenticated;
revoke execute on function public.raw_role() from anon, authenticated;
revoke execute on function public.admin_status() from anon, authenticated;
revoke execute on function public.is_admin_active() from anon, authenticated;
revoke execute on function public.is_master_email() from anon, authenticated;
revoke execute on function public.normalize_role() from anon, authenticated;
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
revoke execute on function public.meu_canteiro() from anon, authenticated;
revoke execute on function public.documento_do_meu_canteiro(jsonb) from anon, authenticated;
revoke execute on function public.canteiro_do_documento(jsonb) from anon, authenticated;
revoke execute on function public.canteiro_permitido(text) from anon, authenticated;
revoke execute on function public.contracheque_canteiro_permitido(jsonb) from anon, authenticated;
revoke execute on function public.competencia_atual() from anon, authenticated;
revoke execute on function public.competencia_anterior(text) from anon, authenticated;
revoke execute on function public.status_competencia_canteiro(text, text) from anon, authenticated;
revoke execute on function public.competencia_atual_aberta(text) from anon, authenticated;
revoke execute on function public.competencia_anterior_fechada(text) from anon, authenticated;
revoke execute on function public.lancamento_competencia_permitido(jsonb) from anon, authenticated;
revoke execute on function public.competencias_controle_guard() from anon, authenticated;

-- 2. Fixar search_path nas funções
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
