-- ============================================================================
-- COMARA — Migração 004: Supabase Auth RBAC com Custom Claims e Login E-mail/Senha
-- Sincroniza perfis de admin_users para auth.users (raw_app_meta_data)
-- Otimiza RLS para leitura a custo zero (0ms) do token JWT com fallback seguro
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. OTIMIZAÇÃO DAS FUNÇÕES DE RLS PARA CONSUMIR CLAIMS DO JWT
-- ----------------------------------------------------------------------------

-- Papel / Nível de Acesso (Lê primeiro dos claims no JWT; fallback para tabela documental)
create or replace function public.raw_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'nivel_acesso', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'nivel_acesso', ''),
    nullif(public.admin_data() ->> 'nivelAcesso', ''),
    nullif(public.admin_data() ->> 'role', ''),
    ''
  )
$$;
revoke execute on function public.raw_role() from anon, authenticated;

-- Status do Administrador (Lê do JWT ou do documento)
create or replace function public.admin_status()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'status', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'status', ''),
    nullif(public.admin_data() ->> 'status', ''),
    case when (public.admin_data() ->> 'ativo') = 'false' then 'inativo' else 'ativo' end
  )
$$;
revoke execute on function public.admin_status() from anon, authenticated;

-- Canteiro / Sede do Usuário
create or replace function public.meu_canteiro()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'canteiro_sede', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'canteiro_sede', ''),
    nullif(public.admin_data() ->> 'sede', ''),
    nullif(public.admin_data() ->> 'canteiroSede', ''),
    'TODAS'
  )
$$;
revoke execute on function public.meu_canteiro() from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. TRIGGER PARA SINCRONIZAR admin_users -> auth.users.raw_app_meta_data
-- ----------------------------------------------------------------------------
-- Quando um perfil é criado ou atualizado na tabela admin_users, sincroniza
-- automaticamente os claims para o usuário correspondente no Supabase Auth.
create or replace function public.sync_admin_user_claims()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_email text;
  target_role text;
  target_sede text;
  target_status text;
  target_ativo boolean;
begin
  target_email := lower(coalesce(new.id, new.data->>'email', ''));
  target_role := coalesce(new.data->>'nivelAcesso', new.data->>'role', 'NENHUM');
  target_sede := coalesce(new.data->>'sede', new.data->>'canteiroSede', 'TODAS');
  target_status := coalesce(new.data->>'status', 'ativo');
  target_ativo := coalesce((new.data->>'ativo')::boolean, true);

  if target_email != '' then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'nivel_acesso', target_role,
      'role', target_role,
      'canteiro_sede', target_sede,
      'status', target_status,
      'ativo', target_ativo
    )
    where lower(email) = target_email;
  end if;

  return new;
end;
$$;
revoke execute on function public.sync_admin_user_claims() from anon, authenticated;

drop trigger if exists trg_sync_admin_user_claims on public.admin_users;
create trigger trg_sync_admin_user_claims
after insert or update on public.admin_users
for each row execute function public.sync_admin_user_claims();

-- ----------------------------------------------------------------------------
-- 3. TRIGGER AO CRIAR NOVO USUÁRIO EM auth.users (INICIALIZA CLAIMS COM PERFIL EXISTENTE)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user_claims()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  existing_profile jsonb;
  target_role text := 'NENHUM';
  target_sede text := 'TODAS';
  target_status text := 'pendente';
  target_ativo boolean := false;
  is_master boolean := false;
begin
  is_master := lower(new.email) in ('comarafab@gmail.com', 'coari.comara@gmail.com');

  -- Busca se já existe cadastro prévio em admin_users
  select data into existing_profile from public.admin_users where lower(id) = lower(new.email) limit 1;

  if existing_profile is not null then
    target_role := coalesce(existing_profile->>'nivelAcesso', existing_profile->>'role', 'NENHUM');
    target_sede := coalesce(existing_profile->>'sede', existing_profile->>'canteiroSede', 'TODAS');
    target_status := coalesce(existing_profile->>'status', 'ativo');
    target_ativo := coalesce((existing_profile->>'ativo')::boolean, true);
  elsif is_master then
    target_role := 'SUPER_ADMIN';
    target_sede := 'TODAS';
    target_status := 'ativo';
    target_ativo := true;
  end if;

  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'nivel_acesso', target_role,
    'role', target_role,
    'canteiro_sede', target_sede,
    'status', target_status,
    'ativo', target_ativo
  );

  return new;
end;
$$;
revoke execute on function public.handle_new_auth_user_claims() from anon, authenticated;

drop trigger if exists trg_handle_new_auth_user_claims on auth.users;
create trigger trg_handle_new_auth_user_claims
before insert on auth.users
for each row execute function public.handle_new_auth_user_claims();

-- ----------------------------------------------------------------------------
-- 4. LIMPEZA DA TABELA LEGADA OBSOLETA (colaboradores_auth)
-- ----------------------------------------------------------------------------
drop table if exists public.colaboradores_auth cascade;
