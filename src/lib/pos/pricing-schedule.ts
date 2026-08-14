export function getWeekdaysNumber(weekdays: string | null): number[] {
  if (!weekdays) return [];
  try {
    const parsed = JSON.parse(weekdays);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}