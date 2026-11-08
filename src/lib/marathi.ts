/** Devanagari numerals and date formatting, as DGIPR writes them. */

const DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

export function toDevanagariDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => DIGITS[Number(d)])
}

export const MONTHS_MR = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर',
]

export const WEEKDAYS_MR = [
  'रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार',
]

/** A YYYY-MM-DD calendar date or a full ISO instant, read as a date in India. */
function parse(date: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }
  // Shift the instant to IST, then read the UTC fields as IST wall time.
  return new Date(new Date(date).getTime() + 5.5 * 3_600_000)
}

/** "१५ ऑक्टोबर २०२६" */
export function dateMr(date: string): string {
  const dt = parse(date)
  return `${toDevanagariDigits(dt.getUTCDate())} ${MONTHS_MR[dt.getUTCMonth()]} ${toDevanagariDigits(dt.getUTCFullYear())}`
}

/** "गुरुवार, १५ ऑक्टोबर २०२६" */
export function dateWithWeekdayMr(date: string): string {
  const dt = parse(date)
  return `${WEEKDAYS_MR[dt.getUTCDay()]}, ${dateMr(date)}`
}

/** "ऑक्टोबर २०२६" */
export function monthYearMr(date: string): string {
  const dt = parse(date)
  return `${MONTHS_MR[dt.getUTCMonth()]} ${toDevanagariDigits(dt.getUTCFullYear())}`
}

export function todayIso(): string {
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10)
}
