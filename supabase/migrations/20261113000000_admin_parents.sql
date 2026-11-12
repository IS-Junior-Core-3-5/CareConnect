-- Admin family support view: read-only access to private family data.
-- Apply after 20261112000000_admin_bookings.sql.
-- Safe to apply to the live project: adds two security-definer functions and no data changes.
--
-- Families keep their existing access. Only admins can call these functions,
-- and they are the only place that returns parent emails, home addresses,
-- children, private preferences, favorites, and booking history together.
-- Normal authenticated users still cannot read parents.email or the private
-- family tables directly.

-- ---------------------------------------------------------------------
-- 1. Family list
--    One row per parent with contact details, care setup, booking and
--    activity summaries. Non-admins get an error, never rows.
-- ---------------------------------------------------------------------
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
    coalesce(cm.chat_messages, 0)::int,
    coalesce(ul.login_count, 0)::int,
    ul.last_login_at,
    coalesce(si.search_sessions, 0)::int,
    si.avg_search_minutes,
    (pp.parent_id is not null),
    pp.updated_at
  from public.parents p
  left join public.parent_private_addresses a on a.parent_id = p.id
  left join (
    select parent_id, count(*)::int as children_count
    from public.children
    group by parent_id
  ) ch on ch.parent_id = p.id
  left join (
    select pl.parent_id, array_agg(lg.name order by lg.name) as languages
    from public.parent_languages pl
    join public.languages lg on lg.id = pl.language_id
    group by pl.parent_id
  ) l on l.parent_id = p.id
  left join (
    select parent_id, count(*)::int as need_blocks
    from public.parent_availability
    group by parent_id
  ) pa on pa.parent_id = p.id
  left join (
    select parent_id, count(*)::int as favorites_count
    from public.favorites
    group by parent_id
  ) f on f.parent_id = p.id
  left join (
    select parent_id,
           count(*)::int as bookings_total,
           count(*) filter (where status = 'pending')::int as bookings_pending,
           count(*) filter (where status = 'confirmed')::int as bookings_confirmed,
           max(care_date) filter (where status = 'confirmed') as last_care_date
    from public.care_bookings
    group by parent_id
  ) b on b.parent_id = p.id
  left join (
    select parent_id,
           count(*)::int as providers_booked,
           count(*) filter (where is_rebooking)::int as providers_rebooked
    from public.rebook_tracking
    group by parent_id
  ) rs on rs.parent_id = p.id
  left join (
    select parent_id,
           count(*)::int as ai_recommendations,
           max(created_at) as last_ai_at
    from public.ai_recommendations
    group by parent_id
  ) ai on ai.parent_id = p.id
  left join (
    select parent_id, count(*)::int as chat_messages
    from public.ai_chat_messages
    group by parent_id
  ) cm on cm.parent_id = p.id
  left join public.user_login_counts ul on ul.user_id = p.auth_user_id
  left join (
    select user_id,
           count(*)::int as search_sessions,
           round(
             (avg(elapsed_seconds) filter (where completed_at is not null)) / 60.0,
             1
           ) as avg_search_minutes
    from public.provider_search_intervals
    group by user_id
  ) si on si.user_id = p.auth_user_id
  left join public.parent_preferences pp on pp.parent_id = p.id
  order by p.created_at desc, p.name;
end;
$$;

comment on function public.admin_parent_list() is
  'Admin-only family directory with private contact details and care/activity summaries.';

