-- Fix the admin family list function added in 20261113000000_admin_parents.sql.
-- The original function used unqualified column names inside its subqueries.
-- Because RETURNS TABLE column names are PL/pgSQL variables, references like
-- `parent_id` and `created_at` were ambiguous at run time, so the function
-- failed even though the migration itself applied successfully.
--
-- Apply this after 20261113000000_admin_parents.sql. It only replaces the
-- function body and grants; it does not change any data.

create or replace function public.admin_parent_list()
returns table (
  parent_id text,
  name text,
  email text,
  neighborhood text,
  address text,
  created_at timestamptz,
  children_count int,
  languages text[],
  need_blocks int,
  favorites_count int,
  bookings_total int,
  bookings_pending int,
  bookings_confirmed int,
  last_care_date date,
  providers_booked int,
  providers_rebooked int,
  ai_recommendations int,
  last_ai_at timestamptz,
  chat_messages int,
  login_count int,
  last_login_at timestamptz,
  search_sessions int,
  avg_search_minutes numeric,
  has_preferences boolean,
  preferences_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.name,
    p.email,
    p.neighborhood,
    a.address,
    p.created_at,
    coalesce(ch.children_count, 0)::int,
    coalesce(l.languages, '{}'::text[]),
    coalesce(pa.need_blocks, 0)::int,
    coalesce(f.favorites_count, 0)::int,
    coalesce(b.bookings_total, 0)::int,
    coalesce(b.bookings_pending, 0)::int,
    coalesce(b.bookings_confirmed, 0)::int,
    b.last_care_date,
    coalesce(rs.providers_booked, 0)::int,
    coalesce(rs.providers_rebooked, 0)::int,
    coalesce(ai.ai_recommendations, 0)::int,
    ai.last_ai_at,
    coalesce(chat.chat_messages, 0)::int,
    coalesce(ul.login_count, 0)::int,
    ul.last_login_at,
    coalesce(si.search_sessions, 0)::int,
    si.avg_search_minutes,
    (pp.parent_id is not null),
    pp.updated_at
  from public.parents p
  left join public.parent_private_addresses a on a.parent_id = p.id
  left join (
    select c.parent_id, count(*)::int as children_count
    from public.children c
    group by c.parent_id
  ) ch on ch.parent_id = p.id
  left join (
    select pl.parent_id, array_agg(lg.name order by lg.name) as languages
    from public.parent_languages pl
    join public.languages lg on lg.id = pl.language_id
    group by pl.parent_id
  ) l on l.parent_id = p.id
  left join (
    select av.parent_id, count(*)::int as need_blocks
    from public.parent_availability av
    group by av.parent_id
  ) pa on pa.parent_id = p.id
  left join (
    select fav.parent_id, count(*)::int as favorites_count
    from public.favorites fav
    group by fav.parent_id
  ) f on f.parent_id = p.id
  left join (
    select cb.parent_id,
           count(*)::int as bookings_total,
           count(*) filter (where cb.status = 'pending')::int as bookings_pending,
           count(*) filter (where cb.status = 'confirmed')::int as bookings_confirmed,
           max(cb.care_date) filter (where cb.status = 'confirmed') as last_care_date
    from public.care_bookings cb
    group by cb.parent_id
  ) b on b.parent_id = p.id
  left join (
    select rt.parent_id,
           count(*)::int as providers_booked,
           count(*) filter (where rt.is_rebooking)::int as providers_rebooked
    from public.rebook_tracking rt
    group by rt.parent_id
  ) rs on rs.parent_id = p.id
  left join (
    select ar.parent_id,
           count(*)::int as ai_recommendations,
           max(ar.created_at) as last_ai_at
    from public.ai_recommendations ar
    group by ar.parent_id
  ) ai on ai.parent_id = p.id
  left join (
    select cm.parent_id, count(*)::int as chat_messages
    from public.ai_chat_messages cm
    group by cm.parent_id
  ) chat on chat.parent_id = p.id
  left join public.user_login_counts ul on ul.user_id = p.auth_user_id
  left join (
    select psi.user_id,
           count(*)::int as search_sessions,
           round(
             (avg(psi.elapsed_seconds) filter (where psi.completed_at is not null)) / 60.0,
             1
           ) as avg_search_minutes
    from public.provider_search_intervals psi
    group by psi.user_id
  ) si on si.user_id = p.auth_user_id
  left join public.parent_preferences pp on pp.parent_id = p.id
  order by p.created_at desc, p.name;
end;
$$;

comment on function public.admin_parent_list() is
  'Admin-only family directory with private contact details and care/activity summaries.';

revoke all on function public.admin_parent_list() from public, anon;
grant execute on function public.admin_parent_list() to authenticated;
