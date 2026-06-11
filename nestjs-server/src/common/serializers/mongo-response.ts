type MongoDoc = Record<string, unknown> & { id?: string };

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

function isObjectIdField(key: string, value: unknown): boolean {
  if (typeof value !== 'string' || !OBJECT_ID_RE.test(value)) return false;
  return (
    key === '_id'
    || key.endsWith('Id')
    || key === 'approvedBy'
    || key === 'createdBy'
    || key === 'reviewedBy'
    || key === 'userId'
  );
}

function serializeValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((item, index) => serializeValue(String(index), item));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('id' in record && typeof record.id === 'string' && !('_id' in record)) {
      const { id, ...rest } = record;
      return serializeValue(key, { _id: id, ...rest });
    }
    return Object.fromEntries(
      Object.entries(record).map(([childKey, childValue]) => [
        childKey,
        serializeValue(childKey, childValue),
      ]),
    );
  }
  if (isObjectIdField(key, value)) return value;
  return value;
}

export function toMongoShape<T extends MongoDoc | null | undefined>(doc: T): T {
  if (!doc) return doc;
  const { id, ...rest } = doc;
  const shaped = { _id: id, ...rest } as Record<string, unknown>;
  return serializeValue('_id', shaped) as T;
}

export function toMongoList<T extends MongoDoc>(docs: T[]): T[] {
  return docs.map((doc) => toMongoShape(doc) as T);
}
