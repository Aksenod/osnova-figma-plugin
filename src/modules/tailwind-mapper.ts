import { mapSpacing } from '../data/tailwind-spacing';
import {
  mapFontSize,
  mapFontWeight,
  mapLineHeight,
  mapLetterSpacing,
  mapBorderRadius,
} from '../data/tailwind-typography';
import { mapColor, rgbaToHex } from '../data/tailwind-colors';
import type {
  TypographyInfo,
  ColorInfo,
  FillInfo,
  SpacingInfo,
  BorderRadiusInfo,
  StrokeInfo,
  LayoutInfo,
} from '../types';

// ─── Color + opacity helper (CDN-compatible) ───

/**
 * Build Tailwind color class with opacity.
 * Named colors: bg-blue-500/80 (modifier works with CDN)
 * Arbitrary hex: bg-[rgba(255,0,0,0.8)] (CDN не поддерживает bg-[#hex]/opacity)
 */
function colorClassWithOpacity(
  hex: string,
  opacity: number,
  prefix: 'bg' | 'text' | 'border' | 'ring' | 'from' | 'via' | 'to'
): { tailwindClass: string; isExact: boolean } {
  const matched = mapColor(hex, prefix);

  if (opacity >= 1 || opacity <= 0) {
    return matched;
  }

  // Named Tailwind color → /opacity modifier works fine with CDN
  if (!matched.tailwindClass.includes('[#')) {
    return {
      tailwindClass: `${matched.tailwindClass}/${Math.round(opacity * 100)}`,
      isExact: matched.isExact,
    };
  }

  // Arbitrary hex → use rgba() for CDN compatibility
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const a = +(opacity).toFixed(2);

  return {
    tailwindClass: `${prefix}-[rgba(${r},${g},${b},${a})]`,
    isExact: false,
  };
}

// ─── Типографика ───

export function mapTypography(node: TextNode): TypographyInfo {
  const fontSize = (node.fontSize as number) || 16;
  const fontWeight = (node.fontWeight as number) || 400;
  const fontFamily =
    typeof node.fontName === 'object' && 'family' in node.fontName
      ? node.fontName.family
      : 'sans-serif';

  let lineHeightPx: number | null = null;
  if (typeof node.lineHeight === 'object' && 'value' in node.lineHeight) {
    if (node.lineHeight.unit === 'PIXELS') {
      lineHeightPx = node.lineHeight.value;
    } else if (node.lineHeight.unit === 'PERCENT') {
      lineHeightPx = (node.lineHeight.value / 100) * fontSize;
    }
  }

  let letterSpacingPx: number | null = null;
  if (typeof node.letterSpacing === 'object' && 'value' in node.letterSpacing) {
    if (node.letterSpacing.unit === 'PIXELS') {
      letterSpacingPx = node.letterSpacing.value;
    } else if (node.letterSpacing.unit === 'PERCENT') {
      letterSpacingPx = (node.letterSpacing.value / 100) * fontSize;
    }
  }

  const textAlignMap: Record<string, string> = {
    LEFT: 'text-left',
    CENTER: 'text-center',
    RIGHT: 'text-right',
    JUSTIFIED: 'text-justify',
  };
  const textAlignH = textAlignMap[node.textAlignHorizontal] || '';

  const fontWeightName = getFontWeightName(fontWeight);
  const lhStr = lineHeightPx ? `/${Math.round(lineHeightPx)}` : '';
  const rawDescription = `${fontFamily} ${fontSize}${lhStr} ${fontWeightName}`;

  const classes = [
    mapFontSize(fontSize),
    mapFontWeight(fontWeight),
    mapLineHeight(lineHeightPx, fontSize),
    mapLetterSpacing(letterSpacingPx, fontSize),
    textAlignH,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight: lineHeightPx,
    letterSpacing: letterSpacingPx,
    textAlignH,
    tailwindClasses: classes,
    rawDescription,
  };
}

function getFontWeightName(w: number): string {
  const names: Record<number, string> = {
    100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
  };
  return names[w] || `w${w}`;
}

// ─── Fills ───

