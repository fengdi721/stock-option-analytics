export function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function keys(value: Record<string, unknown>, expected: readonly string[], name: string): void {
  if (
    Object.keys(value).some(key => !expected.includes(key)) ||
    expected.some(key => !Object.hasOwn(value, key))
  ) {
    throw new Error(`${name} must contain exactly: ${expected.join(', ')}`);
  }
}

export function boundedInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
}
