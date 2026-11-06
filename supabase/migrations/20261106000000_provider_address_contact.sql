-- Add provider contact details and backfill only unowned demo fixtures.
-- These sample values are fictional; listing owners should replace them with verified details.
alter table public.providers
  add column if not exists address text,
  add column if not exists phone text;

grant select (address, phone) on public.providers to anon, authenticated;
revoke insert, update on public.providers from authenticated;
grant insert (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, address, phone, neighborhood, distance_miles,
              latitude, longitude, schedule_available, schedule_summary, photo_key, owner_id)
  on public.providers to authenticated;
grant update (name, care_type, blurb, bio, daily_rate, daily_rate_max, address, phone, neighborhood, distance_miles,
              latitude, longitude, schedule_available, schedule_summary, photo_key)
  on public.providers to authenticated;

-- Fill every current provider listing with clearly fictional demo contact details.
-- Addresses use the existing neighborhood as the locality when available.
-- 202-555-0100 through 202-555-0199 are reserved fictional phone numbers.
with numbered as (
  select id, row_number() over (order by id) as n
  from public.providers
)
update public.providers as p
set address = format(
      '%s Demo Care Lane, %s, CA 90000',
      100 + numbered.n,
      coalesce(nullif(trim(p.neighborhood), ''), 'CareConnect Demo City')
    ),
    phone = format(
      '(202) 555-%s',
      lpad((100 + ((numbered.n - 1) % 100))::text, 4, '0')
    )
from numbered
where p.id = numbered.id;
