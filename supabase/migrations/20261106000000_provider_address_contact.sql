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

update public.providers
set address = case id
    when 'maya-okafor' then '100 Demo Oak Lane, Maplewood (demo)'
    when 'daniel-reyes' then '200 Demo School Road, Riverside (demo)'
    when 'sunny-meadows' then '300 Demo Garden Street, Oak Hill (demo)'
    when 'little-lantern' then '400 Demo Lantern Way, Larkspur (demo)'
    when 'grace-lindqvist' then '500 Demo Maple Avenue, Maplewood (demo)'
    when 'harborview-kids' then '600 Demo Harbor Road, Riverside (demo)'
    when 'willow-bend' then '800 Demo Willow Lane, Larkspur (demo)'
  end,
  phone = case id
    when 'maya-okafor' then '(202) 555-0101'
    when 'daniel-reyes' then '(202) 555-0102'
    when 'sunny-meadows' then '(202) 555-0103'
    when 'little-lantern' then '(202) 555-0104'
    when 'grace-lindqvist' then '(202) 555-0105'
    when 'harborview-kids' then '(202) 555-0106'
    when 'willow-bend' then '(202) 555-0108'
  end
where owner_id is null
  and id in ('maya-okafor', 'daniel-reyes', 'sunny-meadows', 'little-lantern',
             'grace-lindqvist', 'harborview-kids', 'willow-bend');
