-- Admin AI recommendations: read saved matches, review chat usage, and clear
-- a stale recommendation set when a family needs a fresh one.
-- Apply after 20261113000001_fix_admin_parents_ambiguity.sql.
-- Safe to apply to the live project: adds three security-definer functions and
-- no data changes. Chat message content stays private; admins only see counts.
--
-- Families keep their existing access. Only admins can call these functions.

-- ---------------------------------------------------------------------
-- 1. Recommendation overview
--    One row per family with a saved recommendation set or AI chat
--    activity. Includes the top three saved matches, usage counts, and
--    enough family context to triage a support question.
-- ---------------------------------------------------------------------
create or replace function public.admin_ai_list()
returns table (
  parent_id text,
  parent_name text,
  parent_email text,
  neighborhood text,
  has_preferences boolean,
  preferences_updated_at timestamptz,
  recommendation_count int,
  summary text,
  model text,
  generated_at timestamptz,
  top_providers jsonb,
  chat_messages int,
  chat_user_messages int,
  chat_assistant_messages int,
  last_chat_at timestamptz,
  favorites_count int,
  bookings_total int,
  bookings_confirmed int,
  last_login_at timestamptz
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
  with recs as (
    select ar.parent_id,
           count(*)::int as recommendation_count,
           max(ar.created_at) as generated_at,
           (array_agg(ar.summary order by ar.created_at desc nulls last))[1] as summary,
           (array_agg(ar.model order by ar.created_at desc nulls last))[1] as model
    from public.ai_recommendations ar
    group by ar.parent_id
  ),
  chat_activity as (
    select cm.parent_id,
           count(*)::int as chat_messages,
           count(*) filter (where cm.role = 'user')::int as chat_user_messages,
           count(*) filter (where cm.role = 'assistant')::int as chat_assistant_messages,
           max(cm.created_at) as last_chat_at
    from public.ai_chat_messages cm
    group by cm.parent_id
  ),
  top_recs as (
    select ranked.parent_id,
           jsonb_agg(
             jsonb_build_object(
               'provider_id', ranked.provider_id,
               'name', ranked.provider_name,
               'rank', ranked.rank,
               'match_score', ranked.match_score,
               'headline', ranked.headline
             )
             order by ranked.rank
           ) as top_providers
    from (
      select ar.parent_id,
             ar.provider_id,
             pr.name as provider_name,
             ar.rank,
             ar.match_score,
             ar.headline,
             row_number() over (partition by ar.parent_id order by ar.rank) as row_num
      from public.ai_recommendations ar
      join public.providers pr on pr.id = ar.provider_id
    ) ranked
    where ranked.row_num <= 3
    group by ranked.parent_id
  ),
  favs as (
    select f.parent_id, count(*)::int as favorites_count
    from public.favorites f
    group by f.parent_id
  ),
  books as (
    select cb.parent_id,
           count(*)::int as bookings_total,
           count(*) filter (where cb.status = 'confirmed')::int as bookings_confirmed
    from public.care_bookings cb
    group by cb.parent_id
  )
  select
    p.id,
    p.name,
    p.email,
    p.neighborhood,
    (pp.parent_id is not null),
    pp.updated_at,
    coalesce(r.recommendation_count, 0)::int,
    r.summary,
    r.model,
    r.generated_at,
    coalesce(t.top_providers, '[]'::jsonb),
    coalesce(c.chat_messages, 0)::int,
    coalesce(c.chat_user_messages, 0)::int,
    coalesce(c.chat_assistant_messages, 0)::int,
    c.last_chat_at,
    coalesce(f.favorites_count, 0)::int,
    coalesce(b.bookings_total, 0)::int,
    coalesce(b.bookings_confirmed, 0)::int,
    ul.last_login_at
  from public.parents p
  left join recs r on r.parent_id = p.id
  left join chat_activity c on c.parent_id = p.id
  left join top_recs t on t.parent_id = p.id
  left join favs f on f.parent_id = p.id
  left join books b on b.parent_id = p.id
  left join public.parent_preferences pp on pp.parent_id = p.id
  left join public.user_login_counts ul on ul.user_id = p.auth_user_id
  where coalesce(r.recommendation_count, 0) > 0
     or coalesce(c.chat_messages, 0) > 0
  order by greatest(
             coalesce(r.generated_at, 'epoch'::timestamptz),
             coalesce(c.last_chat_at, 'epoch'::timestamptz)
           ) desc,
           p.name;
end;
$$;

comment on function public.admin_ai_list() is
  'Admin-only AI usage overview: saved recommendation sets and chat counts per family.';

revoke all on function public.admin_ai_list() from public, anon;
grant execute on function public.admin_ai_list() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Recommendation detail
--    The full saved set for one family, including the explanations behind
--    each match. Chat message bodies are deliberately excluded.
-- ---------------------------------------------------------------------
create or replace function public.admin_ai_detail(p_parent_id text)
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

  if not exists (select 1 from public.parents p where p.id = p_parent_id) then
    raise exception 'Family not found: %', p_parent_id using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'parent', (
      select jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'email', p.email,
        'neighborhood', p.neighborhood,
        'children_count', (
          select count(*)::int from public.children c where c.parent_id = p.id
        ),
        'has_preferences', (pp.parent_id is not null),
        'preferences_updated_at', pp.updated_at
      )
      from public.parents p
      left join public.parent_preferences pp on pp.parent_id = p.id
      where p.id = p_parent_id
    ),
    'set', (
      select jsonb_build_object(
        'recommendation_count', count(*)::int,
        'summary', (array_agg(ar.summary order by ar.created_at desc nulls last))[1],
        'model', (array_agg(ar.model order by ar.created_at desc nulls last))[1],
        'generated_at', max(ar.created_at)
      )
      from public.ai_recommendations ar
      where ar.parent_id = p_parent_id
    ),
    'recommendations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'provider_id', ar.provider_id,
          'provider_name', pr.name,
          'care_type', pr.care_type,
          'is_public', pr.is_public,
          'verified', pr.verified,
          'rating', coalesce(rv.rating, 0),
          'review_count', coalesce(rv.review_count, 0),
          'daily_rate', pr.daily_rate,
          'daily_rate_max', pr.daily_rate_max,
          'address', pr.address,
          'rank', ar.rank,
          'match_score', ar.match_score,
          'headline', ar.headline,
          'details', ar.details,
          'summary', ar.summary,
          'model', ar.model,
          'created_at', ar.created_at
        )
        order by ar.rank
      )
      from public.ai_recommendations ar
      join public.providers pr on pr.id = ar.provider_id
      left join (
        select provider_id,
               round(
                 avg(
                   (score_experience + score_values + score_communication + score_safety) / 4.0
                 ),
                 1
               ) as rating,
               count(*)::int as review_count
        from public.reviews
        group by provider_id
      ) rv on rv.provider_id = ar.provider_id
      where ar.parent_id = p_parent_id
    ), '[]'::jsonb),
    'chat', (
      select jsonb_build_object(
        'messages', count(*)::int,
        'user_messages', count(*) filter (where cm.role = 'user')::int,
        'assistant_messages', count(*) filter (where cm.role = 'assistant')::int,
        'first_at', min(cm.created_at),
        'last_at', max(cm.created_at),
        'models', coalesce(
          jsonb_agg(distinct cm.model) filter (where cm.model is not null),
          '[]'::jsonb
        )
      )
      from public.ai_chat_messages cm
      where cm.parent_id = p_parent_id
    ),
    'context', jsonb_build_object(
      'favorites_count', (
        select count(*)::int from public.favorites f where f.parent_id = p_parent_id
      ),
      'bookings_total', (
        select count(*)::int from public.care_bookings cb where cb.parent_id = p_parent_id
      ),
      'bookings_confirmed', (
        select count(*)::int
        from public.care_bookings cb
        where cb.parent_id = p_parent_id and cb.status = 'confirmed'
      ),
      'last_care_date', (
        select max(cb.care_date)
        from public.care_bookings cb
        where cb.parent_id = p_parent_id and cb.status = 'confirmed'
      ),
      'providers_booked', (
        select count(*)::int from public.rebook_tracking rt where rt.parent_id = p_parent_id
      ),
      'providers_rebooked', (
        select count(*)::int
        from public.rebook_tracking rt
        where rt.parent_id = p_parent_id and rt.is_rebooking
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.admin_ai_detail(text) is
  'Admin-only AI recommendation set for one family. Chat message bodies are not included.';

revoke all on function public.admin_ai_detail(text) from public, anon;
grant execute on function public.admin_ai_detail(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Clear a stale recommendation set
--    Deletes only the cached matches. The family gets a fresh set the next
--    time they open recommendations. Chat history is untouched, and every
--    call is recorded in the admin audit log.
-- ---------------------------------------------------------------------
create or replace function public.admin_clear_ai_recommendations(p_parent_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.parents p where p.id = p_parent_id) then
    raise exception 'Family not found: %', p_parent_id using errcode = 'P0002';
  end if;

  delete from public.ai_recommendations ar where ar.parent_id = p_parent_id;
  get diagnostics v_deleted = row_count;

  insert into public.admin_audit_log
    (admin_user_id, admin_email, action, target_type, target_id, details)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'ai.clear_recommendations',
    'parent',
    p_parent_id,
    jsonb_build_object('deleted', v_deleted)
  );

  return v_deleted;
end;
$$;

comment on function public.admin_clear_ai_recommendations(text) is
  'Admin-only support action that clears a family''s cached AI matches and writes an audit log entry.';

revoke all on function public.admin_clear_ai_recommendations(text) from public, anon;
grant execute on function public.admin_clear_ai_recommendations(text) to authenticated;
