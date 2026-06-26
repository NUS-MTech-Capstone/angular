/**
 * Human-readable change request ticket label derived from the UUID primary key.
 * Uses the last 8 hex digits so sequential demo UUIDs and random v4 UUIDs stay distinct.
 */
export function formatChangeRequestNumber(id: string): string {
  const compact = id.replace(/-/g, '').toUpperCase();
  return `CR-${compact.slice(-8)}`;
}
