const SINGAPORE_TIME_ZONE = "Asia/Singapore";

export function getSingaporeNow(): Date {
  return new Date();
}

export function formatSingaporeDate(
  value: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date supplied for Singapore formatting");
  }

  return new Intl.DateTimeFormat("en-SG", {
    ...options,
    timeZone: SINGAPORE_TIME_ZONE,
  }).format(date);
}
