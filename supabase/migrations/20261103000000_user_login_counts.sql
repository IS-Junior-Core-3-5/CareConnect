-- Track successful logins reported by Supabase Auth.
-- The count starts with the first login after this migration is applied;
-- Auth does not retain historical login totals.

create table public.user_login_counts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_count bigint not null default 0 check (login_count >= 0),
  last_login_at timestamptz not null
);

comment on table public.user_login_counts is
  'Successful Supabase Auth logins per user, counted from the date this migration is applied.';

alter table public.user_login_counts enable row level security;

-- Keep the count table private from the browser/API roles.
revoke all on public.user_login_counts from public, anon, authenticated;

create or replace function public.increment_user_login_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_login_counts (user_id, login_count, last_login_at)
  values (new.id, 1, new.last_sign_in_at)
  on conflict (user_id) do update
    set login_count = public.user_login_counts.login_count + 1,
        last_login_at = excluded.last_login_at;

  return new;
end;
$$;

revoke all on function public.increment_user_login_count() from public, anon, authenticated;

create trigger count_auth_user_logins
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is not null and new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.increment_user_login_count();
