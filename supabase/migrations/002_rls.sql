-- ============================================================================
-- COMARA — Migração 002: Row Level Security (RLS)
-- Espelha o modelo de segurança do legado firestore.rules
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNÇÕES AUXILIARES (SECURITY DEFINER para evitar recursão de RLS em admin_users)
-- ----------------------------------------------------------------------------

-- E-mail do usuário autenticado no JWT (minúsculas)
create or replace function public.meu_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Conteúdo do documento admin_users do usuário (ou null)
create or replace function public.admin_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select a.data from public.admin_users a where a.id = public.meu_email() limit 1
$$;

create or replace function public.has_admin_doc()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.id = public.meu_email())
$$;

-- Papel bruto (nivelAcesso tem precedência sobre role, como no legado)
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

-- Normalização de perfis legados (mesma matriz do firestore.rules)
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

-- O perfil vem ESTRITAMENTE de admin_users; e-mail master só vale para bootstrap
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

-- ----------------------------------------------------------------------------
-- ESCOPO DE CANTEIRO
-- ----------------------------------------------------------------------------
create or replace function public.meu_canteiro()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_data() ->> 'canteiroSede', '')
$$;

-- Documento pertence ao canteiro do usuário (aceita sedeCodigo/employeeSede/sede)
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

-- Contracheques guardam sede em formato livre (ex.: "KO-DL")
create or replace function public.contracheque_canteiro_permitido(doc jsonb)
returns boolean language sql stable as $$
  select public.is_global_admin()
      or (
        public.meu_canteiro() <> ''
        and coalesce(doc ->> 'sede', '') <> ''
        and lower(doc ->> 'sede') like '%' || lower(public.meu_canteiro()) || '%'
      )
$$;

-- ----------------------------------------------------------------------------
-- COMPETÊNCIAS (janela de lançamento — espelha firestore.rules)
-- ----------------------------------------------------------------------------
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

-- Ausência de controle = liberado (primeiro mês, canteiro novo, implantação)
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

-- Atualização de competências_controle: gerente/chefe/DA altera APENAS o
-- próprio canteiro dentro de statusCanteiros. Como políticas RLS não comparam
-- a linha antiga com a nova, a restrição é aplicada por trigger que restringe
-- (clamp) a escrita automaticamente — espelhando a regra de diff do legado.
create or replace function public.competencias_controle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meu text;
  novo_status_canteiros jsonb;
begin
  -- Perfis globais alteram a competência livremente.
  if public.is_global_admin() then
    return new;
  end if;

  if (public.is_gerente_canteiro() or public.is_da() or public.is_chefe_canteiro()) then
    meu := public.meu_canteiro();
    if meu = '' then
      raise exception 'Perfil sem canteiro vinculado não pode alterar competências.';
    end if;

    -- Clampa: mantém todos os campos antigos e aceita apenas statusCanteiros[meu].
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

-- ----------------------------------------------------------------------------
-- ATIVAÇÃO DO RLS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- COLABORADORES
-- ----------------------------------------------------------------------------
create policy colaboradores_select on public.colaboradores
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

create policy colaboradores_write on public.colaboradores
  for insert to authenticated with check ((select public.is_global_admin()));

create policy colaboradores_update on public.colaboradores
  for update to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

create policy colaboradores_delete on public.colaboradores
  for delete to authenticated using ((select public.is_global_admin()));

-- ----------------------------------------------------------------------------
-- COLABORADORES_AUTH (credenciais presenciadas — restrito a perfis globais)
-- ----------------------------------------------------------------------------
create policy colaboradores_auth_all on public.colaboradores_auth
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

-- ----------------------------------------------------------------------------
-- LANÇAMENTOS
-- ----------------------------------------------------------------------------
create policy lancamentos_select on public.lancamentos
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

create policy lancamentos_insert on public.lancamentos
  for insert to authenticated with check (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

create policy lancamentos_update on public.lancamentos
  for update to authenticated
  using ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data))
  with check ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data));

create policy lancamentos_delete on public.lancamentos
  for delete to authenticated using (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

-- ----------------------------------------------------------------------------
-- DISPENSAS SPTF
-- ----------------------------------------------------------------------------
create policy dispensas_select on public.dispensas_sptf
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

create policy dispensas_insert on public.dispensas_sptf
  for insert to authenticated with check (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

create policy dispensas_update on public.dispensas_sptf
  for update to authenticated
  using ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data))
  with check ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data));

create policy dispensas_delete on public.dispensas_sptf
  for delete to authenticated using (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

-- ----------------------------------------------------------------------------
-- CONTRACHEQUES (dado importado da folha — não depende de competência aberta)
-- ----------------------------------------------------------------------------
create policy contracheques_select on public.contracheques
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.contracheque_canteiro_permitido(data)
    )
  );

create policy contracheques_insert on public.contracheques
  for insert to authenticated with check (
    (select public.pode_lancar()) and public.contracheque_canteiro_permitido(data)
  );

create policy contracheques_update on public.contracheques
  for update to authenticated
  using ((select public.pode_lancar()) and public.contracheque_canteiro_permitido(data))
  with check ((select public.pode_lancar()) and public.contracheque_canteiro_permitido(data));

create policy contracheques_delete on public.contracheques
  for delete to authenticated using ((select public.is_global_admin()));

-- ----------------------------------------------------------------------------
-- INSALUBRIDADE
-- ----------------------------------------------------------------------------
create policy insalubridade_select on public.insalubridade_records
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

create policy insalubridade_insert on public.insalubridade_records
  for insert to authenticated with check (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

create policy insalubridade_update on public.insalubridade_records
  for update to authenticated
  using ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data))
  with check ((select public.pode_lancar()) and public.lancamento_competencia_permitido(data));

