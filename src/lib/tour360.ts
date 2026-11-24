// 360 room tours for the ICONIA Zamalek suite types.
// Panoramas are 4096x2048 equirectangular JPEGs in public/360/ (source masters
// and generation record live in the iconia-3d repo, output/360/).
// Keys match the room-type names returned by the Hostbase Booking API.

export interface TourRoom {
  key: string;
  name: string;
}

export const TOURS_360: Record<string, TourRoom[]> = {
  "Junior Suite": [
    { key: "junior-living", name: "Living room" },
    { key: "junior-bedroom", name: "Bedroom" },
    { key: "junior-bathroom", name: "Bathroom" },
  ],
  "Deluxe Suite": [
    { key: "deluxe-living", name: "Living and dining" },
    { key: "deluxe-bedroom", name: "Bedroom" },
    { key: "deluxe-bathroom", name: "Bathroom" },
  ],
  "Family Suite": [
    { key: "family-living", name: "Living room" },
    { key: "family-bedroom", name: "Main bedroom" },
    { key: "family-bedroom-2", name: "Second bedroom" },
    { key: "family-bathroom", name: "Bathroom" },
  ],
  "Suite with Terrace": [
    { key: "terrace-living", name: "Living room" },
    { key: "terrace-bedroom", name: "Bedroom" },
    { key: "terrace-bathroom", name: "Bathroom" },
    { key: "terrace-terrace", name: "Private terrace" },
  ],
};

export const panoramaUrl = (key: string) => `/360/${key}.jpg`;
export const panoramaThumbUrl = (key: string) => `/360/${key}-thumb.jpg`;

export const getTour360 = (roomTypeName: string | null | undefined): TourRoom[] | null =>
  (roomTypeName && TOURS_360[roomTypeName.trim()]) || null;
