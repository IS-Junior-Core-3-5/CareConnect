-- Address validation: keep provider coordinates in sync with the address and
-- let sign-up carry the coordinates returned by the U.S. Census geocoder.
--
-- The app checks every address with the geocode-address edge function before
-- saving it. These rules are the database side of that contract: a changed
-- address can never keep the old point, and a new sign-up stores the point that
-- was validated in the sign-up form.
--
-- Coordinates are optional. When the geocoder is unavailable the address is
-- still saved, and the profile page fills the point on the next save.

begin;

-- ---------------------------------------------------------------------
-- 1. Drop stale provider coordinates when the address changes.
--    Listing saves and the admin RPCs set the new coordinates in the same
--    UPDATE, so this only clears a point that was left behind.
-- ---------------------------------------------------------------------
create or replace function public.clear_stale_provider_coordinates()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.address is distinct from old.address
     and new.latitude is not distinct from old.latitude
     and new.longitude is not distinct from old.longitude then
    new.latitude := null;
    new.longitude := null;
  end if;
  return new;
end $$;

drop trigger if exists clear_stale_provider_coordinates on public.providers;
create trigger clear_stale_provider_coordinates
  before update of address on public.providers
  for each row execute function public.clear_stale_provider_coordinates();

-- Reject out-of-range points even if a client sends them directly.
alter table public.providers
  drop constraint if exists provider_latitude_range,
  drop constraint if exists provider_longitude_range;
alter table public.providers
  add constraint provider_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint provider_longitude_range check (longitude is null or longitude between -180 and 180);

-- ---------------------------------------------------------------------
-- 2. Do the same for the private parent address. The profile page and the
--    sign-up trigger write the new point in the same statement, so this only
--    clears a point left behind by an address-only edit (for example an admin
--    family edit).
-- ---------------------------------------------------------------------
create or replace function public.clear_stale_parent_coordinates()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.address is distinct from old.address
     and new.latitude is not distinct from old.latitude
     and new.longitude is not distinct from old.longitude then
    new.latitude := null;
    new.longitude := null;
    new.geocoded_at := null;
  end if;
  return new;
end $$;

drop trigger if exists clear_stale_parent_coordinates on public.parent_private_addresses;
create trigger clear_stale_parent_coordinates
  before update of address on public.parent_private_addresses
  for each row execute function public.clear_stale_parent_coordinates();

alter table public.parent_private_addresses
  drop constraint if exists parent_latitude_range,
  drop constraint if exists parent_longitude_range;
alter table public.parent_private_addresses
  add constraint parent_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint parent_longitude_range check (longitude is null or longitude between -180 and 180);

-- ---------------------------------------------------------------------
-- 3. New sign-ups store the coordinates validated in the sign-up form.
--    This replaces the function from 20261107010000_parent_profile_address.sql
--    and keeps all of its existing behavior.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $func$
declare
  m   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  pid text  := new.id::text;
  c   jsonb;
  s   jsonb;
  lang text;
  lat numeric;
  lon numeric;
begin
  insert into public.parents (id, auth_user_id, name, email, neighborhood, blurb)
  values (
    pid,
    new.id,
    coalesce(nullif(trim(m->>'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(m->>'neighborhood'), ''),
    nullif(trim(m->>'blurb'), '')
  )
  on conflict (id) do nothing;

  -- Only trust well-formed, in-range coordinates from the sign-up metadata.
  lat := case
    when (m->>'latitude') ~ '^-?[0-9]+([.][0-9]+)?$' then (m->>'latitude')::numeric
  end;
  lon := case
    when (m->>'longitude') ~ '^-?[0-9]+([.][0-9]+)?$' then (m->>'longitude')::numeric
  end;
  if lat is null or lon is null or lat not between -90 and 90 or lon not between -180 and 180 then
    lat := null;
    lon := null;
  end if;

  insert into public.parent_private_addresses (parent_id, address, latitude, longitude, geocoded_at)
  values (
    pid,
    nullif(trim(m->>'address'), ''),
    lat,
    lon,
    case when lat is not null then now() end
  )
  on conflict (parent_id) do update
    set address = excluded.address,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        geocoded_at = excluded.geocoded_at;

  for c in select * from jsonb_array_elements(coalesce(m->'children', '[]'::jsonb)) loop
    insert into public.children (parent_id, name, age)
    values (pid, coalesce(nullif(trim(c->>'name'), ''), 'Child'), nullif(c->>'age', '')::smallint);
  end loop;

  lang := nullif(trim(m->>'language'), '');
  if lang is not null then
    insert into public.languages (name) values (lang) on conflict (name) do nothing;
    insert into public.parent_languages (parent_id, language_id)
    select pid, id from public.languages where name = lang on conflict do nothing;
  end if;

  for s in select * from jsonb_array_elements(coalesce(m->'schedule', '[]'::jsonb)) loop
    insert into public.parent_availability (parent_id, day_of_week, block)
    values (pid, (s->>0)::smallint, (s->>1)::public.time_block) on conflict do nothing;
  end loop;

  return new;
end
$func$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;
