import { addDays, parseDate } from "./dates";

// Working days in [depart, return] inclusive, minus weekends and company
// holidays. This is the auto-suggested PTO cost of a trip; the stored value
// stays user-editable.
export function suggestPtoDays(
  departDate: string,
  returnDate: string,
  companyHolidays: string[],
): number {
  const holidays = new Set(companyHolidays);
  let d = parseDate(departDate);
  const end = parseDate(returnDate);
  let count = 0;
  while (d.getTime() <= end.getTime()) {
    const dow = d.getDay();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) count++;
    d = addDays(d, 1);
  }
  return count;
}
