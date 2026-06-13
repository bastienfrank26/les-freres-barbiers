-- =====================================================================
-- Réservation en ligne (landing -> CRM)
-- Fonctions SECURITY DEFINER appelables par le rôle anon : la création
-- directe sur appointments/clients reste interdite par la RLS ; tout passe
-- par ces fonctions qui valident côté serveur.
-- Fuseau du salon : America/Toronto.
-- =====================================================================

-- Créneaux disponibles d'un barbier pour un service à une date donnée.
create or replace function public.available_slots(p_service_id uuid, p_barber_id uuid, p_date date)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  tz constant text := 'America/Toronto';
  v_step constant int := 30;            -- granularité des créneaux (minutes)
  v_weekday int := extract(isodow from p_date)::int - 1;  -- 0 = lundi
  v_open time;
  v_close time;
  v_closed boolean;
  v_duration int;
  v_cursor timestamptz;
  v_close_ts timestamptz;
  v_end timestamptz;
begin
  select open_time, close_time, is_closed into v_open, v_close, v_closed
    from business_hours where weekday = v_weekday;
  if v_closed is null or v_closed or v_open is null or v_close is null then
    return;
  end if;
  if exists (select 1 from closures where date = p_date and (barber_id is null or barber_id = p_barber_id)) then
    return;
  end if;
  select duration_min into v_duration from services where id = p_service_id and is_active;
  if v_duration is null then
    return;
  end if;

  v_cursor := (p_date + v_open) at time zone tz;
  v_close_ts := (p_date + v_close) at time zone tz;

  while v_cursor + make_interval(mins => v_duration) <= v_close_ts loop
    v_end := v_cursor + make_interval(mins => v_duration);
    if v_cursor > now() and not exists (
      select 1 from appointments a
      where a.barber_id = p_barber_id
        and a.status <> 'cancelled'
        and a.starts_at < v_end
        and a.ends_at > v_cursor
    ) then
      return next to_char(v_cursor at time zone tz, 'HH24:MI');
    end if;
    v_cursor := v_cursor + make_interval(mins => v_step);
  end loop;
  return;
end;
$$;

-- Réservation : crée le client et le rendez-vous après validation complète.
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

  insert into clients (first_name, last_name, phone, email)
    values (
      coalesce(nullif(trim(p_first_name), ''), 'Client'),
      nullif(trim(p_last_name), ''),
      nullif(trim(p_phone), ''),
      nullif(trim(p_email), '')
    )
    returning id into v_client_id;

  insert into appointments (client_id, service_id, barber_id, starts_at, ends_at, status, source, notes)
    values (v_client_id, p_service_id, p_barber_id, p_starts_at, v_end, v_status, 'online', nullif(trim(p_notes), ''))
    returning id into v_appt_id;

  return json_build_object('id', v_appt_id, 'status', v_status);
end;
$$;

grant execute on function public.available_slots(uuid, uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, text, text) to anon, authenticated;
