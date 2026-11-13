-- Admin CRUD: create, edit, and delete providers, bookings, and families.
-- Apply after 20261114000000_admin_ai.sql.
-- Safe to apply to the live project: replaces two guard functions, extends one
-- admin view, and adds security-definer RPCs. Existing rules for families and
-- providers are unchanged. Every write below is recorded in admin_audit_log.
--
-- Deletes are real deletes. Deleting a provider or family cascades to its
-- dependent rows (availability, favorites, bookings, reviews, and so on), so the
-- admin UI must confirm before calling these functions.

-- ---------------------------------------------------------------------
-- 1. Let admins write directory fields.
--    The guard still protects normal listing owners. Admins can only reach
--    these writes through the audited RPCs below because they have no direct
--    INSERT/UPDATE/DELETE grant on providers.
-- ---------------------------------------------------------------------
create or replace function public.guard_provider_directory_fields()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    if tg_op = 'INSERT' and (new.listing_origin <> 'owned' or not new.is_public) then
      raise exception 'Only provider-owned public listings may be created';
    end if;
    if tg_op = 'UPDATE' and (new.listing_origin is distinct from old.listing_origin
        or new.is_public is distinct from old.is_public) then
      raise exception 'Listing origin and visibility cannot be changed by listing owners';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Expose the fields the admin edit form needs.
--    Appending columns at the end keeps the existing view contract intact.
-- ---------------------------------------------------------------------
create or replace view public.admin_provider_list
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.care_type,
  p.address,
  p.phone,
  p.verified,
  p.is_public,
  p.listing_origin,
  p.owner_id,
  p.website_url,
  p.contact_url,
  p.source_url,
  p.checked_on,
  p.schedule_available,
  p.photo_key,
  p.created_at,
  coalesce(r.rating, 0)::numeric as rating,
  coalesce(r.review_count, 0)::int as review_count,
  coalesce(c.credential_count, 0)::int as credential_count,
  coalesce(c.verified_credential_count, 0)::int as verified_credential_count,
  p.blurb,
  p.bio,
  p.daily_rate,
  p.daily_rate_max,
  p.distance_miles,
  p.latitude,
  p.longitude,
  p.schedule_summary,
  p.profile_photo_path
from public.providers p
left join (
  select provider_id,
         round(avg((score_experience + score_values + score_communication + score_safety) / 4.0), 1) as rating,
         count(*)::int as review_count
  from public.reviews
  group by provider_id
) r on r.provider_id = p.id
left join (
  select provider_id,
         count(*)::int as credential_count,
         count(*) filter (where verified)::int as verified_credential_count
  from public.provider_credentials
  group by provider_id
) c on c.provider_id = p.id
where public.is_admin();

revoke all on public.admin_provider_list from public, anon;
grant select on public.admin_provider_list to authenticated;

