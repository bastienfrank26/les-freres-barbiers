-- =====================================================================
-- Correctif : les comptes créés en SQL doivent avoir les colonnes de
-- tokens à '' (chaîne vide) et non NULL, sinon GoTrue échoue à la
-- connexion ("Database error querying schema").
-- + fonction pour rattacher un compte à un barbier existant
-- + fonction pour changer le rôle d'un barbier.
-- =====================================================================

-- Crée un compte de connexion et l'attache à un barbier EXISTANT (admin only).
create or replace function public.admin_create_account_for_barber(
  p_barber_id uuid,
  p_email text,
  p_password text,
  p_role text default 'barber'
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid := gen_random_uuid();
begin
  if coalesce((select role from barbers where user_id = auth.uid()), '') <> 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if p_role not in ('admin', 'barber') then
    raise exception 'Rôle invalide';
  end if;
  if not exists (select 1 from barbers where id = p_barber_id) then
    raise exception 'Barbier introuvable';
  end if;
  if (select user_id from barbers where id = p_barber_id) is not null then
    raise exception 'Ce barbier a déjà un compte';
  end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'Un compte existe déjà avec ce courriel';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', lower(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)), 'email', now(), now(), now()
  );

  update barbers set user_id = v_uid, email = lower(p_email), role = p_role where id = p_barber_id;
end;
$$;

-- Crée un nouveau barbier AVEC son compte (admin only) — version corrigée (tokens '').
create or replace function public.admin_create_barber(
  p_name text,
  p_email text,
  p_password text,
  p_color text default '#b87333',
  p_role text default 'barber'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid := gen_random_uuid();
  v_barber_id uuid;
begin
  if coalesce((select role from barbers where user_id = auth.uid()), '') <> 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if p_role not in ('admin', 'barber') then
    raise exception 'Rôle invalide';
  end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'Un compte existe déjà avec ce courriel';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', lower(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    v_uid::text, v_uid, jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)), 'email', now(), now(), now()
  );

  insert into barbers (name, color, is_active, role, user_id, email)
    values (p_name, p_color, true, p_role, v_uid, lower(p_email))
    returning id into v_barber_id;
  return v_barber_id;
end;
$$;

-- Change le rôle d'un barbier (admin only).
create or replace function public.admin_set_barber_role(p_barber_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((select role from barbers where user_id = auth.uid()), '') <> 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  if p_role not in ('admin', 'barber') then
    raise exception 'Rôle invalide';
  end if;
  update barbers set role = p_role where id = p_barber_id;
end;
$$;

grant execute on function public.admin_create_account_for_barber(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_barber_role(uuid, text) to authenticated;
