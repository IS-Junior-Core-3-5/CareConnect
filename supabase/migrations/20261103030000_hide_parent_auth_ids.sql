-- Follow-up to 20261103020000_privacy_hardening.sql.
--
-- Anonymous visitors can no longer read parents.auth_user_id, but every
-- logged-in user still could. The app now resolves the caller's own parent row
-- through public.my_parent_id(), so remove the column grant for authenticated
-- users as well.
--
-- Safe to apply to the live project: it only removes access and changes no data.

revoke select (auth_user_id) on public.parents from authenticated;
