// Accepted USD amounts are decimal strings. BigInt preserves exact cents.
export function amount(value: unknown, name = 'amount'): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,8})(\.[0-9]{1,2})?$/.test(value)) {
    throw new Error(
      `${name} must be a nonnegative USD decimal string with at most 2 decimals (max 999999999.99)`,
    );
  }
  return value;
}

export function cents(value: unknown, name = 'amount'): bigint {
  const [whole, fraction = ''] = amount(value, name).split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function money(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
