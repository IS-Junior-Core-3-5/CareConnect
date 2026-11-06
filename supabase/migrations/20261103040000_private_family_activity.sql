-- Follow-up to 20261103030000_hide_parent_auth_ids.sql.
--
-- Every page in the app requires a logged-in session, but the API still let
-- anonymous visitors read family activity:
--   * parent_availability    -- when each family needs care, i.e. when a home
--                              may be without a parent
--   * provider_past_families -- which named family used which provider
--   * favorites              -- each family's shortlist
--   * reviews                -- reviewer parent ids and review text
--
-- None of it is needed before login: the sign-in screen now asks for a
-- verified-provider count only (see src/routes/index.tsx). Row Level Security
-- policies are unchanged; this only removes the anonymous column grants.
--
-- Safe to apply to the live project: it only removes access and changes no data.

revoke select on public.parent_availability    from anon;
revoke select on public.provider_past_families from anon;
revoke select on public.favorites              from anon;
revoke select on public.reviews                from anon;

grant select on public.parent_availability    to authenticated;
grant select on public.provider_past_families to authenticated;
grant select on public.favorites              to authenticated;
grant select on public.reviews                to authenticated;
