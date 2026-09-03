const numberFormats = new Map<number, Intl.NumberFormat>();

/** Keeps learner-facing measurements readable without changing simulation precision. */
export function formatDisplayNumber(value: number, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const digits = Math.max(0, Math.min(3, Math.round(maximumFractionDigits)));
  let formatter = numberFormats.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
      useGrouping: true,
    });
    numberFormats.set(digits, formatter);
  }
  return formatter.format(Math.abs(value) < 1e-12 ? 0 : value);
}

export function formatSignedDisplayNumber(value: number, maximumFractionDigits = 1): string {
  const formatted = formatDisplayNumber(value, maximumFractionDigits);
  return value > 0 ? `+${formatted}` : formatted;
}

/** Describes a continuously changing value without crowding a visual experiment with digits. */
export function qualitativeLevel(
  value: number,
  minimum: number,
  maximum: number,
  labels: readonly [string, string, string] = ["낮음", "보통", "높음"],
): string {
  if (!Number.isFinite(value) || maximum <= minimum) return labels[1];
  const ratio = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  return ratio < 1 / 3 ? labels[0] : ratio < 2 / 3 ? labels[1] : labels[2];
}
