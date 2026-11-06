-- Add provider contact details, backfill every listing, and remove the provider neighborhood field.
-- These sample values are fictional placeholders that listing owners can replace.
alter table public.providers
  add column if not exists address text,
  add column if not exists phone text;

grant select (address, phone) on public.providers to anon, authenticated;
revoke insert, update on public.providers from authenticated;
grant insert (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, address, phone, distance_miles,
              latitude, longitude, schedule_available, schedule_summary, photo_key, owner_id)
  on public.providers to authenticated;
grant update (name, care_type, blurb, bio, daily_rate, daily_rate_max, address, phone, distance_miles,
              latitude, longitude, schedule_available, schedule_summary, photo_key)
  on public.providers to authenticated;

-- Fill every current provider listing with clearly fictional demo contact details.
-- Generated addresses use a fictional demo locality; the provider neighborhood field is removed below.
-- 202-555-0100 through 202-555-0199 are reserved fictional phone numbers.
with numbered as (
  select id, row_number() over (order by id) as n
  from public.providers
)
update public.providers as p
set address = format(
      '%s Demo Care Lane, CareConnect Demo City, CA 90000',
      100 + numbered.n
    ),
    phone = format(
      '(202) 555-%s',
      lpad((100 + ((numbered.n - 1) % 100))::text, 4, '0')
    )
from numbered
where p.id = numbered.id;

alter table public.providers drop column if exists neighborhood;
