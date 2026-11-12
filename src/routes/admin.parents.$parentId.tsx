import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorState, LoadingState } from "@/components/NavBar";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import {
  useAdminParent,
  type AdminParentBooking,
  type AdminParentPreferences,
  type AdminBookingStatus,
} from "@/lib/admin-data";
import { formatDate, scheduleFromRows } from "@/lib/model";

export const Route = createFileRoute("/admin/parents/$parentId")({
  head: () => ({
    meta: [{ title: "Admin family — CareConnect" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminParentDetailPage,
});

const STATUS_LABEL: Record<AdminBookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<AdminBookingStatus, string> = {
  pending: "bg-sun-soft text-ink-soft",
  confirmed: "bg-leaf-soft text-leaf-ink",
  declined: "bg-clay-soft text-clay",
  cancelled: "bg-background text-ink-faint ring-1 ring-line",
};

function dateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <p className="mt-1 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chips({ items, empty = "Not set" }: { items: string[]; empty?: string }) {
  if (!items.length) return <span className="text-sm text-ink-faint">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-line"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function budgetLabel(preferences: AdminParentPreferences) {
  if (preferences.budget_min === null && preferences.budget_max === null) return "Not set";
  if (preferences.budget_min !== null && preferences.budget_max !== null) {
    return `$${preferences.budget_min}–$${preferences.budget_max} / day`;
  }
  if (preferences.budget_max !== null) return `Up to $${preferences.budget_max} / day`;
  return `From $${preferences.budget_min} / day`;
}

function BookingRow({ booking }: { booking: AdminParentBooking }) {
  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="px-3 py-2.5">
        <div className="font-medium">{formatDate(booking.care_date)}</div>
        <div className="text-xs text-ink-soft">{booking.block}</div>
      </td>
      <td className="px-3 py-2.5">
        <div className="font-medium">{booking.provider_name}</div>
        <div className="font-mono text-xs text-ink-faint">{booking.provider_id}</div>
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${STATUS_CLASS[booking.status]}`}
        >
          {STATUS_LABEL[booking.status]}
        </span>
        {booking.resolution_note ? (
          <p className="mt-1.5 max-w-[28ch] text-xs text-ink-soft">{booking.resolution_note}</p>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-xs text-ink-soft">
        <div>Requested {dateTime(booking.created_at)}</div>
        {booking.updated_at !== booking.created_at ? (
          <div>Updated {dateTime(booking.updated_at)}</div>
        ) : null}
      </td>
    </tr>
  );
}

function AdminParentDetailPage() {
  const { parentId } = Route.useParams();
  const query = useAdminParent(parentId);

  if (query.isLoading) return <LoadingState label="Loading family…" />;

  if (query.error) {
    return (
      <div>
        <ErrorState error={query.error} />
        <p className="text-sm text-ink-soft">
          The admin parents migrations may not be applied yet. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261113000000_admin_parents.sql
          </code>{" "}
          and then{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261113000001_fix_admin_parents_ambiguity.sql
          </code>{" "}
          in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const detail = query.data;
  if (!detail) return null;

  const { parent, children, languages, schedule, preferences, favorites, bookings, rebook } =
    detail;
  const { activity, recommendations } = detail;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/parents" className="text-sm font-semibold text-ink-soft hover:text-ink">
          ← Back to parents
        </Link>
      </div>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {parent.name}
              </h2>
              <span className="rounded-full bg-sun-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                Private admin view
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-ink-faint">{parent.id}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
              {parent.email ? (
                <a href={`mailto:${parent.email}`} className="text-primary-ink hover:underline">
                  {parent.email}
                </a>
              ) : (
                <span>No email on file</span>
              )}
              <span>{parent.neighborhood || "No neighborhood"}</span>
              <span>Joined {formatDate(parent.created_at)}</span>
            </div>
            {parent.address ? (
              <p className="mt-1 text-sm text-ink-soft">{parent.address}</p>
            ) : (
              <p className="mt-1 text-sm text-ink-faint">No private address on file</p>
            )}
            {parent.blurb ? (
              <p className="mt-3 max-w-[70ch] text-sm text-ink-soft text-pretty">{parent.blurb}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Children" value={children.length} />
        <Metric label="Care blocks / week" value={schedule.length} hint="Blocks the family needs" />
        <Metric label="Favorites" value={favorites.length} hint="Saved providers" />
        <Metric
          label="Bookings"
          value={bookings.length >= 30 ? "30+" : bookings.length}
          hint={`${rebook.confirmed_bookings} confirmed · ${rebook.total_rebookings} rebookings`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Household" description="Private family details from the account profile.">
          <div className="space-y-4">
            <Field label="Children">
              {children.length ? (
                <ul className="space-y-1.5">
                  {children.map((child) => (
                    <li key={child.id} className="flex items-center justify-between gap-3">
                      <span className="font-medium">{child.name}</span>
                      <span className="text-xs text-ink-soft">
                        {child.age === null ? "Age unknown" : `Age ${child.age}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-faint">No children saved</span>
              )}
            </Field>
            <Field label="Languages">
              <Chips items={languages} />
            </Field>
            <Field label="Private address">
              <span className={parent.address ? "" : "text-ink-faint"}>
                {parent.address || "Not saved"}
              </span>
            </Field>
          </div>
        </Section>

        <Section
          title="Care schedule"
          description="When this family needs care. This is private family activity."
        >
          {schedule.length ? (
            <ScheduleGrid schedule={scheduleFromRows(schedule)} />
          ) : (
            <p className="text-sm text-ink-faint">No care blocks saved yet.</p>
          )}
        </Section>
      </div>

      <Section
        title="AI preferences"
        description="Private preferences used by recommendations and the AI chat."
      >
        {preferences ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Care types">
                <Chips items={preferences.care_types} />
              </Field>
              <Field label="Care setting">
                <Chips items={preferences.care_settings} />
              </Field>
              <Field label="Arrangement">
                <span className={preferences.arrangement ? "" : "text-ink-faint"}>
                  {preferences.arrangement || "Not set"}
                </span>
              </Field>
              <Field label="Start date">
                <span className={preferences.start_date ? "" : "text-ink-faint"}>
                  {preferences.start_date ? formatDate(preferences.start_date) : "Not set"}
                </span>
              </Field>
              <Field label="Budget">
                <span>{budgetLabel(preferences)}</span>
                {preferences.budget_flexibility ? (
                  <span className="block text-xs text-ink-soft">
                    {preferences.budget_flexibility}
                  </span>
                ) : null}
              </Field>
              <Field label="Max distance">
                <span className={preferences.max_distance_miles === null ? "text-ink-faint" : ""}>
                  {preferences.max_distance_miles === null
                    ? "Not set"
                    : `${preferences.max_distance_miles} miles`}
                </span>
                <span className="block text-xs text-ink-soft">
                  {preferences.needs_transportation
                    ? "Needs transportation"
                    : "No transportation need"}
                </span>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred cities">
                <Chips items={preferences.preferred_cities} />
              </Field>
              <Field label="Languages wanted">
                <Chips items={preferences.languages_wanted} />
              </Field>
              <Field label="Must-haves">
                <Chips items={preferences.must_haves} />
              </Field>
              <Field label="Approaches">
                <Chips items={preferences.approaches} />
              </Field>
              <Field label="Communication">
                <Chips items={preferences.communication} />
              </Field>
              <Field label="Priorities">
                <Chips items={preferences.priorities} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Child needs">
                <span className={preferences.child_needs ? "" : "text-ink-faint"}>
                  {preferences.child_needs || "Not set"}
                </span>
              </Field>
              <Field label="Diet">
                <span className={preferences.diet ? "" : "text-ink-faint"}>
                  {preferences.diet || "Not set"}
                </span>
              </Field>
              <Field label="Dealbreakers">
                <span className={preferences.dealbreakers ? "" : "text-ink-faint"}>
                  {preferences.dealbreakers || "Not set"}
                </span>
              </Field>
              <Field label="Notes for the AI">
                <span className={preferences.notes_for_ai ? "" : "text-ink-faint"}>
                  {preferences.notes_for_ai || "Not set"}
                </span>
              </Field>
            </div>

            <p className="text-xs text-ink-faint">
              Answer style: {preferences.ai_answer_style} · Last saved{" "}
              {dateTime(preferences.updated_at)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-faint">
            This family hasn't saved AI preferences yet. Recommendations use their profile,
            schedule, children, and languages.
          </p>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Favorites" description="Providers this family saved.">
          {favorites.length ? (
            <ul className="space-y-2">
              {favorites.map((favorite) => (
                <li
                  key={favorite.provider_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background p-3 ring-1 ring-line"
                >
                  <div>
                    <div className="font-semibold">
                      {favorite.is_public ? (
                        <Link
                          to="/providers/$providerId"
                          params={{ providerId: favorite.provider_id }}
                          className="hover:text-primary-ink hover:underline"
                        >
                          {favorite.name}
                        </Link>
                      ) : (
                        favorite.name
                      )}
                    </div>
                    <div className="text-xs text-ink-soft">
                      {favorite.care_type}
                      {favorite.is_public ? "" : " · archived"}
                    </div>
                  </div>
                  <span className="text-xs text-ink-faint">
                    Saved {formatDate(favorite.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">No saved providers.</p>
          )}
        </Section>

        <Section title="Rebooking" description="Confirmed bookings and repeat-provider history.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Providers booked" value={rebook.providers_booked} />
            <Metric label="Providers rebooked" value={rebook.providers_rebooked} />
            <Metric label="Confirmed bookings" value={rebook.confirmed_bookings} />
            <Metric
              label="Last care date"
              value={
                rebook.last_care_date ? (
                  <span className="text-lg">{formatDate(rebook.last_care_date)}</span>
                ) : (
                  "—"
                )
              }
            />
          </div>
        </Section>
      </div>

      <Section
        title="Recent bookings"
        description="The 30 most recent care requests for this family. Resolve them from the bookings queue."
      >
        {bookings.length ? (
          <>
            <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="px-3 py-2.5 font-medium">Care</th>
                    <th className="px-3 py-2.5 font-medium">Provider</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Timeline</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <BookingRow key={booking.id} booking={booking} />
                  ))}
                </tbody>
              </table>
            </div>
            <Link
              to="/admin/bookings"
              className="mt-3 inline-block text-sm font-semibold text-primary-ink hover:underline"
            >
              Open bookings queue →
            </Link>
          </>
        ) : (
          <p className="text-sm text-ink-faint">No care requests yet.</p>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="AI recommendations" description="Saved recommendation set for this family.">
          {recommendations.length ? (
            <ul className="space-y-2">
              {recommendations.map((recommendation) => (
                <li
                  key={recommendation.provider_id}
                  className="rounded-2xl bg-background p-3 ring-1 ring-line"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">
                      <span className="mr-2 font-mono text-xs text-ink-faint">
                        #{recommendation.rank}
                      </span>
                      <Link
                        to="/providers/$providerId"
                        params={{ providerId: recommendation.provider_id }}
                        className="hover:text-primary-ink hover:underline"
                      >
                        {recommendation.provider_name}
                      </Link>
                    </div>
                    {recommendation.match_score !== null ? (
                      <span className="rounded-full bg-primary-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary-ink">
                        {recommendation.match_score}% match
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{recommendation.headline}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {recommendation.model ? `${recommendation.model} · ` : ""}
                    Generated {dateTime(recommendation.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">No saved recommendations yet.</p>
          )}
        </Section>

        <Section title="Activity" description="Login and discovery activity for this family.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Logins" value={activity.login_count} />
            <Metric
              label="Last login"
              value={
                <span className="text-lg">
                  {activity.last_login_at ? dateTime(activity.last_login_at) : "—"}
                </span>
              }
            />
            <Metric label="Search sessions" value={activity.search_sessions} />
            <Metric
              label="Avg. search time"
              value={
                activity.avg_search_minutes === null ? "—" : `${activity.avg_search_minutes} min`
              }
              hint={
                activity.last_search_at
                  ? `Last session ${dateTime(activity.last_search_at)}`
                  : undefined
              }
            />
            <Metric label="AI chat messages" value={activity.chat_messages} />
          </div>
        </Section>
      </div>
    </div>
  );
}