revoke all on function public.admin_parent_list() from public, anon;
grant execute on function public.admin_parent_list() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Family detail
--    Everything the support view needs for one family: contact details,
--    children, languages, needed schedule, preferences, favorites,
--    recent bookings, rebooking, AI recommendations, and activity.
-- ---------------------------------------------------------------------
create or replace function public.admin_parent_detail(p_parent_id text)
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

  if not exists (select 1 from public.parents where id = p_parent_id) then
    raise exception 'Family not found: %', p_parent_id using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'parent', (
      select jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'email', p.email,
        'neighborhood', p.neighborhood,
        'blurb', p.blurb,
        'address', a.address,
        'created_at', p.created_at
      )
      from public.parents p
      left join public.parent_private_addresses a on a.parent_id = p.id
      where p.id = p_parent_id
    ),
    'children', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', c.id, 'name', c.name, 'age', c.age)
        order by c.id
      )
      from public.children c
      where c.parent_id = p_parent_id
    ), '[]'::jsonb),
    'languages', coalesce((
      select jsonb_agg(lg.name order by lg.name)
      from public.parent_languages pl
      join public.languages lg on lg.id = pl.language_id
      where pl.parent_id = p_parent_id
    ), '[]'::jsonb),
    'schedule', coalesce((
      select jsonb_agg(
        jsonb_build_object('day_of_week', pa.day_of_week, 'block', pa.block)
        order by pa.day_of_week, pa.block
      )
      from public.parent_availability pa
      where pa.parent_id = p_parent_id
    ), '[]'::jsonb),
    'preferences', (
      select to_jsonb(pp)
      from public.parent_preferences pp
      where pp.parent_id = p_parent_id
    ),
    'favorites', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'provider_id', f.provider_id,
          'name', pr.name,
          'care_type', pr.care_type,
          'is_public', pr.is_public,
          'created_at', f.created_at
        )
        order by f.created_at desc
      )
      from public.favorites f
      join public.providers pr on pr.id = f.provider_id
      where f.parent_id = p_parent_id
    ), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'provider_id', b.provider_id,
          'provider_name', pr.name,
          'care_date', b.care_date,
          'block', b.block,
          'status', b.status,
          'resolution_note', b.resolution_note,
          'created_at', b.created_at,
          'updated_at', b.updated_at
        )
        order by b.care_date desc, b.created_at desc
      )
      from (
        select *
        from public.care_bookings
        where parent_id = p_parent_id
        order by care_date desc, created_at desc
        limit 30
      ) b
      join public.providers pr on pr.id = b.provider_id
    ), '[]'::jsonb),
    'rebook', (
      select jsonb_build_object(
        'providers_booked', count(*)::int,
        'providers_rebooked', count(*) filter (where is_rebooking)::int,
        'confirmed_bookings', coalesce(sum(confirmed_bookings), 0)::int,
        'total_rebookings', coalesce(sum(rebook_count), 0)::int,
        'last_care_date', max(last_care_date)
      )
      from public.rebook_tracking
      where parent_id = p_parent_id
    ),
    'recommendations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'provider_id', r.provider_id,
          'provider_name', pr.name,
          'rank', r.rank,
          'match_score', r.match_score,
          'headline', r.headline,
          'model', r.model,
          'created_at', r.created_at
        )
        order by r.rank
      )
      from public.ai_recommendations r
      join public.providers pr on pr.id = r.provider_id
      where r.parent_id = p_parent_id
    ), '[]'::jsonb),
    'activity', jsonb_build_object(
      'login_count', coalesce((
        select ul.login_count
        from public.user_login_counts ul
        join public.parents p on p.auth_user_id = ul.user_id
        where p.id = p_parent_id
      ), 0)::int,
      'last_login_at', (
        select ul.last_login_at
        from public.user_login_counts ul
        join public.parents p on p.auth_user_id = ul.user_id
        where p.id = p_parent_id
      ),
      'search_sessions', (
        select count(*)::int
        from public.provider_search_intervals si
        join public.parents p on p.auth_user_id = si.user_id
        where p.id = p_parent_id
      ),
      'avg_search_minutes', (
        select round(
          (avg(si.elapsed_seconds) filter (where si.completed_at is not null)) / 60.0,
          1
        )
        from public.provider_search_intervals si
        join public.parents p on p.auth_user_id = si.user_id
        where p.id = p_parent_id
      ),
      'last_search_at', (
        select max(si.started_at)
        from public.provider_search_intervals si
        join public.parents p on p.auth_user_id = si.user_id
        where p.id = p_parent_id
      ),
      'chat_messages', (
        select count(*)::int
        from public.ai_chat_messages
        where parent_id = p_parent_id
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.admin_parent_detail(text) is
  'Admin-only family support record, including private contact, care, booking and activity data.';

revoke all on function public.admin_parent_detail(text) from public, anon;
grant execute on function public.admin_parent_detail(text) to authenticated;