-- ---------------------------------------------------------------------
-- 3. Admin booking writes.
--    Admins may set any field, including parent/provider/date/block and
--    status, because these functions are the audited maintenance path.
--    Normal parent/provider rules are unchanged.
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
    if public.is_admin() then
      return new;
    end if;
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
    if public.is_admin() then
      new.updated_at := now();
      return new;
    end if;
    if (new.parent_id, new.provider_id, new.care_date, new.block, new.created_at)
       is distinct from
       (old.parent_id, old.provider_id, old.care_date, old.block, old.created_at) then
      raise exception 'A request cannot change its parent, provider, date, or time';
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
-- 4. Provider CRUD
-- ---------------------------------------------------------------------
create or replace function public.admin_create_provider(
  p_id text,
  p_name text,
  p_care_type public.care_type,
  p_listing_origin text default 'owned',
  p_is_public boolean default true,
  p_verified boolean default false,
  p_blurb text default null,
  p_bio text default null,
  p_address text default null,
  p_phone text default null,
  p_daily_rate numeric default null,
  p_daily_rate_max numeric default null,
  p_distance_miles numeric default null,
  p_schedule_available boolean default true,
  p_schedule_summary text default null,
  p_photo_key text default null,
  p_website_url text default null,
  p_contact_url text default null,
  p_source_url text default null,
  p_checked_on date default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.providers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider public.providers;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_id text := nullif(btrim(coalesce(p_id, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if v_name is null then
    raise exception 'Provider name is required';
  end if;

  if v_id is null then
    v_id := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
    if v_id = '' then
      v_id := 'provider-' || substr(gen_random_uuid()::text, 1, 8);
    end if;
  end if;

  if exists (select 1 from public.providers where id = v_id) then
    raise exception 'A provider with id "%" already exists', v_id using errcode = '23505';
  end if;

  if p_listing_origin not in ('owned', 'external', 'sample') then
    raise exception 'Unknown listing origin: %', p_listing_origin;
  end if;

  if p_daily_rate is not null and p_daily_rate < 0 then
    raise exception 'Daily rate cannot be negative';
  end if;

  if p_daily_rate_max is not null and (p_daily_rate is null or p_daily_rate_max < p_daily_rate) then
    raise exception 'Maximum daily rate must be greater than or equal to the daily rate';
  end if;

  insert into public.providers (
    id, name, care_type, listing_origin, is_public, verified, blurb, bio,
    address, phone, daily_rate, daily_rate_max, distance_miles,
    schedule_available, schedule_summary, photo_key, website_url, contact_url,
    source_url, checked_on, latitude, longitude
  ) values (
    v_id, v_name, p_care_type, p_listing_origin, p_is_public, p_verified,
    nullif(btrim(coalesce(p_blurb, '')), ''),
    nullif(btrim(coalesce(p_bio, '')), ''),
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_daily_rate, p_daily_rate_max, p_distance_miles,
    p_schedule_available,
    nullif(btrim(coalesce(p_schedule_summary, '')), ''),
    nullif(btrim(coalesce(p_photo_key, '')), ''),
    nullif(btrim(coalesce(p_website_url, '')), ''),
    nullif(btrim(coalesce(p_contact_url, '')), ''),
    nullif(btrim(coalesce(p_source_url, '')), ''),
    p_checked_on, p_latitude, p_longitude
  )
  returning * into v_provider;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'provider.create',
    'provider',
    v_provider.id,
    to_jsonb(v_provider)
  );

  return v_provider;
end;
$$;

comment on function public.admin_create_provider(text, text, public.care_type, text, boolean, boolean, text, text, text, text, numeric, numeric, numeric, boolean, text, text, text, text, text, date, numeric, numeric) is
  'Admin-only provider creation. Writes an admin_audit_log entry.';

revoke all on function public.admin_create_provider(text, text, public.care_type, text, boolean, boolean, text, text, text, text, numeric, numeric, numeric, boolean, text, text, text, text, text, date, numeric, numeric) from public, anon;
grant execute on function public.admin_create_provider(text, text, public.care_type, text, boolean, boolean, text, text, text, text, numeric, numeric, numeric, boolean, text, text, text, text, text, date, numeric, numeric) to authenticated;

create or replace function public.admin_update_provider(
  p_id text,
  p_name text,
  p_care_type public.care_type,
  p_listing_origin text default 'owned',
  p_is_public boolean default true,
  p_verified boolean default false,
  p_blurb text default null,
  p_bio text default null,
  p_address text default null,
  p_phone text default null,
  p_daily_rate numeric default null,
  p_daily_rate_max numeric default null,
  p_distance_miles numeric default null,
  p_schedule_available boolean default true,
  p_schedule_summary text default null,
  p_photo_key text default null,
  p_website_url text default null,
  p_contact_url text default null,
  p_source_url text default null,
  p_checked_on date default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.providers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider public.providers;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.providers where id = p_id) then
    raise exception 'Provider not found: %', p_id using errcode = 'P0002';
  end if;

  if v_name is null then
    raise exception 'Provider name is required';
  end if;

  if p_listing_origin not in ('owned', 'external', 'sample') then
    raise exception 'Unknown listing origin: %', p_listing_origin;
  end if;

  if p_daily_rate is not null and p_daily_rate < 0 then
    raise exception 'Daily rate cannot be negative';
  end if;

  if p_daily_rate_max is not null and (p_daily_rate is null or p_daily_rate_max < p_daily_rate) then
    raise exception 'Maximum daily rate must be greater than or equal to the daily rate';
  end if;

  update public.providers set
    name = v_name,
    care_type = p_care_type,
    listing_origin = p_listing_origin,
    is_public = p_is_public,
    verified = p_verified,
    blurb = nullif(btrim(coalesce(p_blurb, '')), ''),
    bio = nullif(btrim(coalesce(p_bio, '')), ''),
    address = nullif(btrim(coalesce(p_address, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    daily_rate = p_daily_rate,
    daily_rate_max = p_daily_rate_max,
    distance_miles = p_distance_miles,
    schedule_available = p_schedule_available,
    schedule_summary = nullif(btrim(coalesce(p_schedule_summary, '')), ''),
    photo_key = nullif(btrim(coalesce(p_photo_key, '')), ''),
    website_url = nullif(btrim(coalesce(p_website_url, '')), ''),
    contact_url = nullif(btrim(coalesce(p_contact_url, '')), ''),
    source_url = nullif(btrim(coalesce(p_source_url, '')), ''),
    checked_on = p_checked_on,
    latitude = p_latitude,
    longitude = p_longitude
  where id = p_id
  returning * into v_provider;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'provider.update',
    'provider',
    v_provider.id,
    to_jsonb(v_provider)
  );

  return v_provider;
end;
$$;

comment on function public.admin_update_provider(text, text, public.care_type, text, boolean, boolean, text, text, text, text, numeric, numeric, numeric, boolean, text, text, text, text, text, date, numeric, numeric) is
  'Admin-only provider edit. Writes an admin_audit_log entry.';

revoke all on function public.admin_update_provider(text, text, public.care_type, text, boolean, boolean, text, text, text, text, numeric, numeric, numeric, boolean, text, text, text, text, text, date, numeric, numeric) from public, anon;
grant execute on function public.admin_update_provider(text, text, public.care_type, text, boolean, boolean, text, text, text, text, numeric, numeric, numeric, boolean, text, text, text, text, text, date, numeric, numeric) to authenticated;

create or replace function public.admin_delete_provider(p_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider public.providers;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_provider from public.providers where id = p_id for update;
  if v_provider.id is null then
    raise exception 'Provider not found: %', p_id using errcode = 'P0002';
  end if;

  delete from public.providers where id = p_id;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'provider.delete',
    'provider',
    v_provider.id,
    jsonb_build_object('name', v_provider.name, 'listing_origin', v_provider.listing_origin)
  );

  return v_provider.name;
end;
$$;

comment on function public.admin_delete_provider(text) is
  'Admin-only provider delete. Cascades to dependent rows and writes an admin_audit_log entry.';

revoke all on function public.admin_delete_provider(text) from public, anon;
grant execute on function public.admin_delete_provider(text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Booking CRUD
-- ---------------------------------------------------------------------
create or replace function public.admin_create_booking(
  p_parent_id text,
  p_provider_id text,
  p_care_date date,
  p_block public.time_block,
  p_status text default 'pending',
  p_resolution_note text default null
)
returns public.care_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.care_bookings;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'confirmed', 'declined', 'cancelled') then
    raise exception 'Unknown booking status: %', p_status;
  end if;

  if not exists (select 1 from public.parents where id = p_parent_id) then
    raise exception 'Family not found: %', p_parent_id using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.providers where id = p_provider_id) then
    raise exception 'Provider not found: %', p_provider_id using errcode = 'P0002';
  end if;

  insert into public.care_bookings
    (parent_id, provider_id, care_date, block, status, resolution_note)
  values (
    p_parent_id, p_provider_id, p_care_date, p_block, p_status,
    nullif(btrim(coalesce(p_resolution_note, '')), '')
  )
  returning * into v_booking;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'booking.create',
    'booking',
    v_booking.id::text,
    to_jsonb(v_booking)
  );

  return v_booking;
end;
$$;

comment on function public.admin_create_booking(text, text, date, public.time_block, text, text) is
  'Admin-only booking creation. Bypasses the participant guard but writes an admin_audit_log entry.';

revoke all on function public.admin_create_booking(text, text, date, public.time_block, text, text) from public, anon;
grant execute on function public.admin_create_booking(text, text, date, public.time_block, text, text) to authenticated;

create or replace function public.admin_update_booking(
  p_booking_id uuid,
  p_parent_id text,
  p_provider_id text,
  p_care_date date,
  p_block public.time_block,
  p_status text,
  p_resolution_note text default null
)
returns public.care_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.care_bookings;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'confirmed', 'declined', 'cancelled') then
    raise exception 'Unknown booking status: %', p_status;
  end if;

  if not exists (select 1 from public.care_bookings where id = p_booking_id) then
    raise exception 'Booking not found: %', p_booking_id using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.parents where id = p_parent_id) then
    raise exception 'Family not found: %', p_parent_id using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.providers where id = p_provider_id) then
    raise exception 'Provider not found: %', p_provider_id using errcode = 'P0002';
  end if;

  update public.care_bookings set
    parent_id = p_parent_id,
    provider_id = p_provider_id,
    care_date = p_care_date,
    block = p_block,
    status = p_status,
    resolution_note = nullif(btrim(coalesce(p_resolution_note, '')), '')
  where id = p_booking_id
  returning * into v_booking;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'booking.update',
    'booking',
    v_booking.id::text,
    to_jsonb(v_booking)
  );

  return v_booking;