create policy insalubridade_delete on public.insalubridade_records
  for delete to authenticated using (
    (select public.pode_lancar()) and public.lancamento_competencia_permitido(data)
  );

create policy insalubridade_legacy on public.insalubridade
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

-- ----------------------------------------------------------------------------
-- RESUMO MENSAL
-- ----------------------------------------------------------------------------
create policy resumo_mensal_select on public.resumo_mensal
  for select to authenticated using (
    (select public.is_global_admin())
    or (
      (select public.is_admin_active())
      and ((select public.is_gerente_canteiro()) or (select public.is_da()) or (select public.is_chefe_canteiro()))
      and public.documento_do_meu_canteiro(data)
    )
  );

create policy resumo_mensal_write on public.resumo_mensal
  for insert to authenticated with check ((select public.is_global_admin()));

create policy resumo_mensal_update on public.resumo_mensal
  for update to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

create policy resumo_mensal_delete on public.resumo_mensal
  for delete to authenticated using ((select public.is_super_admin()));

-- ----------------------------------------------------------------------------
-- COMPETÊNCIAS CONTROLE
-- ----------------------------------------------------------------------------
create policy competencias_select on public.competencias_controle
  for select to authenticated using (true);

create policy competencias_insert on public.competencias_controle
  for insert to authenticated with check ((select public.pode_gerenciar_competencia()));

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

create policy competencias_delete on public.competencias_controle
  for delete to authenticated using ((select public.is_global_admin()));

-- ----------------------------------------------------------------------------
-- CANTEIROS / UNIDADES ORGANIZACIONAIS
-- ----------------------------------------------------------------------------
create policy canteiros_obras_select on public.canteiros_obras
  for select to authenticated using (true);

create policy canteiros_obras_write on public.canteiros_obras
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

create policy canteiros_select on public.canteiros
  for select to authenticated using (true);

create policy canteiros_write on public.canteiros
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

create policy unidades_select on public.unidades_organizacionais
  for select to authenticated using (true);

create policy unidades_write on public.unidades_organizacionais
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

-- ----------------------------------------------------------------------------
-- ADMIN USERS
-- - usuário comum lê apenas o próprio registro; não pode promover a si mesmo
-- - SUPER_ADMIN administra tudo; RH administra perfis; gerente administra DA/AUX do próprio canteiro
-- ----------------------------------------------------------------------------
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

create policy admin_users_insert on public.admin_users
  for insert to authenticated with check (
    (select public.is_super_admin())
    or ((select public.is_master_email()) and not (select public.has_admin_doc()))
    or (select public.is_rh())
  );

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
      -- gerente: não pode promover a si mesmo nem alterar o próprio papel
      (select public.is_gerente_canteiro())
      and id <> public.meu_email()
      and coalesce(data ->> 'canteiroSede', '') = public.meu_canteiro()
      and coalesce(data ->> 'role', data ->> 'nivelAcesso', '') in ('CHEFE_DA', 'AUX_DA', 'ENCARREGADO_DA', 'CHEFE_CANTEIRO')
    )
  );

create policy admin_users_delete on public.admin_users
  for delete to authenticated using ((select public.is_super_admin()));

-- ----------------------------------------------------------------------------
-- USUARIOS SISTEMA (espelho de admin_users)
-- ----------------------------------------------------------------------------
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

create policy usuarios_sistema_insert on public.usuarios_sistema
  for insert to authenticated with check ((select public.is_super_admin()));

create policy usuarios_sistema_update on public.usuarios_sistema
  for update to authenticated
  using ((select public.is_super_admin()) or (select public.is_rh()))
  with check ((select public.is_super_admin()) or (select public.is_rh()));

create policy usuarios_sistema_delete on public.usuarios_sistema
  for delete to authenticated using ((select public.is_super_admin()));

-- ----------------------------------------------------------------------------
-- LOGS (criação liberada para autenticados; leitura global)
-- ----------------------------------------------------------------------------
create policy logs_acesso_select on public.logs_acesso
  for select to authenticated using ((select public.is_global_admin()));

create policy logs_acesso_insert on public.logs_acesso
  for insert to authenticated with check (true);

create policy logs_acesso_update on public.logs_acesso
  for update to authenticated using ((select public.is_super_admin()));

create policy logs_acesso_delete on public.logs_acesso
  for delete to authenticated using ((select public.is_super_admin()));

create policy logs_auditoria_select on public.logs_auditoria
  for select to authenticated using ((select public.is_global_admin()));

create policy logs_auditoria_insert on public.logs_auditoria
  for insert to authenticated with check (true);

-- logs_auditoria: imutável (sem update/delete, como no legado)

create policy system_logs_select on public.system_logs
  for select to authenticated using ((select public.is_global_admin()));

create policy system_logs_insert on public.system_logs
  for insert to authenticated with check (true);

create policy system_logs_update on public.system_logs
  for update to authenticated using ((select public.is_super_admin()));

create policy system_logs_delete on public.system_logs
  for delete to authenticated using ((select public.is_super_admin()));

-- ----------------------------------------------------------------------------
-- CONFIGURAÇÕES (leitura pública; escrita restrita a perfis globais)
-- ----------------------------------------------------------------------------
create policy system_config_select on public.system_config
  for select to anon, authenticated using (true);

create policy system_config_write on public.system_config
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));

create policy institution_settings_select on public.institution_settings
  for select to anon, authenticated using (true);

create policy institution_settings_write on public.institution_settings
  for all to authenticated
  using ((select public.is_global_admin()))
  with check ((select public.is_global_admin()));