export function mapFills(node: SceneNode & MinimalFillsMixin): FillInfo[] {
  const fills = node.fills;
  if (!Array.isArray(fills)) return [];

  return fills
    .filter((f) => f.visible !== false)
    .map((fill): FillInfo => {
      if (fill.type === 'SOLID') {
        const hex = rgbaToHex(fill.color.r, fill.color.g, fill.color.b);
        const opacity = fill.opacity ?? 1;
        const resolved = colorClassWithOpacity(hex, opacity, 'bg');
        return {
          type: 'solid',
          color: {
            hex,
            opacity,
            tailwindClass: resolved.tailwindClass,
            isExact: resolved.isExact,
          },
        };
      }

      if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL' ||
          fill.type === 'GRADIENT_ANGULAR' || fill.type === 'GRADIENT_DIAMOND') {
        return mapGradientFill(fill);
      }

      if (fill.type === 'IMAGE') {
        return {
          type: 'image',
          description: 'background image',
        };
      }

      return { type: 'solid', description: 'unknown fill' };
    });
}

// ─── Text color ───

export function mapTextColor(node: TextNode): ColorInfo | null {
  const fills = node.fills;
  if (!Array.isArray(fills) || fills.length === 0) return null;

  const solidFill = fills.find(
    (f) => f.type === 'SOLID' && f.visible !== false
  );
  if (!solidFill || solidFill.type !== 'SOLID') return null;

  const hex = rgbaToHex(solidFill.color.r, solidFill.color.g, solidFill.color.b);
  const opacity = solidFill.opacity ?? 1;
  const resolved = colorClassWithOpacity(hex, opacity, 'text');

  return {
    hex,
    opacity,
    tailwindClass: resolved.tailwindClass,
    isExact: resolved.isExact,
  };
}

// ─── Strokes ───

export function mapStrokes(node: SceneNode & MinimalStrokesMixin): StrokeInfo[] {
  const strokes = node.strokes;
  if (!Array.isArray(strokes)) return [];

  return strokes
    .filter((s) => s.visible !== false && s.type === 'SOLID')
    .map((stroke): StrokeInfo => {
      const hex = rgbaToHex(
        (stroke as SolidPaint).color.r,
        (stroke as SolidPaint).color.g,
        (stroke as SolidPaint).color.b
      );
      const strokeOpacity = stroke.opacity ?? 1;
      const resolved = colorClassWithOpacity(hex, strokeOpacity, 'border');
      const weight = ('strokeWeight' in node && typeof node.strokeWeight === 'number')
        ? node.strokeWeight
        : 1;

      let widthClass = '';
      if (weight === 0) widthClass = 'border-0';
      else if (weight === 1) widthClass = 'border';
      else if (weight === 2) widthClass = 'border-2';
      else if (weight === 4) widthClass = 'border-4';
      else if (weight === 8) widthClass = 'border-8';
      else widthClass = `border-[${weight}px]`;

      return {
        color: {
          hex,
          opacity: strokeOpacity,
          tailwindClass: resolved.tailwindClass,
          isExact: resolved.isExact,
        },
        weight,
        tailwindClasses: `${widthClass} ${resolved.tailwindClass}`,
      };
    });
}

// ─── Padding ───

export function mapPadding(node: FrameNode | ComponentNode | InstanceNode): SpacingInfo | null {
  if (!('paddingTop' in node)) return null;

  const top = node.paddingTop ?? 0;
  const right = node.paddingRight ?? 0;
  const bottom = node.paddingBottom ?? 0;
  const left = node.paddingLeft ?? 0;

  if (top === 0 && right === 0 && bottom === 0 && left === 0) {
    return { top, right, bottom, left, tailwindClasses: '' };
  }

  let tailwindClasses: string;

  if (top === bottom && left === right && top === left) {
    tailwindClasses = `p-${mapSpacing(top).value}`;
  } else if (top === bottom && left === right) {
    const py = mapSpacing(top).value;
    const px = mapSpacing(left).value;
    tailwindClasses = `px-${px} py-${py}`;
  } else {
    const parts: string[] = [];
    if (top > 0) parts.push(`pt-${mapSpacing(top).value}`);
    if (right > 0) parts.push(`pr-${mapSpacing(right).value}`);
    if (bottom > 0) parts.push(`pb-${mapSpacing(bottom).value}`);
    if (left > 0) parts.push(`pl-${mapSpacing(left).value}`);
    tailwindClasses = parts.join(' ');
  }

  return { top, right, bottom, left, tailwindClasses };
}

// ─── Border radius ───

