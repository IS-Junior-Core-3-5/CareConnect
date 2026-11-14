import { supabase } from "@/integrations/supabase/client";

/** A Census match: the normalized address and its point. */
export type GeocodeMatch = {
  matchedAddress: string;
  latitude: number;
  longitude: number;
};

export type AddressLookupCode = "invalid" | "not_found" | "unavailable" | "unknown";

/**
 * Raised when an address cannot be checked. `code` tells the caller whether to
 * block the save (`invalid`, `not_found`) or to let it through with a warning
 * (`unavailable` — the Census service is down, not the user's address).
 */
export class AddressLookupError extends Error {
  readonly code: AddressLookupCode;

  constructor(message: string, code: AddressLookupCode) {
    super(message);
    this.name = "AddressLookupError";
    this.code = code;
  }
}

type ErrorBody = { error?: unknown; code?: unknown };

function codeFrom(value: unknown): AddressLookupCode {
  return value === "invalid" || value === "not_found" || value === "unavailable"
    ? value
    : "unknown";
}

/**
 * Validates a U.S. address with the geocode-address edge function.
 * The function uses the same Census geocoder as the distance filter, so a match
 * here means the address can be located later.
 */
export async function validateAddress(address: string): Promise<GeocodeMatch> {
  const trimmed = address.trim();
  if (trimmed.length < 5) {
    throw new AddressLookupError(
      "Enter a full street address, including city, state, and ZIP.",
      "invalid",
    );
  }

  const { data, error } = await supabase.functions.invoke("geocode-address", {
    body: { address: trimmed },
  });

  if (error) {
    const body = (await (error as { context?: Response }).context
      ?.json?.()
      .catch(() => null)) as ErrorBody | null;
    throw new AddressLookupError(
      typeof body?.error === "string" ? body.error : "We couldn't check that address right now.",
      codeFrom(body?.code),
    );
  }

  if (data?.error) {
    throw new AddressLookupError(String(data.error), codeFrom(data.code));
  }

  return data as GeocodeMatch;
}

/**
 * True when the address itself is the problem and the user must fix it before
 * saving. An outage or an unexpected lookup failure is not the user's fault, so
 * it does not block the save; the coordinates are filled on a later save.
 */
export function addressNeedsFixing(error: unknown): boolean {
  return (
    error instanceof AddressLookupError && (error.code === "invalid" || error.code === "not_found")
  );
}
