const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export const formatDate = (value) => dateFormat.format(new Date(value));
export const formatDateTime = (value) => dateTimeFormat.format(new Date(value));
export const isPast = (value) => new Date(value) < new Date();

export const roleLabels = { student: 'Student', lecturer: 'Lecturer', admin: 'Admin' };

// The value for <input type="datetime-local">, which uses local time with no timezone.
export function toLocalInput(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

// The API needs a timezone on dates, and toISOString always includes one.
export const fromLocalInput = (value) => new Date(value).toISOString();
