-- The AI chat reads provider_match_features(), which reads provider_summary.
-- 20261116 hid every listing_origin = 'sample' row from that view, but every
-- provider is now a sample listing, so the AI received zero providers and the
-- chat silently returned nothing. Show the AI every public listing instead.
create or replace view public.provider_summary with (security_invoker = true) as
select p.id, p.owner_id, p.name, p.care_type, p.blurb, p.bio,
       p.daily_rate, p.daily_rate_max, p.address, p.phone, p.distance_miles,
       p.latitude, p.longitude, p.verified, p.schedule_available,
       p.schedule_summary, p.photo_key, p.created_at,
       round(avg((r.score_experience + r.score_values + r.score_communication + r.score_safety) / 4.0), 1) as rating,
       count(r.id)::int as review_count
from public.providers p
left join public.reviews r on r.provider_id = p.id
where p.is_public
group by p.id;
