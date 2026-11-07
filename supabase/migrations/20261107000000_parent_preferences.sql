-- In-depth care preferences for the account holder (one row per parent).
-- Used by the AI (recommend-providers Edge Function) for recommendations and chat.
-- Private: only the parent can read or change their own row.
create table if not exists public.parent_preferences (
  parent_id           text primary key references public.parents(id) on delete cascade,
  -- What kind of care
  care_types          text[] not null default '{}',   -- Daycare, Preschool, Sitter, Family Friend
  care_settings       text[] not null default '{}',   -- In our home, Provider's home, Center / school
  arrangement         text,                           -- Full-time, Part-time, Occasional / drop-in, Before & after school, Date nights
  start_date          date,
  -- Budget
  budget_min          numeric(8,2) check (budget_min is null or budget_min >= 0),
  budget_max          numeric(8,2) check (budget_max is null or budget_max >= 0),
  budget_flexibility  text check (budget_flexibility in ('Strict', 'Somewhat flexible', 'Flexible')),
  -- Location
  preferred_cities    text[] not null default '{}',
  max_distance_miles  smallint check (max_distance_miles is null or max_distance_miles between 1 and 100),
  needs_transportation boolean not null default false,
  -- Must-haves, approach, languages
  must_haves          text[] not null default '{}',
  approaches          text[] not null default '{}',   -- Play-based, Montessori, Academic, Faith-based, ...
  languages_wanted    text[] not null default '{}',
  -- About the kids
  child_needs         text,                           -- allergies, medical / special needs, potty training, naps
  diet                text,
  -- Communication
  communication       text[] not null default '{}',
  -- How the AI should weigh and answer
  priorities          text[] not null default '{}',   -- ordered, most important first
  dealbreakers        text,
  notes_for_ai        text,
  ai_answer_style     text not null default 'Balanced' check (ai_answer_style in ('Short', 'Balanced', 'Detailed')),
  updated_at          timestamptz not null default now(),
  constraint budget_range check (budget_min is null or budget_max is null or budget_min <= budget_max),
  constraint text_lengths check (
    coalesce(char_length(child_needs), 0) <= 1000 and coalesce(char_length(diet), 0) <= 500 and
    coalesce(char_length(dealbreakers), 0) <= 1000 and coalesce(char_length(notes_for_ai), 0) <= 2000)
);

alter table public.parent_preferences enable row level security;
create policy "own prefs read"   on public.parent_preferences for select to authenticated using (parent_id = my_parent_id());
create policy "own prefs insert" on public.parent_preferences for insert to authenticated with check (parent_id = my_parent_id());
create policy "own prefs update" on public.parent_preferences for update to authenticated using (parent_id = my_parent_id()) with check (parent_id = my_parent_id());
create policy "own prefs delete" on public.parent_preferences for delete to authenticated using (parent_id = my_parent_id());
