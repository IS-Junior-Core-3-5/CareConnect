-- Admin bookings: read every care request, resolve problems, and keep an audit trail.
-- Apply after 20261111000000_admin_foundation.sql.
-- Safe to apply to the live project: adds a column, view, policy and functions.
-- Families and providers keep their existing rules; admins gain read access and
-- can only change status through the audited RPC below.

-- ---------------------------------------------------------------------
-- 1. Optional note shown to the family and provider when an admin
--    declines or cancels a request.
-- ---------------------------------------------------------------------
alter table public.care_bookings
  add column if not exists resolution_note text;

-- ---------------------------------------------------------------------
-- 2. Admins can read every booking.
-- ---------------------------------------------------------------------
drop policy if exists "admins read bookings" on public.care_bookings;
create policy "admins read bookings" on public.care_bookings
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Let the admin RPC change status without tripping the participant
--    guard. Every rule for parents and providers stays the same.
-- ---------------------------------------------------------------------
create or replace function public.validate_care_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  provider_owner uuid;
  provider_has_schedule boolean;
begin
  select owner_id, schedule_available into provider_owner, provider_has_schedule
  from public.providers where id = new.provider_id;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.care_date < current_date then
      raise exception 'New care requests must be pending and dated today or later';
    end if;
    if provider_owner is null or provider_owner = auth.uid() then
      raise exception 'Choose a provider who manages their own listing';
    end if;
    if not provider_has_schedule or not exists (
      select 1 from public.provider_availability a
      where a.provider_id = new.provider_id
        and a.day_of_week = extract(isodow from new.care_date)::int - 1
        and a.block = new.block
    ) then
      raise exception 'Provider is unavailable for this block';
    end if;
  else
    if (new.parent_id, new.provider_id, new.care_date, new.block, new.created_at)
       is distinct from
       (old.parent_id, old.provider_id, old.care_date, old.block, old.created_at) then
      raise exception 'A request cannot change its parent, provider, date, or time';
    end if;
    if public.is_admin() then
      new.updated_at := now();
      return new;
    end if;
    if auth.uid() = provider_owner then
      if old.status <> 'pending' or new.status not in ('confirmed', 'declined') then
        raise exception 'Provider can only confirm or decline a pending request';
      end if;
      if new.status = 'confirmed' and (
        new.care_date < current_date or not provider_has_schedule or not exists (
          select 1 from public.provider_availability a
          where a.provider_id = new.provider_id
            and a.day_of_week = extract(isodow from new.care_date)::int - 1
            and a.block = new.block
        )
      ) then
        raise exception 'Provider is unavailable for this block';
      end if;
    elsif old.parent_id = public.my_parent_id() then
      if old.status not in ('pending', 'confirmed') or new.status <> 'cancelled' then
        raise exception 'Parent can only cancel a pending or confirmed request';
      end if;
    else
      raise exception 'You cannot change this request';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. Admin booking list
--    One row per booking with family and provider names, an overdue flag,
--    and whether this family has rebooked this provider before.
--    Non-admins get no rows.
-- ---------------------------------------------------------------------
create or replace view public.admin_booking_list
with (security_invoker = true) as
select
  b.id,
  b.parent_id,
  p.name as parent_name,
  b.provider_id,
  pr.name as provider_name,
  b.care_date,
  b.block,
  b.status,
  b.resolution_note,
  b.created_at,
  b.updated_at,
  (b.status = 'pending' and b.created_at < now() - interval '2 days') as is_overdue,
  coalesce(rc.confirmed_bookings, 0)::int as parent_provider_confirmed_bookings,
  coalesce(rc.confirmed_bookings, 0) > 1 as parent_provider_rebooking
from public.care_bookings b
join public.parents p on p.id = b.parent_id
join public.providers pr on pr.id = b.provider_id
left join (
  select parent_id, provider_id, count(*)::int as confirmed_bookings
  from public.care_bookings
  where status = 'confirmed'
  group by parent_id, provider_id
) rc on rc.parent_id = b.parent_id and rc.provider_id = b.provider_id
where public.is_admin();

revoke all on public.admin_booking_list from public, anon;
grant select on public.admin_booking_list to authenticated;

-- ---------------------------------------------------------------------
-- 5. Admin resolution RPC
--    Allows pending -> confirmed/declined/cancelled and
--    confirmed -> cancelled. Every call is audited.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_booking_status(
  p_booking_id uuid,
  p_status text,
  p_reason text default null
)
returns public.care_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.care_bookings;
  v_from text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'confirmed', 'declined', 'cancelled') then
    raise exception 'Unknown booking status: %', p_status;
  end if;

  select * into v_booking from public.care_bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Booking not found: %', p_booking_id using errcode = 'P0002';
  end if;

  v_from := v_booking.status;

  if v_from = p_status then
    raise exception 'Booking is already %', p_status;
  end if;

  if not (
    (v_from = 'pending' and p_status in ('confirmed', 'declined', 'cancelled'))
    or (v_from = 'confirmed' and p_status = 'cancelled')
  ) then
    raise exception 'Cannot change a % booking to %', v_from, p_status;
  end if;

  if p_status = 'confirmed' then
    if v_booking.care_date < current_date then
      raise exception 'The care date has already passed';
    end if;
    if not exists (
      select 1 from public.providers pr
      where pr.id = v_booking.provider_id and pr.schedule_available
    ) or not exists (
      select 1 from public.provider_availability a
      where a.provider_id = v_booking.provider_id
        and a.day_of_week = extract(isodow from v_booking.care_date)::int - 1
        and a.block = v_booking.block
    ) then
      raise exception 'Provider is unavailable for this block';
    end if;
    if exists (
      select 1 from public.care_bookings b
      where b.provider_id = v_booking.provider_id
        and b.care_date = v_booking.care_date
        and b.block = v_booking.block
        and b.status = 'confirmed'
        and b.id <> v_booking.id
    ) then
      raise exception 'Another booking is already confirmed for this provider, date, and block';
    end if;
  end if;

  update public.care_bookings
  set status = p_status,
      resolution_note = case
        when p_status in ('declined', 'cancelled') then v_reason
        else null
      end
  where id = p_booking_id
  returning * into v_booking;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'booking.update_status',
    'booking',
    p_booking_id::text,
    jsonb_strip_nulls(jsonb_build_object('from', v_from, 'to', p_status, 'reason', v_reason))
  );

  return v_booking;
end;
$$;

revoke all on function public.admin_set_booking_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_booking_status(uuid, text, text) to authenticated;
