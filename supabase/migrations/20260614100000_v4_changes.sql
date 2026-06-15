-- =====================================================================
-- Modifications v4 :
--   • Mot de passe temporaire à changer à la première connexion (barbiers)
--   • Assignation d'un client à un barbier + RLS clients par rôle
--   • Comptes barbiers créés avec mot de passe temporaire « Barbier123 »
-- =====================================================================

-- 1) Drapeau « doit changer son mot de passe » (forcé à la 1re connexion)
alter table barbers add column if not exists must_change_password boolean not null default false;

-- 2) Un client peut être assigné à un barbier
alter table clients add column if not exists barber_id uuid references barbers(id) on delete set null;
create index if not exists clients_barber_idx on clients (barber_id);

-- ---------------------------------------------------------------------
-- 3) Création d'un compte barbier : on force must_change_password = true
--    (le mot de passe « Barbier123 » est temporaire).
-- ---------------------------------------------------------------------
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

  insert into barbers (name, color, is_active, role, user_id, email, must_change_password)
    values (p_name, p_color, true, p_role, v_uid, lower(p_email), true)
    returning id into v_barber_id;
  return v_barber_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Réinitialisation d'un mot de passe barbier par l'admin :
--    le nouveau mot de passe est temporaire -> must_change_password = true.
-- ---------------------------------------------------------------------
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
  update barbers set must_change_password = true where id = p_barber_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) L'utilisateur connecté efface son propre drapeau après avoir choisi
--    un nouveau mot de passe (appelé juste après auth.updateUser).
-- ---------------------------------------------------------------------
create or replace function public.clear_my_password_change_flag()
returns void
language sql
security definer
set search_path = public
as $$
  update barbers set must_change_password = false where user_id = auth.uid();
$$;

grant execute on function public.clear_my_password_change_flag() to authenticated;

-- ---------------------------------------------------------------------
-- 6) RLS clients par rôle : l'admin voit tout, le barbier ne voit que ses
--    propres clients (point 3b).
-- ---------------------------------------------------------------------
drop policy if exists "authenticated full clients" on clients;

create policy "admin all clients"
  on clients for all to authenticated
  using (public.current_barber_role() = 'admin')
  with check (public.current_barber_role() = 'admin');

create policy "barber select own clients"
  on clients for select to authenticated
  using (barber_id in (select id from barbers where user_id = auth.uid()));

create policy "barber insert own clients"
  on clients for insert to authenticated
  with check (barber_id in (select id from barbers where user_id = auth.uid()));

create policy "barber update own clients"
  on clients for update to authenticated
  using (barber_id in (select id from barbers where user_id = auth.uid()))
  with check (barber_id in (select id from barbers where user_id = auth.uid()));

create policy "barber delete own clients"
  on clients for delete to authenticated
  using (barber_id in (select id from barbers where user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 7) Réservation en ligne : le client créé est rattaché au barbier choisi
--    (pour qu'il soit visible par ce barbier).
-- ---------------------------------------------------------------------
create or replace function public.book_appointment(
  p_service_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_notes text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  tz constant text := 'America/Toronto';
  v_duration int;
  v_end timestamptz;
  v_local_date date;
  v_local_start time;
  v_local_end time;
  v_weekday int;
  v_open time;
  v_close time;
  v_closed boolean;
  v_mode text;
  v_status appointment_status;
  v_client_id uuid;
  v_appt_id uuid;
begin
  select duration_min into v_duration from services where id = p_service_id and is_active;
  if v_duration is null then
    raise exception 'Service indisponible';
  end if;
  if not exists (select 1 from barbers where id = p_barber_id and is_active) then
    raise exception 'Barbier indisponible';
  end if;

  v_end := p_starts_at + make_interval(mins => v_duration);
  v_local_date := (p_starts_at at time zone tz)::date;
  v_local_start := (p_starts_at at time zone tz)::time;
  v_local_end := (v_end at time zone tz)::time;
  v_weekday := extract(isodow from v_local_date)::int - 1;

  select open_time, close_time, is_closed into v_open, v_close, v_closed
    from business_hours where weekday = v_weekday;
  if v_closed is null or v_closed or v_open is null or v_local_start < v_open or v_local_end > v_close then
    raise exception 'Créneau hors des heures d''ouverture';
  end if;
  if exists (select 1 from closures where date = v_local_date and (barber_id is null or barber_id = p_barber_id)) then
    raise exception 'Le salon est fermé à cette date';
  end if;
  if p_starts_at <= now() then
    raise exception 'Le créneau est déjà passé';
  end if;
  if exists (
    select 1 from appointments a
    where a.barber_id = p_barber_id and a.status <> 'cancelled'
      and a.starts_at < v_end and a.ends_at > p_starts_at
  ) then
    raise exception 'Créneau déjà réservé';
  end if;

  select value into v_mode from settings where key = 'online_booking_mode';
  v_status := case when v_mode = 'auto' then 'confirmed' else 'pending' end::appointment_status;

  insert into clients (first_name, last_name, phone, email, barber_id)
    values (
      coalesce(nullif(trim(p_first_name), ''), 'Client'),
      nullif(trim(p_last_name), ''),
      nullif(trim(p_phone), ''),
      nullif(trim(p_email), ''),
      p_barber_id
    )
    returning id into v_client_id;

  insert into appointments (client_id, service_id, barber_id, starts_at, ends_at, status, source, notes)
    values (v_client_id, p_service_id, p_barber_id, p_starts_at, v_end, v_status, 'online', nullif(trim(p_notes), ''))
    returning id into v_appt_id;

  return json_build_object('id', v_appt_id, 'status', v_status);
end;
$$;
