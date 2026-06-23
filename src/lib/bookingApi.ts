// Hostbase public Booking API client (Phase 2.4-B).
//
// The public site no longer queries the PMS booking tables directly with the
// anon key. Instead it calls four Hostbase Edge Functions that resolve the
// tenant server-side from the request domain (the browser's Origin) and return
// only that org's data. See BOOKING_API_REPOINT_SPEC.md.
//
// Base URL is the same PMS project the booking client already pointed at
// (VITE_SUPABASE_URL). All endpoints are POST + JSON, with verify_jwt=false, so
// no apikey/JWT is sent — plain fetch is correct.

const BOOKING_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// On localhost / Vercel preview the Origin isn't a tenant domain, so the API
// can't resolve the tenant from it. serving_host is an optional fallback used
// only when the real Origin doesn't resolve (prod stays Origin-resolved). When
// the var is unset, JSON.stringify drops the undefined key — harmless in prod.
const SERVING_HOST = import.meta.env.VITE_BOOKING_SERVING_HOST as string | undefined;

export class BookingApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
  }
}

async function post<T>(path: string, body: object = {}): Promise<T> {
  const res = await fetch(`${BOOKING_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, serving_host: SERVING_HOST }),
  });

  if (!res.ok) {
    let message = `Request to ${path} failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.error) message = err.error;
      else if (err?.message) message = err.message;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new BookingApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface PublicProperty {
  property: {
    id: string;
    name: string;
    currency: string;
    city: string | null;
    country: string | null;
    address: string | null;
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
    default_checkin_time: string | null;
    default_checkout_time: string | null;
  };
  organization: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  };
}

export interface AvailabilityUnit {
  id: string;
  name: string;
  booking_com_name: string | null;
  unit_type: string | null;
  unit_number: string | null;
  status: string;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  unit_size: string | null;
  sofa_bed: boolean | null;
  tax_percentage: number | null;
  photos: string[] | null;
  room_type_display_order: number | null;
}

export interface AvailabilityResponse {
  property_id: string;
  units: AvailabilityUnit[];
  // null when no dates are given (all units returned); otherwise the subset
  // bookable for the requested range (same overlap + blocked-date rule).
  availableUnitIds: string[] | null;
}

export interface RatePlanMeta {
  ratePlanId: string;
  ratePlanName: string;
  weekdayRate: number;
  weekendRate: number;
  offPeakRate: number | null;
  minStay: number;
  extraAdultRate: number;
}

export interface DailyRate {
  date: string;
  finalRate: number;
  baseRate: number;
}

export interface RatesResponse {
  room_type: string;
  ratePlan: RatePlanMeta;
  currency: string;
  rates: DailyRate[];
  nightlyTotal: number;
}

export interface CreateReservationInput {
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
  guest_names: string[];
  guest_types?: string[];
  guest_genders?: string[];
  adults?: number;
  children?: number;
  contact_email: string;
  contact_phone?: string;
  guest_nationality?: string;
  notes?: string;
}

export interface CreateReservationResponse {
  ok: boolean;
  booking_reference: string;
  reservation_id: string;
  total_price: number;
  price_per_night: number;
  currency: string;
}

// ── Endpoints ────────────────────────────────────────────────────────────

/** Property + organization branding for the tenant resolved from the domain. */
export const getPublicProperty = () =>
  post<PublicProperty>('public-property');

/**
 * Room types + open units. date_to is the checkout date (exclusive). With no
 * dates, availableUnitIds is null and all units are returned.
 */
export const getAvailability = (params: {
  date_from?: string;
  date_to?: string;
  unit_type?: string;
} = {}) => post<AvailabilityResponse>('public-availability', params);

/**
 * Nightly rates + rate-plan meta. date_to is the checkout date (exclusive).
 *
 * Pass `unit_id` when quoting a specific unit: the server then resolves the
 * room-type from `units.name` — the same key `public-create-reservation` prices
 * on — so the quoted (read) total and the booked (write) total can't desync even
 * if `booking_com_name` diverges from `name`. Use a bare `room_type` only when
 * there's no specific unit (e.g. a representative rate on Locations).
 */
export const getRates = (params: {
  room_type?: string;
  unit_id?: string;
  date_from: string;
  date_to: string;
}) => post<RatesResponse>('public-rates', params);

/**
 * Create a reservation. The server recomputes the price authoritatively and
 * ignores any client total — do NOT send total_price. It also fires the
 * reservation notification email. Use the returned total_price for the UI.
 */
export const createReservation = (input: CreateReservationInput) =>
  post<CreateReservationResponse>('public-create-reservation', input);
