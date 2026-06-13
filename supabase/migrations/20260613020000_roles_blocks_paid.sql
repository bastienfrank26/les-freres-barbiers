-- =====================================================================
-- Modifications CRM : statut "Payé", plages bloquées, rôles barbiers
-- + gestion des comptes de connexion (création / mot de passe) via RPC.
-- =====================================================================

-- 1) Nouveau statut "paid" (Payé)
alter type appointment_status add value if not exists 'paid';

-- 2) Plages bloquées : un rendez-vous peut être une simple plage bloquée
--    (sans client ni service).
alter table appointments alter column service_id drop not null;
alter table appointments add column if not exists is_block boolean not null default false;

-- 3) Rôles barbiers + lien vers un compte de connexion
alter table barbers add column if not exists role text not null default 'barber'
  check (role in ('admin', 'barber'));
alter table barbers add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table barbers add column if not exists email text;

-- Le barbier "Admin" devient administrateur et est rattaché au compte info@…
update barbers b
set role = 'admin',
    user_id = u.id,
    email = u.email
from auth.users u
where u.email = 'info@les-freres-barbiers.com' and b.name = 'Admin';

-- 4) Rôle de l'utilisateur connecté (pour le gating côté app)
create or replace function public.current_barber_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from barbers where user_id = auth.uid() limit 1;
$$;

-- 5) Création d'un compte barbier (réservé aux administrateurs)
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
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', lower(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
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

-- 6) Réinitialisation du mot de passe d'un barbier (réservé aux administrateurs)
create or replace function public.admin_set_barber_password(p_barber_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid;
begin
  if coalesce((select role from barbers where user_id = auth.uid()), '') <> 'admin' then
    raise exception 'Réservé aux administrateurs';
  end if;
  select user_id into v_uid from barbers where id = p_barber_id;
  if v_uid is null then
    raise exception 'Ce barbier n''a pas de compte de connexion';
  end if;
  update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    where id = v_uid;
end;
$$;

grant execute on function public.current_barber_role() to authenticated;
grant execute on function public.admin_create_barber(text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_barber_password(uuid, text) to authenticated;
