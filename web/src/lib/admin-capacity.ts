// Shared between the server action (enforcement) and the client UI
// (disabling the add-admin form once an org is full) so the two can't
// drift apart on what the cap actually is.
export const MAX_ADMINS_PER_ORG = 6;
