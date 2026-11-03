-- Privacy hardening for existing installations.
-- Apply after 20261103010000_restrict_user_login_counts.sql.
-- Safe to apply to the live project: it only removes access and replaces a policy.

-- ---------------------------------------------------------------------
-- 1. Parents' Supabase auth ids are not public.
--    setup.sql used to grant select (auth_user_id) on parents to anon,
--    which exposed every parent's auth UUID to anonymous visitors.
-- ---------------------------------------------------------------------
revoke select (auth_user_id) on public.parents from anon;

-- ---------------------------------------------------------------------
-- 2. Children's names and ages are visible only to their own parent.
--    The public read policy let anyone list every family's children.
--    With no policy for anon, anonymous requests see zero rows.
-- ---------------------------------------------------------------------
drop policy if exists "public read" on public.children;
drop policy if exists "own children read" on public.children;
create policy "own children read" on public.children for select to authenticated
  using (parent_id = public.my_parent_id());