export function mapNodeBorderRadius(node: SceneNode): BorderRadiusInfo | null {
  if (!('cornerRadius' in node)) return null;

  let topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0;

  if ('topLeftRadius' in node) {
    topLeft = (node as any).topLeftRadius ?? 0;
    topRight = (node as any).topRightRadius ?? 0;
    bottomRight = (node as any).bottomRightRadius ?? 0;
    bottomLeft = (node as any).bottomLeftRadius ?? 0;
  } else if (typeof (node as any).cornerRadius === 'number') {
    const r = (node as any).cornerRadius;
    topLeft = topRight = bottomRight = bottomLeft = r;
  }

  if (topLeft === 0 && topRight === 0 && bottomRight === 0 && bottomLeft === 0) {
    return null;
  }

  return {
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
    tailwindClass: mapBorderRadius({ topLeft, topRight, bottomRight, bottomLeft }),
  };
}

// ─── Layout (Auto Layout) ───

export function mapAutoLayout(node: FrameNode | ComponentNode | InstanceNode): LayoutInfo {
  if (node.layoutMode === 'NONE' || !node.layoutMode) {
    return { direction: '', gap: '', counterAxisGap: '', wrap: '', paddingClasses: '', alignItems: '', justifyContent: '' };
  }

  // ─── CSS Grid ───
  if (node.layoutMode === 'GRID') {
    const f = node as any;
    const cols: number = f.gridColumnCount || 0;
    const colGap: number = f.gridColumnGap || 0;
    const rowGap: number = f.gridRowGap || 0;

    // Resolve auto tracks → fr proportions from actual child sizes
    const resolved = resolveGridTracks(node as FrameNode);

    // Column classes
    const allOneFr = resolved.columns.length > 0 && resolved.columns.every(
      t => t.type === 'FLEX' && (!t.value || t.value === 1)
    );

    let direction: string;
    if (resolved.columns.length === 0 || allOneFr) {
      direction = `grid grid-cols-${cols}`;
    } else {
      const colParts = resolved.columns.map(t => {
        if (t.type === 'FLEX') return t.value ? `${t.value}fr` : '1fr';
        if (t.type === 'FIXED') return `${Math.round(t.value || 0)}px`;
        return 'auto';
      });
      direction = `grid grid-cols-[${colParts.join('_')}]`;
    }

    // Row classes
    const rows: number = f.gridRowCount || 0;
    const allAutoRows = resolved.rows.length === 0 || resolved.rows.every(t => t.type === 'HUG');
    const allOneFrRows = resolved.rows.length > 0 && resolved.rows.every(
      t => t.type === 'FLEX' && (!t.value || t.value === 1)
    );

    if (!allAutoRows) {
      if (allOneFrRows) {
        direction += ` grid-rows-${rows}`;
      } else {
        const rowParts = resolved.rows.map(t => {
          if (t.type === 'FLEX') return t.value ? `${t.value}fr` : '1fr';
          if (t.type === 'FIXED') return `${Math.round(t.value || 0)}px`;
          return 'auto';
        });
        direction += ` grid-rows-[${rowParts.join('_')}]`;
      }
    }

    // Gaps
    let gap = '';
    if (colGap > 0 && colGap === rowGap) {
      gap = `gap-${mapSpacing(colGap).value}`;
    } else {
      const parts: string[] = [];
      if (colGap > 0) parts.push(`gap-x-${mapSpacing(colGap).value}`);
      if (rowGap > 0) parts.push(`gap-y-${mapSpacing(rowGap).value}`);
      gap = parts.join(' ');
    }

    const padding = mapPadding(node);
    const paddingClasses = padding?.tailwindClasses || '';

    return { direction, gap, counterAxisGap: '', wrap: '', paddingClasses, alignItems: '', justifyContent: '' };
  }

  // ─── Flexbox ───
  const direction = node.layoutMode === 'HORIZONTAL' ? 'flex flex-row' : 'flex flex-col';
  const isWrap = 'layoutWrap' in node && (node as any).layoutWrap === 'WRAP';
  const wrap = isWrap ? 'flex-wrap' : '';

  const gap = node.itemSpacing > 0 ? `gap-${mapSpacing(node.itemSpacing).value}` : '';

  // Counter-axis gap (row-gap for horizontal wrap, column-gap for vertical wrap)
  let counterAxisGap = '';
  if (isWrap && 'counterAxisSpacing' in node) {
    const crossGap = (node as any).counterAxisSpacing as number;
    if (crossGap > 0) {
      const axis = node.layoutMode === 'HORIZONTAL' ? 'y' : 'x';
      counterAxisGap = `gap-${axis}-${mapSpacing(crossGap).value}`;
    }
  }

  const padding = mapPadding(node);
  const paddingClasses = padding?.tailwindClasses || '';

  // Primary axis alignment (justify)
  const justifyMap: Record<string, string> = {
    MIN: 'justify-start',
    CENTER: 'justify-center',
    MAX: 'justify-end',
    SPACE_BETWEEN: 'justify-between',
  };
  const justifyContent = justifyMap[node.primaryAxisAlignItems] || '';

  // Counter axis alignment (items)
  const alignMap: Record<string, string> = {
    MIN: 'items-start',
    CENTER: 'items-center',
    MAX: 'items-end',
    BASELINE: 'items-baseline',
  };
  const alignItems = alignMap[node.counterAxisAlignItems] || '';

  return { direction, gap, counterAxisGap, wrap, paddingClasses, alignItems, justifyContent };
}

