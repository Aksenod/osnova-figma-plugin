/**
 * Font size mapping: px → Tailwind class
 */
export const FONT_SIZE_MAP: Record<number, string> = {
  12: 'text-xs',
  14: 'text-sm',
  16: 'text-base',
  18: 'text-lg',
  20: 'text-xl',
  24: 'text-2xl',
  30: 'text-3xl',
  36: 'text-4xl',
  48: 'text-5xl',
  60: 'text-6xl',
  72: 'text-7xl',
  96: 'text-8xl',
  128: 'text-9xl',
};

/**
 * Font weight mapping: Figma numeric → Tailwind class
 */
export const FONT_WEIGHT_MAP: Record<number, string> = {
  100: 'font-thin',
  200: 'font-extralight',
  300: 'font-light',
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
  800: 'font-extrabold',
  900: 'font-black',
};

/**
 * Line-height mapping: значение → Tailwind class
 * Здесь ключ — lineHeight / fontSize (ratio)
 */
export const LINE_HEIGHT_MAP: Record<string, string> = {
  '1': 'leading-none',
  '1.25': 'leading-tight',
  '1.375': 'leading-snug',
  '1.5': 'leading-normal',
  '1.625': 'leading-relaxed',
  '2': 'leading-loose',
};

/**
 * Абсолютные line-height значения в px
 */
export const LINE_HEIGHT_PX_MAP: Record<number, string> = {
  12: 'leading-3',
  16: 'leading-4',
  20: 'leading-5',
  24: 'leading-6',
  28: 'leading-7',
  32: 'leading-8',
  36: 'leading-9',
  40: 'leading-10',
};

/**
 * Letter spacing mapping: em → Tailwind class
 */
export const LETTER_SPACING_MAP: Record<string, string> = {
  '-0.05': 'tracking-tighter',
  '-0.025': 'tracking-tight',
  '0': 'tracking-normal',
  '0.025': 'tracking-wide',
  '0.05': 'tracking-wider',
  '0.1': 'tracking-widest',
};

/**
 * Border radius mapping: px → Tailwind class
 */
export const BORDER_RADIUS_MAP: Record<number, string> = {
  0: 'rounded-none',
  2: 'rounded-sm',
  4: 'rounded',
  6: 'rounded-md',
  8: 'rounded-lg',
  12: 'rounded-xl',
  16: 'rounded-2xl',
  24: 'rounded-3xl',
  9999: 'rounded-full',
};

// ─── Маппинг-функции ───

export function mapFontSize(px: number): string {
  if (FONT_SIZE_MAP[px]) return FONT_SIZE_MAP[px];
  return `text-[${px}px]`;
}

export function mapFontWeight(weight: number): string {
  if (FONT_WEIGHT_MAP[weight]) return FONT_WEIGHT_MAP[weight];
  // Ближайший
  const keys = Object.keys(FONT_WEIGHT_MAP).map(Number);
  const closest = keys.reduce((a, b) =>
    Math.abs(b - weight) < Math.abs(a - weight) ? b : a
  );
  return FONT_WEIGHT_MAP[closest];
}

export function mapLineHeight(
  lineHeightPx: number | null,
  fontSizePx: number
): string {
  if (lineHeightPx === null || lineHeightPx <= 0) return '';

  // Проверка абсолютных значений
  const rounded = Math.round(lineHeightPx);
  if (LINE_HEIGHT_PX_MAP[rounded]) return LINE_HEIGHT_PX_MAP[rounded];

  // Проверка ratio
  const ratio = lineHeightPx / fontSizePx;
  const ratioStr = ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  if (LINE_HEIGHT_MAP[ratioStr]) return LINE_HEIGHT_MAP[ratioStr];

  return `leading-[${rounded}px]`;
}

export function mapLetterSpacing(
  letterSpacingPx: number | null,
  fontSizePx: number
): string {
  if (letterSpacingPx === null || letterSpacingPx === 0) return '';

  const em = letterSpacingPx / fontSizePx;
  const emStr = em.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');

  if (LETTER_SPACING_MAP[emStr]) return LETTER_SPACING_MAP[emStr];

  return `tracking-[${letterSpacingPx.toFixed(1)}px]`;
}

export function mapBorderRadius(values: {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = values;

  // Все одинаковые
  if (
    topLeft === topRight &&
    topRight === bottomRight &&
    bottomRight === bottomLeft
  ) {
    const r = topLeft;
    if (BORDER_RADIUS_MAP[r] !== undefined) return BORDER_RADIUS_MAP[r];
    return `rounded-[${r}px]`;
  }

  // Разные углы
  const mapSingle = (v: number): string => {
    if (BORDER_RADIUS_MAP[v] !== undefined) {
      const cls = BORDER_RADIUS_MAP[v];
      return cls.replace('rounded-', '');
    }
    return `[${v}px]`;
  };

  return [
    `rounded-tl-${mapSingle(topLeft)}`,
    `rounded-tr-${mapSingle(topRight)}`,
    `rounded-br-${mapSingle(bottomRight)}`,
    `rounded-bl-${mapSingle(bottomLeft)}`,
  ].join(' ');
}
