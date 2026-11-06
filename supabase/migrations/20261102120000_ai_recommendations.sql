-- AI provider recommendations (Claude via the recommend-providers Edge Function).
-- Adds a cache table + a function that gathers match facts for the logged-in parent.
-- Safe to apply to the live project: adds objects only.

-- ---------------------------------------------------------------------
-- 1. Cached recommendations: one set per parent, replaced on each refresh
-- ---------------------------------------------------------------------
create table if not exists public.ai_recommendations (
  id           bigint generated always as identity primary key,
  parent_id    text not null references public.parents(id)   on delete cascade,
  provider_id  text not null references public.providers(id) on delete cascade,
  rank         smallint not null,
  match_score  smallint check (match_score between 0 and 100),
  headline     text not null,              -- one-line pitch shown on the card
  details      jsonb not null default '{}', -- answers for the "Why?" style buttons
  summary      text,                       -- what this family most needs (same on every row of a set)
  model        text,
  created_at   timestamptz not null default now(),
  unique (parent_id, provider_id)
);
create index if not exists ai_recommendations_parent_idx on public.ai_recommendations (parent_id, rank);

alter table public.ai_recommendations enable row level security;
create policy "own recs read"   on public.ai_recommendations for select to authenticated using (parent_id = my_parent_id());
create policy "own recs insert" on public.ai_recommendations for insert to authenticated with check (parent_id = my_parent_id());
create policy "own recs delete" on public.ai_recommendations for delete to authenticated using (parent_id = my_parent_id());

-- ---------------------------------------------------------------------
-- 2. Facts about every provider relative to the logged-in parent.
--    Claude receives these and does the ranking + explanations.
-- ---------------------------------------------------------------------
create or replace function public.provider_match_features()
returns table (
  provider_id          text,
  name                 text,
  care_type            care_type,
  blurb                text,
  bio                  text,
  daily_rate           numeric,
  daily_rate_max       numeric,
  pricing_notes        text[],
  address              text,
  distance_miles       numeric,
  verified             boolean,
  schedule_available   boolean,
  schedule_summary     text,
  rating               numeric,
  review_count         int,
  review_snippets      text[],
  need_blocks          int,      -- blocks the parent needs care
  covered_blocks       int,      -- of those, blocks this provider covers
  gap_blocks           text[],   -- needed blocks this provider does NOT cover
  languages            text[],
  shared_languages     text[],
  credentials          text[],
  is_favorite          boolean,
  my_confirmed_bookings int
)
language sql stable security invoker set search_path = public as $$
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
  from provider_summary s;
$$;

revoke execute on function public.provider_match_features() from public, anon;
grant  execute on function public.provider_match_features() to authenticated;