// ─── Gradient fills ───

function mapGradientFill(fill: Paint): FillInfo {
  const gradType = fill.type.replace('GRADIENT_', '').toLowerCase();
  const stops = (fill as any).gradientStops as Array<{position: number; color: RGBA}> || [];

  // Compute angle for linear gradients from the 2x3 gradient transform matrix
  let angle: number | null = null;
  if (fill.type === 'GRADIENT_LINEAR' && 'gradientTransform' in fill) {
    const transform = (fill as any).gradientTransform as [[number, number, number], [number, number, number]];
    if (transform) {
      // Direction vector = first column of the matrix
      const dx = transform[0][0];
      const dy = transform[1][0];
      // CSS angle convention: 0deg = to top, 90deg = to right
      angle = Math.round(Math.atan2(dx, -dy) * 180 / Math.PI);
      if (angle < 0) angle += 360;
    }
  }

  // Build description with stops and hex colors
  const stopsDesc = stops.map(s => {
    const hex = rgbaToHex(s.color.r, s.color.g, s.color.b);
    const opacity = s.color.a < 1 ? ` ${Math.round(s.color.a * 100)}%` : '';
    return `${hex}${opacity} at ${Math.round(s.position * 100)}%`;
  }).join(', ');

  let description = `${gradType} gradient`;
  if (angle !== null) description += ` ${angle}deg`;
  if (stopsDesc) description += `: ${stopsDesc}`;

  // Generate Tailwind gradient classes for linear gradients
  let gradientClasses: string | undefined;
  if (fill.type === 'GRADIENT_LINEAR' && angle !== null && stops.length >= 2) {
    gradientClasses = buildTailwindGradient(angle, stops);
  }

  return {
    type: 'gradient',
    description,
    gradientClasses,
  };
}

/**
 * Map CSS angle to Tailwind gradient direction class.
 * Tolerance: ±15 degrees from standard directions.
 */
function angleToGradientDirection(angle: number): string | null {
  const directions: Array<[number, string]> = [
    [0, 'bg-gradient-to-t'],
    [45, 'bg-gradient-to-tr'],
    [90, 'bg-gradient-to-r'],
    [135, 'bg-gradient-to-br'],
    [180, 'bg-gradient-to-b'],
    [225, 'bg-gradient-to-bl'],
    [270, 'bg-gradient-to-l'],
    [315, 'bg-gradient-to-tl'],
  ];

  for (const [deg, cls] of directions) {
    let diff = Math.abs(angle - deg);
    if (diff > 180) diff = 360 - diff;
    if (diff <= 15) return cls;
  }
  return null;
}

/**
 * Build Tailwind gradient classes from angle and stops.
 */
