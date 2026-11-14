# CareConnect demo preview

Use a fresh local Supabase instance and a separate Vite environment for this demo. The seed script accepts only the default loopback API URL and uses a local service key that stays outside the browser. The local seed script adds test accounts for exercising real booking and photo upload flows.

## Website preview

The **Providers** page uses the same Supabase directory for every listing. The unified directory migration adds the 56 fictional profiles. Signed-in users can save favorites and apply the distance filter using their saved address. Paper Kite and Pebble Path offer a practice request on the profile.

## Start the full local demo

1. In an empty temporary directory, run `supabase init` and `supabase start`. This requires the Supabase CLI and Docker. Copy this repository's `supabase/functions/provider-distances` directory to the temporary project's `supabase/functions/` directory, then run `supabase functions serve provider-distances` from that project.
2. From the CareConnect checkout, initialize the **fresh local database** with the commands below. The existing setup file rebuilds the database, so use these commands only against the new local instance. Applying the migrations by filename also accommodates the two older files that share a timestamp.

   ```sh
   psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/setup.sql
   for migration in supabase/migrations/*.sql; do
     psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f "$migration" || break
   done
   ```

3. Set `CARECONNECT_DEMO_SERVICE_KEY` to the **local** service role or secret key from `supabase status`. Set `CARECONNECT_DEMO_PASSWORD` to a password of at least 12 characters. Run `node supabase/demo/seed.mjs` from the repo after installing dependencies. The script reuses the demo accounts and restores the sample details on each run.
4. Start Vite with `VITE_SUPABASE_URL=http://127.0.0.1:54321`, `VITE_SUPABASE_PUBLISHABLE_KEY` set to the **local** anon or publishable key. Open `/providers` using the URL Vite prints.

## Walkthrough

- The directory has 56 fictional providers. The migration deletes the six retired listings and applies the existing foreign-key delete rules to records tied to those IDs. Filter by care type or price. The sample listings use the same tables as My Listing for prices, pricing notes, languages, credentials, and schedule blocks. Fictional phone numbers are displayed as text. Each fictional listing has its own generated portrait, facility image, or brand mark. Select profiles also show generated activity scenes. A provider upload takes precedence over the generated profile image.
- Sign in as `demo-parent@careconnect.example` with the password you set. Compare your Monday/Wednesday/Friday morning schedule with Paper Kite Daycare's schedule, save it as a favorite, and request an upcoming available block. Sign in as `demo-provider-1@careconnect.example` and confirm the request in My Profile under Care requests. Pebble Path Daycare is owned by `demo-provider-2@careconnect.example`. The remaining 54 fictional listings support discovery and comparison.
- As the demo parent, select a distance limit. The profile starts with the Orem landmark as the private address. Change it to another landmark, save, and compare the results. The existing distance function calls the U.S. Census Geocoder and calculates straight-line miles. The demo's manual distance fields are empty.
- As either demo provider, open My Listing and select a JPEG, PNG, or WebP image up to 5 MB. Save and check the card and profile. Reopen My Listing to replace or remove it. Uploaded pictures are public. Storage writes are scoped to the signed-in user's folder.
- To roll out photo upload separately, apply `20261110000000_provider_profile_photo.sql` before publishing the app code that reads the new field. Use the test-account seed script only in a fresh local instance.

## Demo map references

Address sources checked November 10, 2026. These public locations serve as distance inputs.

| City | Landmark and official source |
| --- | --- |
| Provo | [Provo City Library](https://www.provo.gov/facilities/facility/details/Provo-City-Library-42) |
| Orem | [Orem Public Library](https://oremlibrary.org/) |
| American Fork | [American Fork Library](https://americanfork.gov/facilities/facility/details/Library-38) |
| Pleasant Grove | [Pleasant Grove Library](https://library.utah.gov/directory/listing/pleasant-grove-library/) |
| Lehi | [Lehi City Library](https://www.lehi-ut.gov/recreation-community/library/) |
| Springville | [Springville Public Library](https://www.springvilleutah.gov/library/your-library/contact/) |
| Spanish Fork | [Spanish Fork Public Library](https://library.utah.gov/directory/listing/spanish-fork-public-library/) |
