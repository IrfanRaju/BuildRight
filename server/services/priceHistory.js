import { PriceHistory } from '../models/index.js';

export async function recordPriceChange({
  entityType,
  entityId,
  field = 'rate',
  previousValue,
  newValue,
  user,
  note = '',
}) {
  if (previousValue === newValue) return null;
  if (!Number.isFinite(Number(newValue))) return null;
  return PriceHistory.create({
    entityType,
    entityId: String(entityId),
    field,
    previousValue: previousValue == null ? null : Number(previousValue),
    newValue: Number(newValue),
    changedBy: user?.id || user?._id || null,
    changedByEmail: user?.email || '',
    note: String(note || '').slice(0, 240),
  });
}
