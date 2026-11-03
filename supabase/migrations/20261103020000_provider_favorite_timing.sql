-- Track active time between logins and favorite saves for parent accounts.
-- Users cannot read the analytics table; controlled functions and triggers update it.

create table public.provider_search_intervals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_provider_id text references public.providers(id) on delete set null,
  started_at timestamptz not null,
  running_since timestamptz,
  elapsed_seconds bigint not null default 0 check (elapsed_seconds >= 0),
  completed_at timestamptz,
  check (completed_at is null or running_since is null)
);

comment on table public.provider_search_intervals is
  'Private analytics: active login time from sign-in or previous favorite save until the next favorite save.';

create unique index provider_search_intervals_one_open_per_user
  on public.provider_search_intervals (user_id)
  where completed_at is null;

create index provider_search_intervals_user_started
  on public.provider_search_intervals (user_id, started_at desc);

alter table public.provider_search_intervals enable row level security;
revoke all on public.provider_search_intervals from public, anon, authenticated;

-- Internal helper: create the first interval or resume the paused interval.
create or replace function public.ensure_provider_search_interval(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  -- Only parent accounts can favorite providers and need discovery timing.
  if not exists (
    select 1
    from public.parents p
    where p.auth_user_id = p_user_id
  ) then
    return;
  end if;

  insert into public.provider_search_intervals (user_id, started_at, running_since)
  values (p_user_id, v_now, v_now)
  on conflict (user_id) where completed_at is null
  do update
    set running_since = coalesce(
      public.provider_search_intervals.running_since,
      excluded.running_since
    );
end;
$$;

revoke all on function public.ensure_provider_search_interval(uuid)
  from public, anon, authenticated;

-- Auth trigger keeps newly logged-in users' timers current.
create or replace function public.resume_provider_search_interval_on_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_provider_search_interval(new.id);
  return new;
end;
$$;

revoke all on function public.resume_provider_search_interval_on_login()
  from public, anon, authenticated;

create trigger resume_provider_search_interval_on_login
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is not null and new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.resume_provider_search_interval_on_login();

-- Called by the client when a signed-in session is already present or restored.
create or replace function public.resume_provider_search_timer()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  perform public.ensure_provider_search_interval(v_user_id);
end;
$$;

revoke all on function public.resume_provider_search_timer()
  from public, anon, authenticated;
grant execute on function public.resume_provider_search_timer() to authenticated;

-- Called before app sign-out to save the active portion and pause the interval.
create or replace function public.pause_provider_search_timer()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  update public.provider_search_intervals
  set elapsed_seconds = elapsed_seconds + case
        when running_since is null then 0
        else greatest(0, floor(extract(epoch from (v_now - running_since)))::bigint)
      end,
      running_since = null
  where user_id = v_user_id
    and completed_at is null
    and running_since is not null;
end;
$$;

revoke all on function public.pause_provider_search_timer()
  from public, anon, authenticated;
grant execute on function public.pause_provider_search_timer() to authenticated;

-- A successful favorite insert completes one interval and starts the next one.
create or replace function public.complete_provider_search_interval_on_favorite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
begin
  if v_user_id is null or not exists (
    select 1
    from public.parents p
    where p.id = new.parent_id
      and p.auth_user_id = v_user_id
  ) then
    return new;
  end if;

  update public.provider_search_intervals
  set elapsed_seconds = elapsed_seconds + case
        when running_since is null then 0
        else greatest(0, floor(extract(epoch from (v_now - running_since)))::bigint)
      end,
      running_since = null,
      completed_at = v_now,
      saved_provider_id = new.provider_id
  where user_id = v_user_id
    and completed_at is null;

  if not found then
    -- If tracking began during an existing session, record this first save at 0 seconds.
    insert into public.provider_search_intervals (
      user_id, saved_provider_id, started_at, running_since, elapsed_seconds, completed_at
    )
    values (v_user_id, new.provider_id, v_now, null, 0, v_now);
  end if;

  perform public.ensure_provider_search_interval(v_user_id);
  return new;
end;
$$;

revoke all on function public.complete_provider_search_interval_on_favorite()
  from public, anon, authenticated;

create trigger complete_provider_search_interval_on_favorite
  after insert on public.favorites
  for each row
  execute function public.complete_provider_search_interval_on_favorite();