end;
$$;

comment on function public.admin_update_booking(uuid, text, text, date, public.time_block, text, text) is
  'Admin-only booking edit. Writes an admin_audit_log entry.';

revoke all on function public.admin_update_booking(uuid, text, text, date, public.time_block, text, text) from public, anon;
grant execute on function public.admin_update_booking(uuid, text, text, date, public.time_block, text, text) to authenticated;

create or replace function public.admin_delete_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.care_bookings;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_booking from public.care_bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Booking not found: %', p_booking_id using errcode = 'P0002';
  end if;

  delete from public.care_bookings where id = p_booking_id;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'booking.delete',
    'booking',
    v_booking.id::text,
    to_jsonb(v_booking)
  );

  return v_booking.id;
end;
$$;

comment on function public.admin_delete_booking(uuid) is
  'Admin-only booking delete. Writes an admin_audit_log entry.';

revoke all on function public.admin_delete_booking(uuid) from public, anon;
grant execute on function public.admin_delete_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Family CRUD
--    A family created here has no login account. Use Maintain Users to
--    create a sign-in account; this screen maintains the family record.
-- ---------------------------------------------------------------------
create or replace function public.admin_create_parent(
  p_id text,
  p_name text,
  p_email text default null,
  p_neighborhood text default null,
  p_blurb text default null,
  p_address text default null
)
returns public.parents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.parents;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_id text := nullif(btrim(coalesce(p_id, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if v_name is null then
    raise exception 'Family name is required';
  end if;

  if v_id is null then
    v_id := 'p-' || btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
    if v_id = 'p-' then
      v_id := 'p-' || substr(gen_random_uuid()::text, 1, 8);
    end if;
  end if;

  if exists (select 1 from public.parents where id = v_id) then
    raise exception 'A family with id "%" already exists', v_id using errcode = '23505';
  end if;

  insert into public.parents (id, name, email, neighborhood, blurb)
  values (
    v_id, v_name,
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_neighborhood, '')), ''),
    nullif(btrim(coalesce(p_blurb, '')), '')
  )
  returning * into v_parent;

  insert into public.parent_private_addresses (parent_id, address)
  values (v_id, nullif(btrim(coalesce(p_address, '')), ''))
  on conflict (parent_id) do update set address = excluded.address;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'parent.create',
    'parent',
    v_parent.id,
    to_jsonb(v_parent)
  );

  return v_parent;
