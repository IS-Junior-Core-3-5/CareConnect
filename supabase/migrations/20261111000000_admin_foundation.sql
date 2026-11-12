-- Admin foundation: role helper, dashboard stats, provider moderation, audit log.
-- Apply after 20261110000000_provider_profile_photo.sql.
-- Safe to apply to the live project: adds a table, view, functions and policies.
-- The only existing behavior it changes is that admins can now see archived
-- providers and set the admin-only provider fields.

-- ---------------------------------------------------------------------
-- 1. Role helper
--    app_metadata is server-controlled, so a signed-in user cannot make
--    themselves an admin by editing user_metadata.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

comment on function public.is_admin() is
  'True when the caller JWT has app_metadata.role = "admin". Used by admin RLS policies and RPCs.';

revoke all on function public.is_admin() from public;
-- anon needs EXECUTE because the provider visibility policy calls it too.
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Let admins see archived providers, and allow the admin RPC to
--    change is_public without tripping the owner guard.
-- ---------------------------------------------------------------------
drop policy if exists "visible provider listings" on public.providers;
create policy "visible provider listings" on public.providers
  as restrictive for select to anon, authenticated
  using (is_public or public.is_admin());

create or replace function public.guard_provider_directory_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    if tg_op = 'INSERT' and (new.listing_origin <> 'owned' or not new.is_public) then
      raise exception 'Only provider-owned public listings may be created';
    end if;
    if tg_op = 'UPDATE' and (new.listing_origin is distinct from old.listing_origin
        or new.is_public is distinct from old.is_public) then
      raise exception 'Listing origin and visibility cannot be changed by listing owners';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Admin provider list
--    One row per provider, including archived rows, with rating and
--    credential counts. Non-admins get no rows.
-- ---------------------------------------------------------------------
create or replace view public.admin_provider_list
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.care_type,
  p.address,
  p.phone,
  p.verified,
  p.is_public,
  p.listing_origin,
  p.owner_id,
  p.website_url,
  p.contact_url,
  p.source_url,
  p.checked_on,
  p.schedule_available,
  p.photo_key,
  p.created_at,
  coalesce(r.rating, 0)::numeric as rating,
  coalesce(r.review_count, 0)::int as review_count,
  coalesce(c.credential_count, 0)::int as credential_count,
  coalesce(c.verified_credential_count, 0)::int as verified_credential_count
from public.providers p
left join (
  select provider_id,
         round(avg((score_experience + score_values + score_communication + score_safety) / 4.0), 1) as rating,
         count(*)::int as review_count
  from public.reviews
  group by provider_id
) r on r.provider_id = p.id
left join (
  select provider_id,
         count(*)::int as credential_count,
         count(*) filter (where verified)::int as verified_credential_count
  from public.provider_credentials
  group by provider_id
) c on c.provider_id = p.id
where public.is_admin();

revoke all on public.admin_provider_list from public, anon;
grant select on public.admin_provider_list to authenticated;

-- ---------------------------------------------------------------------
-- 4. Dashboard stats
--    Security definer so it can count private analytics tables without
--    granting browser roles direct access to them.
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'providers_total',        (select count(*)::int from public.providers),
    'providers_public',       (select count(*)::int from public.providers where is_public),
    'providers_archived',     (select count(*)::int from public.providers where not is_public),
    'providers_owned',        (select count(*)::int from public.providers where listing_origin = 'owned'),
    'providers_external',     (select count(*)::int from public.providers where listing_origin = 'external'),
    'providers_sample',       (select count(*)::int from public.providers where listing_origin = 'sample'),
    'providers_verified',     (select count(*)::int from public.providers where verified),
    'providers_missing_photo',
      (select count(*)::int from public.providers
       where is_public and photo_key is null and profile_photo_path is null),
    'parents_total',          (select count(*)::int from public.parents),
    'bookings_pending',       (select count(*)::int from public.care_bookings where status = 'pending'),
    'bookings_confirmed',     (select count(*)::int from public.care_bookings where status = 'confirmed'),
    'bookings_declined',      (select count(*)::int from public.care_bookings where status = 'declined'),
    'bookings_cancelled',     (select count(*)::int from public.care_bookings where status = 'cancelled'),
    'bookings_pending_over_2d',
      (select count(*)::int from public.care_bookings
       where status = 'pending' and created_at < now() - interval '2 days'),
    'overall_rebook_rate_pct',
      (select round(100.0 * count(*) filter (where is_rebooking) / nullif(count(*), 0), 1)
       from public.rebook_tracking),
    'ai_families',            (select count(distinct parent_id)::int from public.ai_recommendations),
    'ai_recommendations',     (select count(*)::int from public.ai_recommendations),
    'ai_last_generated',      (select max(created_at) from public.ai_recommendations),
    'logins_total',           (select coalesce(sum(login_count), 0)::bigint from public.user_login_counts),
    'active_users_7d',
      (select count(*)::int from public.user_login_counts
       where last_login_at >= now() - interval '7 days'),
    'search_sessions_7d',
      (select count(*)::int from public.provider_search_intervals
       where started_at >= now() - interval '7 days'),
    'avg_search_minutes',
      (select round(avg(elapsed_seconds) / 60.0, 1)
       from public.provider_search_intervals
       where completed_at is not null
         and started_at >= now() - interval '7 days'),
    'unverified_credentials',
      (select count(*)::int from public.provider_credentials where not verified),
    'stale_external',
      (select count(*)::int from public.providers
       where listing_origin = 'external'
         and (checked_on is null or checked_on < current_date - 180))
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Audit log
--    Only security-definer RPCs write here; admins can read it.
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id            bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email   text,
  action        text not null,
  target_type   text not null,
  target_id     text,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admins read audit log" on public.admin_audit_log;
create policy "admins read audit log" on public.admin_audit_log
  for select to authenticated using (public.is_admin());

revoke all on public.admin_audit_log from public, anon;
grant select on public.admin_audit_log to authenticated;

-- ---------------------------------------------------------------------
-- 6. Provider moderation RPC
--    Null arguments mean "leave unchanged". Every call is audited.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_provider_flags(
  p_provider_id text,
  p_verified boolean default null,
  p_is_public boolean default null
)
returns public.providers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider public.providers;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_verified is null and p_is_public is null then
    raise exception 'Nothing to update';
  end if;

  update public.providers
  set verified  = coalesce(p_verified, verified),
      is_public = coalesce(p_is_public, is_public)
  where id = p_provider_id
  returning * into v_provider;

  if v_provider.id is null then
    raise exception 'Provider not found: %', p_provider_id using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'provider.update_flags',
    'provider',
    p_provider_id,
    jsonb_strip_nulls(jsonb_build_object('verified', p_verified, 'is_public', p_is_public))
  );

  return v_provider;
end;
$$;

revoke all on function public.admin_set_provider_flags(text, boolean, boolean) from public, anon;
grant execute on function public.admin_set_provider_flags(text, boolean, boolean) to authenticated;