function buildTailwindGradient(
  angle: number,
  stops: Array<{position: number; color: RGBA}>
): string {
  // Direction class
  const dirClass = angleToGradientDirection(angle);
  if (!dirClass) {
    // Non-standard angle — no clean Tailwind mapping, skip classes
    return '';
  }

  const parts: string[] = [dirClass];

  // First stop → from-{color}
  const firstHex = rgbaToHex(stops[0].color.r, stops[0].color.g, stops[0].color.b);
  const firstOpacity = stops[0].color.a ?? 1;
  parts.push(colorClassWithOpacity(firstHex, firstOpacity, 'from').tailwindClass);

  // Middle stop(s) → via-{color} (only for 3 stops)
  if (stops.length === 3) {
    const midHex = rgbaToHex(stops[1].color.r, stops[1].color.g, stops[1].color.b);
    const midOpacity = stops[1].color.a ?? 1;
    parts.push(colorClassWithOpacity(midHex, midOpacity, 'via').tailwindClass);
  }

  // Last stop → to-{color}
  const lastStop = stops[stops.length - 1];
  const lastHex = rgbaToHex(lastStop.color.r, lastStop.color.g, lastStop.color.b);
  const lastOpacity = lastStop.color.a ?? 1;
  parts.push(colorClassWithOpacity(lastHex, lastOpacity, 'to').tailwindClass);

  return parts.join(' ');
}

// ─── Effects (shadows, blur) ───

export function mapEffects(node: SceneNode): { tailwindClasses: string; description: string } {
  if (!('effects' in node)) return { tailwindClasses: '', description: '' };

  const effects = (node as any).effects as ReadonlyArray<Effect>;
  if (!effects || effects.length === 0) return { tailwindClasses: '', description: '' };

  const twParts: string[] = [];
  const descParts: string[] = [];

  for (const effect of effects) {
    if ('visible' in effect && effect.visible === false) continue;

    if (effect.type === 'DROP_SHADOW') {
      const s = effect as DropShadowEffect;
      const x = Math.round(s.offset.x);
      const y = Math.round(s.offset.y);
      const blur = Math.round(s.radius);
      const spread = Math.round(s.spread || 0);
      const r = Math.round(s.color.r * 255);
      const g = Math.round(s.color.g * 255);
      const b = Math.round(s.color.b * 255);
      const a = +(s.color.a).toFixed(2);

      // Tailwind: попробуем стандартные классы, иначе arbitrary
      const twClass = matchShadowClass(y, blur, spread, a);
      twParts.push(twClass);
      descParts.push(`drop-shadow: ${x}px ${y}px ${blur}px ${spread}px rgba(${r},${g},${b},${a})`);
    }

    if (effect.type === 'INNER_SHADOW') {
      const s = effect as InnerShadowEffect;
      const x = Math.round(s.offset.x);
      const y = Math.round(s.offset.y);
      const blur = Math.round(s.radius);
      const spread = Math.round(s.spread || 0);
      const r = Math.round(s.color.r * 255);
      const g = Math.round(s.color.g * 255);
      const b = Math.round(s.color.b * 255);
      const a = +(s.color.a).toFixed(2);

      twParts.push('shadow-inner');
      descParts.push(`inner-shadow: ${x}px ${y}px ${blur}px ${spread}px rgba(${r},${g},${b},${a})`);
    }

    if (effect.type === 'LAYER_BLUR') {
      const blur = Math.round((effect as BlurEffect).radius);
      const twClass = matchBlurClass(blur);
      twParts.push(twClass);
      descParts.push(`blur: ${blur}px`);
    }

    if (effect.type === 'BACKGROUND_BLUR') {
      const blur = Math.round((effect as BlurEffect).radius);
      const twClass = matchBackdropBlurClass(blur);
      twParts.push(twClass);
      descParts.push(`backdrop-blur: ${blur}px`);
    }
  }

  return {
    tailwindClasses: twParts.join(' '),
    description: descParts.join('; '),
  };
}

function matchShadowClass(y: number, blur: number, spread: number, alpha: number): string {
  // Стандартные Tailwind shadow
  if (y === 1 && blur <= 2 && spread === 0) return 'shadow-sm';
  if (y === 1 && blur <= 3) return 'shadow';
  if (y === 4 && blur <= 6) return 'shadow-md';
  if (y === 10 && blur <= 15) return 'shadow-lg';
  if (y === 20 && blur <= 25) return 'shadow-xl';
  if (y === 25 && blur <= 50) return 'shadow-2xl';
  // Arbitrary
  return `shadow-[0_${y}px_${blur}px_${spread}px_rgba(0,0,0,${alpha})]`;
}

function matchBlurClass(radius: number): string {
  if (radius === 0) return 'blur-none';
  if (radius <= 4) return 'blur-sm';
  if (radius <= 8) return 'blur';
  if (radius <= 12) return 'blur-md';
  if (radius <= 16) return 'blur-lg';
  if (radius <= 24) return 'blur-xl';
  if (radius <= 40) return 'blur-2xl';
  if (radius <= 64) return 'blur-3xl';
  return `blur-[${radius}px]`;
}

