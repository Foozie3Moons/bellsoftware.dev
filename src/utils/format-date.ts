const SHORT_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const LONG_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatShort(date: Date): string {
  return SHORT_FORMAT.format(date);
}

export function formatLong(date: Date): string {
  return LONG_FORMAT.format(date);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
