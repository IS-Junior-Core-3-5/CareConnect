-- Ensure existing installations do not expose login counts to browser/API roles.
drop policy if exists "Users can read their own login count" on public.user_login_counts;
revoke all on public.user_login_counts from public, anon, authenticated;
