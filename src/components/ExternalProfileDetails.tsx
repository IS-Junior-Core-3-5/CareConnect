import { Link } from "@tanstack/react-router";
import type { ExternalProfile } from "@/lib/external-profiles";
import { BLOCKS, BLOCK_HOURS, DAYS, formatDate, type Provider, type Schedule } from "@/lib/model";

export function SourceNote({ sourceUrl, checkedOn }: { sourceUrl: string; checkedOn: string }) {
  return (
    <p className="mt-2 text-xs text-ink-soft">
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
        Source ↗
      </a>{" "}
      · Checked {formatDate(checkedOn)}
    </p>
  );
}

export function OfficialLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-primary-ink underline underline-offset-2"
    >
      {children} ↗
    </a>
  );
}

const blockMinutes = [
  [7 * 60, 12 * 60],
  [12 * 60, 17 * 60],
  [17 * 60, 21 * 60],
];

export function PublishedSchedule({
  hours,
  schedule,
  signedIn,
  contactUrl,
}: {
  hours: ExternalProfile["hours"];
  schedule: Schedule;
  signedIn: boolean;
  contactUrl: Provider["contactUrl"];
}) {
  if (hours.kind === "variable") {
    return (
      <div className="mt-4">
        <p className="font-semibold">{hours.summary}</p>
        <p className="mt-2 text-sm text-ink-soft">
          A fixed weekly comparison is unavailable for this service.
        </p>
        {contactUrl ? <OfficialLink href={contactUrl}>Request a sitter</OfficialLink> : null}
        <SourceNote {...hours} />
      </div>
    );
  }

  const needs = DAYS.flatMap((day, dayIndex) =>
    BLOCKS.flatMap((block, blockIndex) => {
      if (!schedule[dayIndex]?.[blockIndex]) return [];
      const [start, end] = blockMinutes[blockIndex];
      const overlap = hours.days.includes(dayIndex)
        ? Math.min(end, hours.endMinute) - Math.max(start, hours.startMinute)
        : 0;
      return [
        {
          day,
          block,
          result:
            overlap <= 0
              ? "Outside published hours"
              : overlap === end - start
                ? "Within published hours"
                : `Partial overlap · ${overlap} min`,
        },
      ];
    }),
  );

  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-primary-ink">{hours.label}</p>
      <p className="mt-1 font-semibold">{hours.summary}</p>
      <p className="mt-2 text-sm text-ink-soft">{hours.note}</p>
      <SourceNote {...hours} />
      {signedIn ? (
        needs.length ? (
          <table className="mt-4 w-full text-left text-sm">
            <caption className="mb-2 text-left font-semibold">
              Your needed blocks vs. published hours
            </caption>
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Your need
                </th>
                <th scope="col" className="py-2">
                  Time overlap
                </th>
              </tr>
            </thead>
            <tbody>
              {needs.map(({ day, block, result }) => (
                <tr key={day + block} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {day} · {BLOCK_HOURS[block]}
                  </th>
                  <td className="py-2">{result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">
            <Link to="/schedule" className="font-semibold text-primary-ink underline">
              Add your needed blocks
            </Link>{" "}
            to compare them with these published hours.
          </p>
        )
      ) : (
        <p className="mt-4 text-sm text-ink-soft">
          <Link to="/" className="font-semibold text-primary-ink underline">
            Sign in
          </Link>{" "}
          to compare your saved schedule with these published hours.
        </p>
      )}
      <p className="mt-3 text-xs text-ink-soft">
        This comparison uses published times only. Confirm care availability directly with the
        provider.
      </p>
    </div>
  );
}

export function ExternalLocation({
  provider,
  location,
}: {
  provider: Provider;
  location: ExternalProfile["location"];
}) {
  if ("serviceArea" in location) {
    return (
      <>
        <p className="mt-1 font-semibold">{location.serviceArea}</p>
        {provider.contactUrl ? (
          <OfficialLink href={provider.contactUrl}>Request a sitter</OfficialLink>
        ) : null}
        <SourceNote {...location} />
      </>
    );
  }

  const query = new URLSearchParams({ api: "1", query: `${provider.name}, ${location.address}` });
  const directions = new URLSearchParams({ api: "1", destination: location.address });
  return (
    <>
      <p className="mt-1 font-semibold">{location.address}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <OfficialLink href={`https://www.google.com/maps/search/?${query}`}>
          View location
        </OfficialLink>
        <OfficialLink href={`https://www.google.com/maps/dir/?${directions}`}>
          Get directions
        </OfficialLink>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Choose an origin in Google Maps to see route distance.
      </p>
      <SourceNote {...location} />
    </>
  );
}
