-- Admin seed (DEV/LOCAL)
--
-- Tujuan:
--   - bikin user email/password di Supabase Auth (auth.users)
--   - set user tsb jadi admin via tabel public.admin_users
--
-- Catatan penting:
--   - Kalau kamu di hosted Supabase dan tidak mau sentuh auth schema via SQL, bikin user via Dashboard,
--     lalu cukup insert ke public.admin_users.
--   - Error 500 /auth/v1/token ("Database error querying schema") sering terjadi kalau user dibuat via SQL
--     tapi beberapa kolom token di auth.users berisi NULL. Script ini otomatis "repair" jadi '' (empty string)
--     agar signInWithPassword jalan.

-- =============================================================
-- Option 0 (default): Create-if-missing + repair + grant admin
-- =============================================================
do $$
declare
  v_email text := 'admin@contoh.com';
  v_password text := 'admin12345';
  v_user_id uuid;
  v_instance_id uuid;
  v_encrypted_password text;
  v_now timestamptz := now();
begin
  -- Best-effort extensions (ignore errors if not allowed)
  begin
    execute 'create extension if not exists pgcrypto with schema extensions';
  exception
    when others then null;
  end;
  begin
    execute 'create extension if not exists "uuid-ossp" with schema extensions';
  exception
    when others then null;
  end;

  select u.id into v_user_id
  from auth.users u
  where u.email = v_email
  limit 1;

  if v_user_id is null then
    begin
      select i.id into v_instance_id
      from auth.instances i
      limit 1;
    exception
      when undefined_table then v_instance_id := null;
    end;

    if v_instance_id is null then
      v_instance_id := '00000000-0000-0000-0000-000000000000';
    end if;

    begin
      v_user_id := gen_random_uuid();
    exception
      when undefined_function then
        begin
          v_user_id := extensions.uuid_generate_v4();
        exception
          when undefined_function or invalid_schema_name then
            raise exception 'No UUID generator found (gen_random_uuid / extensions.uuid_generate_v4).';
        end;
    end;

    begin
      v_encrypted_password := crypt(v_password, gen_salt('bf'));
    exception
      when undefined_function then
        raise exception 'Missing pgcrypto functions (crypt/gen_salt). Enable pgcrypto before running this seed.';
    end;

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    ) values (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_password,
      v_now,
      v_now,
      v_now,
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      '{}'::jsonb
    );

    raise notice 'Created auth user: % (id=%)', v_email, v_user_id;
  else
    raise notice 'Auth user already exists: % (id=%)', v_email, v_user_id;
  end if;

  -- Repair NULL token fields -> empty string (prevents 500 on password login in some versions)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'confirmation_token'
  ) then
    update auth.users set confirmation_token = coalesce(confirmation_token, '') where id = v_user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'recovery_token'
  ) then
    update auth.users set recovery_token = coalesce(recovery_token, '') where id = v_user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_change_token_new'
  ) then
    update auth.users set email_change_token_new = coalesce(email_change_token_new, '') where id = v_user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_change_token_current'
  ) then
    update auth.users set email_change_token_current = coalesce(email_change_token_current, '') where id = v_user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_change'
  ) then
    update auth.users set email_change = coalesce(email_change, '') where id = v_user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'phone_change'
  ) then
    update auth.users set phone_change = coalesce(phone_change, '') where id = v_user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'phone_change_token'
  ) then
    update auth.users set phone_change_token = coalesce(phone_change_token, '') where id = v_user_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'reauthentication_token'
  ) then
    update auth.users set reauthentication_token = coalesce(reauthentication_token, '') where id = v_user_id;
  end if;

  -- Ensure confirmed timestamps
  -- NOTE: In some Supabase Auth schemas, confirmed_at is a GENERATED column and cannot be updated.
  -- We only set email_confirmed_at; confirmed_at will follow automatically if generated.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'confirmed_at'
      and coalesce(is_generated, 'NEVER') = 'NEVER'
  ) then
    begin
      update auth.users set confirmed_at = coalesce(confirmed_at, v_now) where id = v_user_id;
    exception
      when others then null;
    end;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, v_now) where id = v_user_id;
  end if;

  -- Grant admin role
  insert into public.admin_users (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  raise notice 'Granted admin role to user_id=%', v_user_id;
end $$;

-- =============================================================
-- Option A: Grant admin by email (recommended)
-- =============================================================
-- (Use this if the Auth user already exists and you don't want to create it via SQL)
--
-- insert into public.admin_users (user_id)
-- select id
-- from auth.users
-- where email = 'admin@contoh.com'
-- on conflict (user_id) do nothing;

-- =============================================================
-- Option B: Grant admin by UUID
-- =============================================================
-- Replace the UUID below.
-- insert into public.admin_users (user_id)
-- values ('00000000-0000-0000-0000-000000000000')
-- on conflict (user_id) do nothing;

-- =============================================================
-- Verify admins
-- =============================================================
select au.user_id, u.email, au.inserted_at
from public.admin_users au
join auth.users u on u.id = au.user_id
order by au.inserted_at desc;

-- =============================================================
-- Quick check: recent auth users
-- =============================================================
select id, email, created_at
from auth.users
order by created_at desc
limit 20;