end;
$$;

comment on function public.admin_create_parent(text, text, text, text, text, text) is
  'Admin-only family record creation. Does not create a login account. Writes an admin_audit_log entry.';

revoke all on function public.admin_create_parent(text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_parent(text, text, text, text, text, text) to authenticated;

create or replace function public.admin_update_parent(
  p_id text,
  p_name text,
  p_email text default null,
  p_neighborhood text default null,
  p_blurb text default null,
  p_address text default null
)
returns public.parents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.parents;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.parents where id = p_id) then
    raise exception 'Family not found: %', p_id using errcode = 'P0002';
  end if;

  if v_name is null then
    raise exception 'Family name is required';
  end if;

  update public.parents set
    name = v_name,
    email = nullif(btrim(coalesce(p_email, '')), ''),
    neighborhood = nullif(btrim(coalesce(p_neighborhood, '')), ''),
    blurb = nullif(btrim(coalesce(p_blurb, '')), '')
  where id = p_id
  returning * into v_parent;

  insert into public.parent_private_addresses (parent_id, address)
  values (p_id, nullif(btrim(coalesce(p_address, '')), ''))
  on conflict (parent_id) do update set address = excluded.address;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'parent.update',
    'parent',
    v_parent.id,
    to_jsonb(v_parent)
  );

  return v_parent;
end;
$$;

comment on function public.admin_update_parent(text, text, text, text, text, text) is
  'Admin-only family record edit. Writes an admin_audit_log entry.';

revoke all on function public.admin_update_parent(text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_parent(text, text, text, text, text, text) to authenticated;

create or replace function public.admin_delete_parent(p_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.parents;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_parent from public.parents where id = p_id for update;
  if v_parent.id is null then
    raise exception 'Family not found: %', p_id using errcode = 'P0002';
  end if;

  if v_parent.auth_user_id = auth.uid() then
    raise exception 'You cannot delete your own family profile';
  end if;

  delete from public.parents where id = p_id;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'parent.delete',
    'parent',
    v_parent.id,
    jsonb_build_object('name', v_parent.name, 'email', v_parent.email)
  );

  return v_parent.name;
end;
$$;

comment on function public.admin_delete_parent(text) is
  'Admin-only family delete. Cascades to the family''s private data and writes an admin_audit_log entry.';

revoke all on function public.admin_delete_parent(text) from public, anon;
grant execute on function public.admin_delete_parent(text) to authenticated;
