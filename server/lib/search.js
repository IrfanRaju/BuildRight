export function escapeRegex(value) {
  return String(value || '').trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsRegex(value) {
  const pattern = escapeRegex(value);
  if (!pattern) return null;
  return new RegExp(`(^|[^A-Za-z0-9])${pattern}`, 'i');
}

export function textOr(fields, regex) {
  if (!regex) return null;
  return { $or: fields.map((field) => ({ [field]: regex })) };
}
