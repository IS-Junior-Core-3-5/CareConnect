-- =====================================================================
-- CareConnect — relational schema (Supabase / Postgres)
-- Built from the PRD (Must + Should Have) and the current codebase.
-- Run in Supabase: SQL Editor -> New query -> paste whole file -> Run.
-- Safe to re-run: it drops and rebuilds the CareConnect tables.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Move the old JSON tables (id, data jsonb) out of the way.
--    They are renamed to legacy_*, not deleted.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['providers','parents','posts'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'data')
       and not exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = 'legacy_' || t) then
      execute format('alter table public.%I rename to %I', t, 'legacy_' || t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1. Clean rebuild of CareConnect objects
-- ---------------------------------------------------------------------
drop view  if exists provider_summary;
drop table if exists reply_mentions, post_mentions, post_replies, posts,
                     parent_connections, favorites, reviews, provider_past_families,
                     parent_availability, provider_availability,
                     children, parent_languages, provider_languages, languages,
                     provider_credentials, provider_pricing_notes, provider_photos,
                     parents, providers cascade;
drop type  if exists care_type, time_block;

create type care_type  as enum ('Daycare', 'Preschool', 'Sitter', 'Family Friend');
create type time_block as enum ('Morning', 'Afternoon', 'Evening');  -- 7-12, 12-5, 5-9

-- ---------------------------------------------------------------------
-- 2. Core entities
-- ---------------------------------------------------------------------
create table providers (
  id                  text primary key,                 -- URL slug, e.g. 'maya-okafor'
  name                text not null,
  care_type           care_type not null,               -- Must: filter by type
  blurb               text,
  bio                 text,
  daily_rate          numeric(8,2) check (daily_rate >= 0),       -- Must: price. NULL = pricing unavailable (BR 10)
  daily_rate_max      numeric(8,2) check (daily_rate_max >= daily_rate),
  neighborhood        text,
  distance_miles      numeric(5,2),                     -- demo value until map/geo is built
  latitude            numeric(9,6),                     -- Could: map
  longitude           numeric(9,6),
  verified            boolean not null default false,   -- Could: verified badge
  schedule_available  boolean not null default true,    -- false = schedule unknown (BR 11)
  schedule_summary    text,
  photo_key           text,                             -- main photo
  created_at          timestamptz not null default now()
);

create table parents (
  id             text primary key,                      -- e.g. 'p-jordan'
  auth_user_id   uuid unique,                           -- links to auth.users once login is added
  name           text not null,
  email          text unique,
  neighborhood   text,
  blurb          text,
  created_at     timestamptz not null default now()
);

create table children (
  id         bigint generated always as identity primary key,
  parent_id  text not null references parents(id) on delete cascade,
  name       text not null,
  age        smallint check (age between 0 and 18)
);

-- ---------------------------------------------------------------------
-- 3. Provider details (price notes, photos, licenses)
-- ---------------------------------------------------------------------
create table provider_pricing_notes (
  id           bigint generated always as identity primary key,
  provider_id  text not null references providers(id) on delete cascade,
  note         text not null,                           -- e.g. 'Half day: $85'
  sort_order   smallint not null default 0
);

create table provider_photos (
  id           bigint generated always as identity primary key,
  provider_id  text not null references providers(id) on delete cascade,
  photo_key    text not null,
  sort_order   smallint not null default 0
);

create table provider_credentials (                     -- Could: certifications / licenses
  id           bigint generated always as identity primary key,
  provider_id  text not null references providers(id) on delete cascade,
  name         text not null,                           -- e.g. 'Pediatric CPR & First Aid'
  verified     boolean not null default false
);

-- ---------------------------------------------------------------------
-- 4. Languages (Should: language on profile) — many-to-many
-- ---------------------------------------------------------------------
create table languages (
  id    smallint generated always as identity primary key,
  name  text not null unique
);

create table provider_languages (
  provider_id  text     not null references providers(id) on delete cascade,
  language_id  smallint not null references languages(id) on delete cascade,
  primary key (provider_id, language_id)
);

create table parent_languages (
  parent_id    text     not null references parents(id) on delete cascade,
  language_id  smallint not null references languages(id) on delete cascade,
  primary key (parent_id, language_id)
);

-- ---------------------------------------------------------------------
-- 5. Schedules (Must: calendar + overlap compare, BR 3/4/7)
--    One row = one available block. 7 days x 3 blocks.
-- ---------------------------------------------------------------------
create table provider_availability (
  provider_id  text       not null references providers(id) on delete cascade,
  day_of_week  smallint   not null check (day_of_week between 0 and 6),  -- 0 = Mon
  block        time_block not null,
  primary key (provider_id, day_of_week, block)
);

create table parent_availability (                      -- times the parent NEEDS care
  parent_id    text       not null references parents(id) on delete cascade,
  day_of_week  smallint   not null check (day_of_week between 0 and 6),
  block        time_block not null,
  primary key (parent_id, day_of_week, block)
);

-- ---------------------------------------------------------------------
-- 6. Trust (Must: trust; Should: detailed ratings)
-- ---------------------------------------------------------------------
create table reviews (
  id                   bigint generated always as identity primary key,
  provider_id          text not null references providers(id) on delete cascade,
  parent_id            text not null references parents(id)   on delete cascade,
  body                 text,
  score_experience     smallint not null check (score_experience    between 1 and 5),
  score_values         smallint not null check (score_values        between 1 and 5),
  score_communication  smallint not null check (score_communication between 1 and 5),
  score_safety         smallint not null check (score_safety        between 1 and 5),
  reviewed_on          date not null default current_date,
  unique (provider_id, parent_id)                       -- one review per family per provider
);

create table provider_past_families (                   -- families who have used this provider
  provider_id  text not null references providers(id) on delete cascade,
  parent_id    text not null references parents(id)   on delete cascade,
  primary key (provider_id, parent_id)
);

-- ---------------------------------------------------------------------
-- 7. Favorites + parent connections (Should)
-- ---------------------------------------------------------------------
create table favorites (
  parent_id    text not null references parents(id)   on delete cascade,
  provider_id  text not null references providers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (parent_id, provider_id)
);

create table parent_connections (
  parent_id            text not null references parents(id) on delete cascade,
  connected_parent_id  text not null references parents(id) on delete cascade,
  created_at           timestamptz not null default now(),
  primary key (parent_id, connected_parent_id),
  check (parent_id <> connected_parent_id)
);

-- ---------------------------------------------------------------------
-- 8. Message board (Should)
-- ---------------------------------------------------------------------
create table posts (
  id          text primary key,                         -- slug, e.g. 'split-week'
  author_id   text not null references parents(id) on delete cascade,
  category    text not null,                            -- Schedules / Pricing / Recommendations
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table post_replies (
  id          bigint generated always as identity primary key,
  post_id     text not null references posts(id)   on delete cascade,
  author_id   text not null references parents(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table post_mentions (                            -- providers tagged in a post
  post_id      text not null references posts(id)     on delete cascade,
  provider_id  text not null references providers(id) on delete cascade,
  primary key (post_id, provider_id)
);

create table reply_mentions (
  reply_id     bigint not null references post_replies(id) on delete cascade,
  provider_id  text   not null references providers(id)    on delete cascade,
  primary key (reply_id, provider_id)
);

-- ---------------------------------------------------------------------
-- 9. Indexes for search / filter (Must: search & filter, BR 1/8)
-- ---------------------------------------------------------------------
create index on providers (care_type);
create index on providers (daily_rate);
create index on providers (neighborhood);
create index on reviews (provider_id);
create index on post_replies (post_id);
create index on children (parent_id);

-- ---------------------------------------------------------------------
-- 10. Search-results view: price + schedule + trust in one row (BR 12)
-- ---------------------------------------------------------------------
create view provider_summary with (security_invoker = true) as
select p.*,
       round(avg((r.score_experience + r.score_values + r.score_communication + r.score_safety) / 4.0), 1) as rating,
       count(r.id)::int as review_count
from providers p
left join reviews r on r.provider_id = p.id
group by p.id;

-- ---------------------------------------------------------------------
-- 11. Security (Row Level Security)
--     Everyone can READ. Writes are closed until login (Supabase Auth) is added.
--     Parent emails are hidden from the public API.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['providers','parents','children','provider_pricing_notes','provider_photos',
    'provider_credentials','languages','provider_languages','parent_languages','provider_availability',
    'parent_availability','reviews','provider_past_families','favorites','parent_connections',
    'posts','post_replies','post_mentions','reply_mentions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

revoke select on parents from anon;
grant  select (id, name, neighborhood, blurb, created_at) on parents to anon;

-- ---------------------------------------------------------------------
-- 12. Seed data (converted from the site's existing demo data)
-- ---------------------------------------------------------------------
insert into languages (name) values ('English');
insert into languages (name) values ('French');
insert into languages (name) values ('Hindi');
insert into languages (name) values ('Igbo');
insert into languages (name) values ('Malayalam');
insert into languages (name) values ('Russian');
insert into languages (name) values ('Spanish');
insert into languages (name) values ('Swedish');
insert into languages (name) values ('Tagalog');
insert into languages (name) values ('Twi');
insert into parents (id, name, email, neighborhood, blurb) values ('p-jordan', 'Jordan Hale', 'jordan.hale@example.com', 'Maplewood', 'Two kids, one very full calendar. Looking for weekday coverage near Maplewood.');
insert into children (parent_id, name, age) values ('p-jordan', 'Ivy', 2);
insert into children (parent_id, name, age) values ('p-jordan', 'Theo', 6);
insert into parent_languages (parent_id, language_id) select 'p-jordan', id from languages where name = 'English';
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 0, 'Morning');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 0, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 1, 'Morning');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 1, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 2, 'Morning');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 2, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 3, 'Morning');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 3, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 3, 'Evening');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 4, 'Morning');
insert into parent_availability (parent_id, day_of_week, block) values ('p-jordan', 4, 'Afternoon');
insert into parents (id, name, email, neighborhood, blurb) values ('p-amara', 'Amara Boateng', 'amara.b@example.com', 'Riverside', 'Nurse on rotating shifts — I lean on evening and weekend care.');
insert into children (parent_id, name, age) values ('p-amara', 'Kofi', 4);
insert into parent_languages (parent_id, language_id) select 'p-amara', id from languages where name = 'English';
insert into parent_languages (parent_id, language_id) select 'p-amara', id from languages where name = 'Twi';
insert into parent_availability (parent_id, day_of_week, block) values ('p-amara', 0, 'Evening');
insert into parent_availability (parent_id, day_of_week, block) values ('p-amara', 2, 'Evening');
insert into parent_availability (parent_id, day_of_week, block) values ('p-amara', 4, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-amara', 4, 'Evening');
insert into parent_availability (parent_id, day_of_week, block) values ('p-amara', 5, 'Morning');
insert into parent_availability (parent_id, day_of_week, block) values ('p-amara', 5, 'Afternoon');
insert into parents (id, name, email, neighborhood, blurb) values ('p-luis', 'Luis Moreno', 'luis.moreno@example.com', 'Oak Hill', 'Bilingual household. Spanish-speaking care is a big plus for us.');
insert into children (parent_id, name, age) values ('p-luis', 'Sofia', 3);
insert into children (parent_id, name, age) values ('p-luis', 'Mateo', 8);
insert into parent_languages (parent_id, language_id) select 'p-luis', id from languages where name = 'Spanish';
insert into parent_languages (parent_id, language_id) select 'p-luis', id from languages where name = 'English';
insert into parent_availability (parent_id, day_of_week, block) values ('p-luis', 0, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-luis', 1, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-luis', 2, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-luis', 3, 'Afternoon');
insert into parent_availability (parent_id, day_of_week, block) values ('p-luis', 4, 'Afternoon');
insert into parents (id, name, email, neighborhood, blurb) values ('p-nina', 'Nina Petrova', 'nina.p@example.com', 'Larkspur', 'First-time parent, working from home three days a week.');
insert into children (parent_id, name, age) values ('p-nina', 'Anya', 1);
insert into parent_languages (parent_id, language_id) select 'p-nina', id from languages where name = 'Russian';
insert into parent_languages (parent_id, language_id) select 'p-nina', id from languages where name = 'English';
insert into parent_availability (parent_id, day_of_week, block) values ('p-nina', 1, 'Morning');
insert into parent_availability (parent_id, day_of_week, block) values ('p-nina', 2, 'Morning');
insert into parent_availability (parent_id, day_of_week, block) values ('p-nina', 3, 'Morning');
insert into providers (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles, verified, schedule_available, schedule_summary, photo_key) values ('maya-okafor', 'Maya Okafor', 'Sitter', 'Full-day sitter with six years of infant and toddler experience.', 'I''ve cared for families in Maplewood since 2018, mostly full-day weekday care for infants and toddlers. My days run on a gentle rhythm: outdoor time in the morning, lunch and nap, then art or music in the afternoon. I handle school pickup and drop-off for older siblings too.', 190, 240, 'Maplewood', 1.2, true, true, 'Mon–Fri · 7am–6pm', 'maya');
insert into provider_pricing_notes (provider_id, note, sort_order) values ('maya-okafor', 'Full day (7am – 6pm): $190', 0);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('maya-okafor', 'Two children: $240', 1);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('maya-okafor', 'Evening add-on after 6pm: $28/hr', 2);
insert into provider_photos (provider_id, photo_key, sort_order) values ('maya-okafor', 'maya', 0);
insert into provider_credentials (provider_id, name, verified) values ('maya-okafor', 'Pediatric CPR & First Aid', true);
insert into provider_credentials (provider_id, name, verified) values ('maya-okafor', 'State background check (2026)', true);
insert into provider_credentials (provider_id, name, verified) values ('maya-okafor', 'Safe Sleep certified', true);
insert into provider_languages (provider_id, language_id) select 'maya-okafor', id from languages where name = 'English';
insert into provider_languages (provider_id, language_id) select 'maya-okafor', id from languages where name = 'Igbo';
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 0, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 0, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 1, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 1, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 2, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 2, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 3, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 3, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 4, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('maya-okafor', 4, 'Afternoon');
insert into provider_past_families (provider_id, parent_id) values ('maya-okafor', 'p-jordan');
insert into provider_past_families (provider_id, parent_id) values ('maya-okafor', 'p-nina');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('maya-okafor', 'p-jordan', 'Maya has been with us for two years. She sends a short note every afternoon about naps and meals — I never have to ask.', 5, 5, 5, 5, '2026-03-01');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('maya-okafor', 'p-nina', 'Calm with a fussy newborn and unfailingly punctual. She reorganized our whole nap routine in a week.', 5, 4, 5, 5, '2026-01-01');
insert into providers (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles, verified, schedule_available, schedule_summary, photo_key) values ('daniel-reyes', 'Daniel Reyes', 'Sitter', 'After-school care and homework help for school-age kids.', 'Former middle-school teacher, now doing after-school care three afternoons a week. I pick up from Riverside Elementary, we do homework first, then a walk to the park or a board game. I keep a reading log for each kid.', 110, null, 'Riverside', 2.8, true, true, 'Tue, Thu, Fri · 3pm–7pm', 'daniel');
insert into provider_pricing_notes (provider_id, note, sort_order) values ('daniel-reyes', 'Afternoon block (3pm – 7pm): $110', 0);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('daniel-reyes', 'Sibling rate: +$35', 1);
insert into provider_photos (provider_id, photo_key, sort_order) values ('daniel-reyes', 'daniel', 0);
insert into provider_credentials (provider_id, name, verified) values ('daniel-reyes', 'Pediatric CPR', true);
insert into provider_credentials (provider_id, name, verified) values ('daniel-reyes', 'State background check (2025)', true);
insert into provider_credentials (provider_id, name, verified) values ('daniel-reyes', 'Teaching license (lapsed)', true);
insert into provider_languages (provider_id, language_id) select 'daniel-reyes', id from languages where name = 'English';
insert into provider_languages (provider_id, language_id) select 'daniel-reyes', id from languages where name = 'Spanish';
insert into provider_availability (provider_id, day_of_week, block) values ('daniel-reyes', 1, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('daniel-reyes', 1, 'Evening');
insert into provider_availability (provider_id, day_of_week, block) values ('daniel-reyes', 3, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('daniel-reyes', 3, 'Evening');
insert into provider_availability (provider_id, day_of_week, block) values ('daniel-reyes', 4, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('daniel-reyes', 4, 'Evening');
insert into provider_past_families (provider_id, parent_id) values ('daniel-reyes', 'p-luis');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('daniel-reyes', 'p-luis', 'Mateo''s reading went up two levels. Daniel switches to Spanish at home with him, which we love.', 5, 5, 4, 5, '2026-02-01');
insert into providers (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles, verified, schedule_available, schedule_summary, photo_key) values ('sunny-meadows', 'Sunny Meadows Daycare', 'Daycare', 'Licensed neighborhood daycare with meals and a fenced play yard.', 'A ten-child home daycare in Oak Hill, run by Priya Nair and one assistant. Meals and snacks are included and made in-house. Ages one through ten, with a separate quiet room for nappers.', 145, null, 'Oak Hill', 3.5, true, true, 'Mon–Sat · 8am–5pm', 'sunny');
insert into provider_pricing_notes (provider_id, note, sort_order) values ('sunny-meadows', 'Full day (8am – 5pm): $145', 0);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('sunny-meadows', 'Meals and snacks included', 1);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('sunny-meadows', 'Half day: $85', 2);
insert into provider_photos (provider_id, photo_key, sort_order) values ('sunny-meadows', 'sunny', 0);
insert into provider_credentials (provider_id, name, verified) values ('sunny-meadows', 'State daycare license #DC-4471', true);
insert into provider_credentials (provider_id, name, verified) values ('sunny-meadows', 'Annual health inspection (passed 2026)', true);
insert into provider_credentials (provider_id, name, verified) values ('sunny-meadows', 'Staff CPR certified', true);
insert into provider_languages (provider_id, language_id) select 'sunny-meadows', id from languages where name = 'English';
insert into provider_languages (provider_id, language_id) select 'sunny-meadows', id from languages where name = 'Hindi';
insert into provider_languages (provider_id, language_id) select 'sunny-meadows', id from languages where name = 'Malayalam';
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 0, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 0, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 1, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 1, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 2, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 2, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 3, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 3, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 4, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 4, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('sunny-meadows', 5, 'Morning');
insert into provider_past_families (provider_id, parent_id) values ('sunny-meadows', 'p-luis');
insert into provider_past_families (provider_id, parent_id) values ('sunny-meadows', 'p-jordan');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('sunny-meadows', 'p-luis', 'Sofia asks to go on Saturdays. The meals alone are worth the rate.', 5, 5, 5, 5, '2026-03-01');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('sunny-meadows', 'p-jordan', 'Very organized. Monthly newsletter, clear sick-day policy, no surprises on the invoice.', 5, 4, 5, 5, '2025-12-01');
insert into providers (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles, verified, schedule_available, schedule_summary, photo_key) values ('little-lantern', 'Little Lantern Preschool', 'Preschool', 'Play-based preschool mornings for ages three to five.', 'A morning preschool program built around play, outdoor time, and early literacy. Two teachers per eight children. Parents join for a Friday sing-along once a month.', 96, null, 'Larkspur', 4.1, true, true, 'Mon–Fri · 8:30am–12:30pm', 'lantern');
insert into provider_pricing_notes (provider_id, note, sort_order) values ('little-lantern', 'Morning session (8:30am – 12:30pm): $96', 0);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('little-lantern', 'Billed monthly, 4-week terms', 1);
insert into provider_photos (provider_id, photo_key, sort_order) values ('little-lantern', 'lantern', 0);
insert into provider_credentials (provider_id, name, verified) values ('little-lantern', 'State preschool license #PS-1180', true);
insert into provider_credentials (provider_id, name, verified) values ('little-lantern', 'Fire safety inspection (2026)', true);
insert into provider_languages (provider_id, language_id) select 'little-lantern', id from languages where name = 'English';
insert into provider_languages (provider_id, language_id) select 'little-lantern', id from languages where name = 'French';
insert into provider_availability (provider_id, day_of_week, block) values ('little-lantern', 0, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('little-lantern', 1, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('little-lantern', 2, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('little-lantern', 3, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('little-lantern', 4, 'Morning');
insert into provider_past_families (provider_id, parent_id) values ('little-lantern', 'p-nina');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('little-lantern', 'p-nina', 'Warm teachers and a genuinely calm room. Anya cried for two days and then never again.', 4, 5, 5, 5, '2026-02-01');
insert into providers (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles, verified, schedule_available, schedule_summary, photo_key) values ('grace-lindqvist', 'Grace Lindqvist', 'Family Friend', 'Retired teacher offering weekend and evening care for neighbors.', 'Retired after thirty years in first grade. I watch a few neighborhood kids on evenings and weekends — mostly dinner, a book, and bedtime. I don''t take on full-time placements.', null, null, 'Maplewood', 0.9, false, true, 'Fri evening, Sat–Sun', 'grace');
insert into provider_photos (provider_id, photo_key, sort_order) values ('grace-lindqvist', 'grace', 0);
insert into provider_credentials (provider_id, name, verified) values ('grace-lindqvist', 'Pediatric CPR (self-reported)', false);
insert into provider_languages (provider_id, language_id) select 'grace-lindqvist', id from languages where name = 'English';
insert into provider_languages (provider_id, language_id) select 'grace-lindqvist', id from languages where name = 'Swedish';
insert into provider_availability (provider_id, day_of_week, block) values ('grace-lindqvist', 4, 'Evening');
insert into provider_availability (provider_id, day_of_week, block) values ('grace-lindqvist', 5, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('grace-lindqvist', 5, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('grace-lindqvist', 5, 'Evening');
insert into provider_availability (provider_id, day_of_week, block) values ('grace-lindqvist', 6, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('grace-lindqvist', 6, 'Evening');
insert into provider_past_families (provider_id, parent_id) values ('grace-lindqvist', 'p-amara');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('grace-lindqvist', 'p-amara', 'Grace is the reason I can take Saturday shifts. Kofi adores her.', 5, 5, 4, 4, '2026-01-01');
insert into providers (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles, verified, schedule_available, schedule_summary, photo_key) values ('harborview-kids', 'Harborview Kids Center', 'Daycare', 'Large center with extended hours for shift-working parents.', 'A 60-child center near the hospital district with extended hours, including evenings. Separate infant, toddler, and preschool rooms, each with its own lead teacher.', 132, 168, 'Riverside', 5.4, true, true, 'Mon–Fri · 6:30am–9pm', 'harborview');
insert into provider_pricing_notes (provider_id, note, sort_order) values ('harborview-kids', 'Standard day (6:30am – 6pm): $132', 0);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('harborview-kids', 'Extended day to 9pm: $168', 1);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('harborview-kids', 'Infant room: +$20/day', 2);
insert into provider_photos (provider_id, photo_key, sort_order) values ('harborview-kids', 'harborview', 0);
insert into provider_credentials (provider_id, name, verified) values ('harborview-kids', 'State daycare license #DC-2209', true);
insert into provider_credentials (provider_id, name, verified) values ('harborview-kids', 'Accredited by NAEYC', true);
insert into provider_languages (provider_id, language_id) select 'harborview-kids', id from languages where name = 'English';
insert into provider_languages (provider_id, language_id) select 'harborview-kids', id from languages where name = 'Twi';
insert into provider_languages (provider_id, language_id) select 'harborview-kids', id from languages where name = 'Tagalog';
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 0, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 0, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 0, 'Evening');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 1, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 1, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 1, 'Evening');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 2, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 2, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 2, 'Evening');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 3, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 3, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 3, 'Evening');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 4, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 4, 'Afternoon');
insert into provider_availability (provider_id, day_of_week, block) values ('harborview-kids', 4, 'Evening');
insert into provider_past_families (provider_id, parent_id) values ('harborview-kids', 'p-amara');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('harborview-kids', 'p-amara', 'The late pickup is a lifesaver on night shifts. It''s a big place, so you have to ask for details.', 4, 4, 3, 5, '2026-03-01');
insert into providers (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles, verified, schedule_available, schedule_summary, photo_key) values ('tomas-albright', 'Tomás Albright', 'Sitter', 'Occasional date-night and weekend sitter.', 'I sit for a handful of families on weekends, mostly evenings. New to CareConnect — schedule still being set up.', 85, null, 'Oak Hill', 3.1, false, false, 'Schedule unavailable', null);
insert into provider_pricing_notes (provider_id, note, sort_order) values ('tomas-albright', 'Evening block (5pm – 11pm): $85', 0);
insert into provider_languages (provider_id, language_id) select 'tomas-albright', id from languages where name = 'English';
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('tomas-albright', 'p-nina', 'Friendly and on time for a last-minute evening.', 4, 4, 4, 4, '2025-11-01');
insert into providers (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles, verified, schedule_available, schedule_summary, photo_key) values ('willow-bend', 'Willow Bend Preschool Co-op', 'Preschool', 'Parent co-op preschool — families share teaching shifts.', 'A co-op: every family takes one classroom shift per month, which keeps tuition low. Mixed-age room, heavy on outdoor play, rain or shine. Membership is by term.', null, null, 'Larkspur', 4.8, true, true, 'Mon, Wed, Fri · 9am–12pm', 'willow');
insert into provider_photos (provider_id, photo_key, sort_order) values ('willow-bend', 'willow', 0);
insert into provider_credentials (provider_id, name, verified) values ('willow-bend', 'State preschool license #PS-0922', true);
insert into provider_languages (provider_id, language_id) select 'willow-bend', id from languages where name = 'English';
insert into provider_availability (provider_id, day_of_week, block) values ('willow-bend', 0, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('willow-bend', 2, 'Morning');
insert into provider_availability (provider_id, day_of_week, block) values ('willow-bend', 4, 'Morning');
insert into provider_past_families (provider_id, parent_id) values ('willow-bend', 'p-jordan');
insert into reviews (provider_id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on) values ('willow-bend', 'p-jordan', 'You get out what you put in. The shift requirement is real, but Theo loved his year here.', 4, 5, 4, 4, '2025-10-01');
insert into posts (id, author_id, category, title, body, created_at) values ('split-week', 'p-jordan', 'Schedules', 'Anyone splitting the week between two providers?', 'We have Maya Okafor Monday through Wednesday and are trying to fill Thursday and Friday. Has anyone made a two-provider week work without the kids melting down? Curious whether consistency matters more than convenience here.', '2026-03-12');
insert into post_mentions (post_id, provider_id) values ('split-week', 'maya-okafor');
with new_reply as (insert into post_replies (post_id, author_id, body, created_at) values ('split-week', 'p-luis', 'We do exactly this. Sunny Meadows Daycare two days, a sitter the other three. The trick was keeping the same nap window at both places.', '2026-03-12') returning id) insert into reply_mentions (reply_id, provider_id) select new_reply.id, m.pid from new_reply, (values ('sunny-meadows')) as m(pid);
with new_reply as (insert into post_replies (post_id, author_id, body, created_at) values ('split-week', 'p-nina', 'Two weeks of grumpiness, then totally fine. Little Lantern Preschool was flexible about the transition.', '2026-03-13') returning id) insert into reply_mentions (reply_id, provider_id) select new_reply.id, m.pid from new_reply, (values ('little-lantern')) as m(pid);
insert into posts (id, author_id, category, title, body, created_at) values ('evening-rates', 'p-amara', 'Pricing', 'What''s a fair evening rate right now?', 'I''m on rotating night shifts and paying for evening blocks most weeks. Rates I''m seeing range from $85 to $168 a day depending on the place. What are people actually paying for after-6pm care?', '2026-03-09');
insert into post_mentions (post_id, provider_id) values ('evening-rates', 'harborview-kids');
insert into post_replies (post_id, author_id, body, created_at) values ('evening-rates', 'p-jordan', '$28/hr for evening add-on with our sitter. Feels standard for the neighborhood.', '2026-03-09');
insert into posts (id, author_id, category, title, body, created_at) values ('bilingual-care', 'p-luis', 'Recommendations', 'Recommendations for Spanish-speaking care?', 'We want Sofia hearing Spanish outside the house too. Daniel Reyes has been great for Mateo after school — anyone know of daycare or preschool options with Spanish-speaking staff?', '2026-03-04');
insert into post_mentions (post_id, provider_id) values ('bilingual-care', 'daniel-reyes');
with new_reply as (insert into post_replies (post_id, author_id, body, created_at) values ('bilingual-care', 'p-amara', 'Harborview Kids Center has staff in a few languages, worth asking which room.', '2026-03-05') returning id) insert into reply_mentions (reply_id, provider_id) select new_reply.id, m.pid from new_reply, (values ('harborview-kids')) as m(pid);
insert into posts (id, author_id, category, title, body, created_at) values ('verified-meaning', 'p-nina', 'Recommendations', 'How much weight do you give the Verified badge?', 'Grace Lindqvist isn''t verified on here but half the block has used her for years. Do you treat the badge as a hard requirement or just one signal among several?', '2026-02-27');
insert into post_mentions (post_id, provider_id) values ('verified-meaning', 'grace-lindqvist');
insert into post_replies (post_id, author_id, body, created_at) values ('verified-meaning', 'p-jordan', 'One signal. For a center I want the license; for a neighbor I want references.', '2026-02-27');
with new_reply as (insert into post_replies (post_id, author_id, body, created_at) values ('verified-meaning', 'p-luis', 'Same. Willow Bend Preschool Co-op is verified and I still asked for three references.', '2026-02-28') returning id) insert into reply_mentions (reply_id, provider_id) select new_reply.id, m.pid from new_reply, (values ('willow-bend')) as m(pid);
insert into favorites (parent_id, provider_id) values ('p-jordan', 'maya-okafor');
insert into favorites (parent_id, provider_id) values ('p-jordan', 'sunny-meadows');
insert into favorites (parent_id, provider_id) values ('p-jordan', 'little-lantern');
insert into parent_connections (parent_id, connected_parent_id) values ('p-jordan', 'p-luis');

-- ---------------------------------------------------------------------
-- Example: schedule overlap (BR 4) — blocks where a parent needs care
-- and each provider is available.
-- ---------------------------------------------------------------------
-- select p.id, count(pa.*) as overlapping_blocks
-- from providers p
-- left join provider_availability pa
--   on pa.provider_id = p.id
--  and (pa.day_of_week, pa.block) in (select day_of_week, block
--                                     from parent_availability where parent_id = 'p-jordan')
-- group by p.id order by overlapping_blocks desc;

-- =====================================================================
-- CareConnect — login + write access
-- 1) New sign-ups get a parents row automatically (from signup form data)
-- 2) Users can create/edit only their own data
-- =====================================================================

-- Provider listings are owned by a logged-in user
alter table providers add column if not exists owner_id uuid references auth.users(id) on delete set null;
create index if not exists providers_owner_id_idx on providers (owner_id);

-- The current user's parent id
create or replace function public.my_parent_id()
returns text language sql stable security definer set search_path = public as $$
  select id from parents where auth_user_id = auth.uid()
$$;

-- Create the parent profile when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  pid text  := new.id::text;
  c   jsonb;
  s   jsonb;
  lang text;
begin
  insert into parents (id, auth_user_id, name, email, neighborhood, blurb)
  values (pid, new.id,
          coalesce(nullif(trim(m->>'name'), ''), split_part(new.email, '@', 1)),
          new.email,
          nullif(trim(m->>'neighborhood'), ''),
          nullif(trim(m->>'blurb'), ''))
  on conflict (id) do nothing;

  for c in select * from jsonb_array_elements(coalesce(m->'children', '[]'::jsonb)) loop
    insert into children (parent_id, name, age)
    values (pid, coalesce(nullif(trim(c->>'name'), ''), 'Child'), nullif(c->>'age', '')::smallint);
  end loop;

  lang := nullif(trim(m->>'language'), '');
  if lang is not null then
    insert into languages (name) values (lang) on conflict (name) do nothing;
    insert into parent_languages (parent_id, language_id)
    select pid, id from languages where name = lang on conflict do nothing;
  end if;

  for s in select * from jsonb_array_elements(coalesce(m->'schedule', '[]'::jsonb)) loop
    insert into parent_availability (parent_id, day_of_week, block)
    values (pid, (s->>0)::smallint, (s->>1)::time_block) on conflict do nothing;
  end loop;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Column-level privileges
-- ---------------------------------------------------------------------
-- Parents: nobody reads emails through the API; users edit only these fields
revoke select, insert, update on parents from authenticated;
grant  select (id, auth_user_id, name, neighborhood, blurb, created_at) on parents to authenticated;
grant  update (name, neighborhood, blurb) on parents to authenticated;

-- Providers: owners can't mark themselves verified or change the owner
revoke insert, update on providers from authenticated;
grant  insert (id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles,
               latitude, longitude, schedule_available, schedule_summary, photo_key, owner_id) on providers to authenticated;
grant  update (name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood, distance_miles,
               latitude, longitude, schedule_available, schedule_summary, photo_key) on providers to authenticated;

-- ---------------------------------------------------------------------
-- Write policies (reads were already public)
-- ---------------------------------------------------------------------
create policy "edit own profile" on parents for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['children','parent_languages','parent_availability','favorites'] loop
    execute format('create policy "own rows insert" on %I for insert to authenticated with check (parent_id = my_parent_id())', t);
    execute format('create policy "own rows update" on %I for update to authenticated using (parent_id = my_parent_id()) with check (parent_id = my_parent_id())', t);
    execute format('create policy "own rows delete" on %I for delete to authenticated using (parent_id = my_parent_id())', t);
  end loop;
end $$;

create policy "own connections insert" on parent_connections for insert to authenticated with check (parent_id = my_parent_id());
create policy "own connections delete" on parent_connections for delete to authenticated using (parent_id = my_parent_id());

create policy "own reviews insert" on reviews for insert to authenticated with check (parent_id = my_parent_id());
create policy "own reviews update" on reviews for update to authenticated using (parent_id = my_parent_id()) with check (parent_id = my_parent_id());
create policy "own reviews delete" on reviews for delete to authenticated using (parent_id = my_parent_id());

create policy "own past family insert" on provider_past_families for insert to authenticated with check (parent_id = my_parent_id());
create policy "own past family delete" on provider_past_families for delete to authenticated using (parent_id = my_parent_id());

create policy "own posts insert" on posts for insert to authenticated with check (author_id = my_parent_id());
create policy "own posts update" on posts for update to authenticated using (author_id = my_parent_id()) with check (author_id = my_parent_id());
create policy "own posts delete" on posts for delete to authenticated using (author_id = my_parent_id());

create policy "own replies insert" on post_replies for insert to authenticated with check (author_id = my_parent_id());
create policy "own replies update" on post_replies for update to authenticated using (author_id = my_parent_id()) with check (author_id = my_parent_id());
create policy "own replies delete" on post_replies for delete to authenticated using (author_id = my_parent_id());

create policy "own post mentions insert" on post_mentions for insert to authenticated
  with check (exists (select 1 from posts p where p.id = post_id and p.author_id = my_parent_id()));
create policy "own post mentions delete" on post_mentions for delete to authenticated
  using (exists (select 1 from posts p where p.id = post_id and p.author_id = my_parent_id()));
create policy "own reply mentions insert" on reply_mentions for insert to authenticated
  with check (exists (select 1 from post_replies r where r.id = reply_id and r.author_id = my_parent_id()));
create policy "own reply mentions delete" on reply_mentions for delete to authenticated
  using (exists (select 1 from post_replies r where r.id = reply_id and r.author_id = my_parent_id()));

create policy "own listing insert" on providers for insert to authenticated with check (owner_id = auth.uid());
create policy "own listing update" on providers for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own listing delete" on providers for delete to authenticated using (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['provider_pricing_notes','provider_photos','provider_credentials',
                           'provider_languages','provider_availability'] loop
    execute format('create policy "listing owner insert" on %I for insert to authenticated with check (exists (select 1 from providers p where p.id = provider_id and p.owner_id = auth.uid()))', t);
    execute format('create policy "listing owner update" on %I for update to authenticated using (exists (select 1 from providers p where p.id = provider_id and p.owner_id = auth.uid()))', t);
    execute format('create policy "listing owner delete" on %I for delete to authenticated using (exists (select 1 from providers p where p.id = provider_id and p.owner_id = auth.uid()))', t);
  end loop;
end $$;

-- Self-added certifications are never marked verified
revoke insert, update on provider_credentials from authenticated;
grant  insert (provider_id, name) on provider_credentials to authenticated;
grant  update (name) on provider_credentials to authenticated;

create policy "add language" on languages for insert to authenticated with check (true);

grant select (auth_user_id) on parents to anon;

-- Only the signup trigger runs handle_new_user; my_parent_id is for logged-in users' policies
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.my_parent_id() from public, anon;
grant execute on function public.my_parent_id() to authenticated;
