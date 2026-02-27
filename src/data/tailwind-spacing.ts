/**
 * Tailwind v4 spacing scale.
 * Ключ — значение в пикселях, значение — Tailwind-класс (без префикса).
 */
export const SPACING_MAP: Record<number, string> = {
  0: '0',
  1: 'px',     // 1px
  2: '0.5',
  4: '1',
  6: '1.5',
  8: '2',
  10: '2.5',
  12: '3',
  14: '3.5',
  16: '4',
  20: '5',
  24: '6',
  28: '7',
  32: '8',
  36: '9',
  40: '10',
  44: '11',
  48: '12',
  56: '14',
  64: '16',
  80: '20',
  96: '24',
  112: '28',
  128: '32',
  144: '36',
  160: '40',
  176: '44',
  192: '48',
  208: '52',
  224: '56',
  240: '60',
  256: '64',
  288: '72',
  320: '80',
  384: '96',
};

/**
 * Найти ближайшее значение Tailwind для заданных пикселей.
 * Если точного совпадения нет, вернёт arbitrary value.
 */
export function mapSpacing(px: number): { value: string; isExact: boolean } {
  if (px === 0) return { value: '0', isExact: true };

  const rounded = Math.round(px);
  if (SPACING_MAP[rounded] !== undefined) {
    return { value: SPACING_MAP[rounded], isExact: true };
  }

  return { value: `[${rounded}px]`, isExact: false };
}

/**
 * Проверить кратность 4px.
 */
export function isMultipleOf4(px: number): boolean {
  return px % 4 === 0 || px === 0;
}
