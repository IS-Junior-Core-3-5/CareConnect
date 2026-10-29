# Scheduling backend

CareConnect stores two kinds of schedule data in Supabase:

| Data | Table | Meaning |
| --- | --- | --- |
| Parent weekly need | `parent_availability` | Monday through Sunday, Morning/Afternoon/Evening blocks |
| Provider weekly offer | `provider_availability` | Blocks a provider lists as available |
| Dated care request | `care_bookings` | One parent requests one provider for a calendar date and block |

Supabase Auth identifies the signed-in user. A signup trigger creates their `parents` row and initial weekly schedule. The frontend loads their saved schedule on login. Provider schedules belong to the user who owns the listing. Row level security limits booking reads to the requesting parent and listing owner, and limits writes to the relevant participant.

## Apply to the existing project

1. Back up the production database and review the current schema and policies.
2. Apply `supabase/migrations/20261029000000_care_bookings.sql` to a development or staging copy first, then to the CareConnect project. This migration adds a table and policies; it does not delete existing records.
3. Do **not** run `supabase/setup.sql` on a database with user data. That file drops and recreates CareConnect tables.
4. Publish the updated app after the migration is live. The request form requires the new table.

Before adopting automated `supabase db push`, baseline the live schema with `supabase db pull` and verify the resulting migrations against a disposable local database. The single setup file is not a safe production migration history.

## Verify with two test accounts

1. Sign in as a parent and a provider who owns a listing with weekly availability.
2. On that provider's page, request a future date and available time block.
3. Refresh and sign back in as the parent. The request should still appear under **Schedule → Care requests**.
4. Sign in as the provider, confirm the request, and refresh. The status should remain confirmed.
5. Sign in as the parent, cancel it, and refresh. The status should remain cancelled.
6. Try to confirm a second request for the same provider/date/block. The database should reject it.

Requests to demo providers without a listing owner are unavailable until a real provider account creates or takes ownership of a listing. Booking records intentionally avoid storing child details or private contact information.
