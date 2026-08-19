// Shared between the server actions (enforcement) and the client UI
// (disabling full halls in the dropdown before a submit round-trip) so the
// two can't drift apart on what the cap actually is.
export const MAX_INVIGILATORS_PER_HALL = 2;
