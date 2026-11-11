import { createClient } from "@supabase/supabase-js";
import { buildDemoProviders, landmarks } from "./providers.mjs";

const url = new URL(process.env.CARECONNECT_DEMO_URL ?? "http://127.0.0.1:54321");
if (url.origin !== "http://127.0.0.1:54321" || url.href !== url.origin + "/") {
  throw new Error("Use a fresh local Supabase instance at http://127.0.0.1:54321.");
}

const key = process.env.CARECONNECT_DEMO_SERVICE_KEY;
const password = process.env.CARECONNECT_DEMO_PASSWORD;
if (!key || !password || password.length < 12) {
  throw new Error(
    "Set CARECONNECT_DEMO_SERVICE_KEY and a demo password of at least 12 characters.",
  );
}
const client = createClient(url.origin, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function result({ data, error }) {
  if (error) throw error;
  return data;
}

const accounts = [
  { email: "demo-parent@careconnect.example", name: "Demo Parent" },
  { email: "demo-provider-1@careconnect.example", name: "Demo Provider One" },
  { email: "demo-provider-2@careconnect.example", name: "Demo Provider Two" },
];
const existingUsers = result(await client.auth.admin.listUsers({ perPage: 1000 })).users;
const ids = [];
for (const { email, name } of accounts) {
  const existing = existingUsers.find((user) => user.email === email);
  const { user } = existing
    ? result(await client.auth.admin.updateUserById(existing.id, { password }))
    : result(
        await client.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name },
        }),
      );
  ids.push(user.id);
}
const [parentId, ...ownerIds] = ids;
result(
  await client.from("parent_private_addresses").upsert({
    parent_id: parentId,
    address: landmarks[1].address,
    latitude: null,
    longitude: null,
    geocoded_at: null,
  }),
);
result(
  await client
    .from("parent_availability")
    .upsert(
      [0, 2, 4].map((day_of_week) => ({ parent_id: parentId, day_of_week, block: "Morning" })),
    ),
);

const providers = buildDemoProviders(ownerIds);
const languages = [...new Set(providers.flatMap((p) => p.languages))];
result(
  await client.from("languages").upsert(
    languages.map((name) => ({ name })),
    { onConflict: "name" },
  ),
);
const languageRows = result(await client.from("languages").select("id,name").in("name", languages));
const languageIds = new Map(languageRows.map(({ name, id }) => [name, id]));
result(await client.from("providers").upsert(providers.map((p) => p.listing)));

const providerIds = providers.map((p) => p.listing.id);
const details = {
  provider_pricing_notes: providers.flatMap(({ listing, notes }) =>
    notes.map((note, sort_order) => ({ provider_id: listing.id, note, sort_order })),
  ),
  provider_credentials: providers.flatMap(({ listing, credentials }) =>
    credentials.map((name) => ({ provider_id: listing.id, name, verified: false })),
  ),
  provider_languages: providers.flatMap(({ listing, languages }) =>
    languages.map((name) => ({ provider_id: listing.id, language_id: languageIds.get(name) })),
  ),
  provider_availability: providers.flatMap(({ listing, availability }) =>
    availability.map((block) => ({ provider_id: listing.id, ...block })),
  ),
};
for (const [table, rows] of Object.entries(details)) {
  result(await client.from(table).delete().in("provider_id", providerIds));
  if (rows.length) result(await client.from(table).insert(rows));
}
console.log(`Seeded ${providers.length} fictional listings. Demo sign-in emails:`);
accounts.forEach(({ email }) => console.log(email));
