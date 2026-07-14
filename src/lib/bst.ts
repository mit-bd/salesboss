// Bangladesh Standard Time (Asia/Dhaka, UTC+6, no DST) formatting helpers.
// All workspace panels format timestamps through these so display is consistent.

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function parse(input?: string | Date | null): Date | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export function formatBSTDate(input?: string | Date | null): string {
  const d = parse(input);
  return d ? DATE_FMT.format(d) : "—";
}

export function formatBSTTime(input?: string | Date | null): string {
  const d = parse(input);
  return d ? TIME_FMT.format(d) : "—";
}

export function formatBSTDateTime(input?: string | Date | null): string {
  const d = parse(input);
  return d ? DATETIME_FMT.format(d) : "—";
}

export function daysBetween(a?: string | Date | null, b: Date = new Date()): number | null {
  const da = parse(a);
  if (!da) return null;
  const ms = b.getTime() - da.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