function matchBackdropBlurClass(radius: number): string {
  if (radius === 0) return 'backdrop-blur-none';
  if (radius <= 4) return 'backdrop-blur-sm';
  if (radius <= 8) return 'backdrop-blur';
  if (radius <= 12) return 'backdrop-blur-md';
  if (radius <= 16) return 'backdrop-blur-lg';
  if (radius <= 24) return 'backdrop-blur-xl';
  if (radius <= 40) return 'backdrop-blur-2xl';
  if (radius <= 64) return 'backdrop-blur-3xl';
  return `backdrop-blur-[${radius}px]`;
}

// ─── Grid Track Resolution (auto → fr) ───

type TrackSize = { type: string; value?: number };

/**
 * Для auto-треков (HUG) вычисляет пропорциональные fr из фактических размеров детей.
 * Если все колонки/ряды уже FLEX или FIXED — возвращает как есть.
 */
export function resolveGridTracks(frame: FrameNode): {
  columns: TrackSize[];
  rows: TrackSize[];
} {
  const f = frame as any;
  const colSizes: TrackSize[] = f.gridColumnSizes || [];
  const rowSizes: TrackSize[] = f.gridRowSizes || [];

  const allColsAuto = colSizes.length > 0 && colSizes.every(t => t.type === 'HUG');
  const allRowsAuto = rowSizes.length > 0 && rowSizes.every(t => t.type === 'HUG');

  if (!allColsAuto && !allRowsAuto) {
    return { columns: colSizes, rows: rowSizes };
  }

  // Измеряем фактические размеры детей по трекам
  if (!('children' in frame)) {
    return { columns: colSizes, rows: rowSizes };
  }

  const children = (frame as any).children as SceneNode[];
  const colMaxWidths: number[] = new Array(colSizes.length).fill(0);
  const rowMaxHeights: number[] = new Array(rowSizes.length).fill(0);

  for (const child of children) {
    if ('visible' in child && !child.visible) continue;
    const c = child as any;
    const colIdx: number | undefined = c.gridColumnAnchorIndex;
    const rowIdx: number | undefined = c.gridRowAnchorIndex;
    const colSpan: number = c.gridColumnSpan || 1;
    const rowSpan: number = c.gridRowSpan || 1;

    // Только не-spanning дети для измерения трека
    if (typeof colIdx === 'number' && colSpan === 1 && colIdx < colSizes.length) {
      colMaxWidths[colIdx] = Math.max(colMaxWidths[colIdx], Math.round(child.width));
    }
    if (typeof rowIdx === 'number' && rowSpan === 1 && rowIdx < rowSizes.length) {
      rowMaxHeights[rowIdx] = Math.max(rowMaxHeights[rowIdx], Math.round(child.height));
    }
  }

  const resolvedCols = allColsAuto ? pixelsToFr(colMaxWidths) : colSizes;
  const resolvedRows = allRowsAuto ? pixelsToFr(rowMaxHeights) : rowSizes;

  return { columns: resolvedCols, rows: resolvedRows };
}

/**
 * Конвертирует пиксельные значения в пропорциональные fr.
 * 240, 760 → 1fr, 3fr (делим на наименьший, округляем)
 */
function pixelsToFr(pxValues: number[]): TrackSize[] {
  const nonZero = pxValues.filter(v => v > 0);
  if (nonZero.length === 0) return pxValues.map(() => ({ type: 'HUG' }));

  const min = Math.min(...nonZero);
  return pxValues.map(v => {
    if (v <= 0) return { type: 'FLEX', value: 1 };
    return { type: 'FLEX', value: Math.max(1, Math.round(v / min)) };
  });
}

// ─── Sizing ───

export function mapSizing(node: SceneNode): { h: string; v: string } {
  let h = '';
  let v = '';

  if ('layoutSizingHorizontal' in node) {
    const lsh = (node as any).layoutSizingHorizontal;
    if (lsh === 'FILL') h = 'w-full';
    else if (lsh === 'HUG') h = 'w-auto';
  }

  if ('layoutSizingVertical' in node) {
    const lsv = (node as any).layoutSizingVertical;
    if (lsv === 'FILL') v = 'h-full';
    else if (lsv === 'HUG') v = 'h-auto';
  }

  return { h, v };
}
