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
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'providers'
      and column_name = 'neighborhood'
  ) then
    execute $backfill$
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
      where p.id = numbered.id
    $backfill$;
  else
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
  end if;
end $$;


-- Rebuild the dependent summary view and AI RPC without provider neighborhood.
drop function if exists public.provider_match_features();
drop view if exists public.provider_summary;
alter table public.providers drop column if exists neighborhood;

create view public.provider_summary with (security_invoker = true) as
select p.id, p.owner_id, p.name, p.care_type, p.blurb, p.bio,
       p.daily_rate, p.daily_rate_max, p.address, p.phone, p.distance_miles,
       p.latitude, p.longitude, p.verified, p.schedule_available,
       p.schedule_summary, p.photo_key, p.created_at,
       round(avg((r.score_experience + r.score_values + r.score_communication + r.score_safety) / 4.0), 1) as rating,
       count(r.id)::int as review_count
from public.providers p
left join public.reviews r on r.provider_id = p.id
group by p.id;
grant select on public.provider_summary to anon, authenticated;

create function public.provider_match_features()
returns table (
  provider_id text,
  name text,
  care_type care_type,
  blurb text,
  bio text,
  daily_rate numeric,
  daily_rate_max numeric,
  pricing_notes text[],
  address text,
  distance_miles numeric,
  verified boolean,
  schedule_available boolean,
  schedule_summary text,
  rating numeric,
  review_count int,
  review_snippets text[],
  need_blocks int,
  covered_blocks int,
  gap_blocks text[],
  languages text[],
  shared_languages text[],
  credentials text[],
  is_favorite boolean,
  my_confirmed_bookings int
)
language sql stable security invoker set search_path = public as $func$
  with me    as (select my_parent_id() as id),
       need  as (select day_of_week, block from parent_availability where parent_id = (select id from me)),
       plang as (select language_id from parent_languages where parent_id = (select id from me))
  select s.id, s.name, s.care_type, s.blurb, s.bio, s.daily_rate, s.daily_rate_max,
         array(select n.note from provider_pricing_notes n where n.provider_id = s.id order by n.sort_order),
         s.address, s.distance_miles, s.verified, s.schedule_available, s.schedule_summary,
         s.rating, s.review_count,
         array(select left(r.body, 200) from reviews r where r.provider_id = s.id and r.body is not null
                order by r.reviewed_on desc limit 3),
         (select count(*) from need)::int,
         (select count(*) from provider_availability pa
            join need n on n.day_of_week = pa.day_of_week and n.block = pa.block
           where pa.provider_id = s.id)::int,
         array(select (array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[n.day_of_week + 1] || ' ' || n.block
                 from need n
                where not exists (select 1 from provider_availability pa
                                   where pa.provider_id = s.id and pa.day_of_week = n.day_of_week and pa.block = n.block)
                order by n.day_of_week, n.block),
         array(select l.name from provider_languages pl join languages l on l.id = pl.language_id
                where pl.provider_id = s.id order by l.name),
         array(select l.name from provider_languages pl join languages l on l.id = pl.language_id
                where pl.provider_id = s.id and pl.language_id in (select language_id from plang) order by l.name),
         array(select c.name || case when c.verified then ' (verified)' else ' (self-reported)' end
                 from provider_credentials c where c.provider_id = s.id),
         exists (select 1 from favorites f where f.parent_id = (select id from me) and f.provider_id = s.id),
         coalesce((select rt.confirmed_bookings from rebook_tracking rt
                    where rt.parent_id = (select id from me) and rt.provider_id = s.id), 0)
  from public.provider_summary s;
$func$;

revoke execute on function public.provider_match_features() from public, anon;
grant execute on function public.provider_match_features() to authenticated;

