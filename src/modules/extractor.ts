import type { NodeCharacteristics, FillInfo, StrokeInfo, ColorInfo, ChildNodeInfo } from '../types';
import {
  mapTypography,
  mapFills,
  mapTextColor,
  mapStrokes,
  mapPadding,
  mapNodeBorderRadius,
  mapAutoLayout,
  mapSizing,
  mapEffects,
  resolveGridTracks,
} from './tailwind-mapper';
import { mapSpacing } from '../data/tailwind-spacing';

/**
 * Извлечь все характеристики ноды.
 */
export async function extractCharacteristics(
  node: SceneNode
): Promise<NodeCharacteristics> {
  const result: NodeCharacteristics = {
    fills: [],
    strokes: [],
    padding: null,
    borderRadius: null,
    opacity: 'opacity' in node ? (node.opacity ?? 1) : 1,
    width: Math.round(node.width),
    height: Math.round(node.height),
    hasTextStyle: false,
    hasColorVariable: false,
  };

  // Типографика (только для TextNode)
  if (node.type === 'TEXT') {
    // Проверяем что свойства не mixed
    if (typeof node.fontSize === 'number') {
      result.typography = mapTypography(node);
    }

    // Text color
    const textColor = mapTextColor(node);
    if (textColor) {
      result.fills = [{
        type: 'solid',
        color: textColor,
      }];
    }

    // Проверяем Text Style
    await checkTextStyle(node, result);

    // Проверяем Color Variable
    await checkColorVariables(node, result);
  }

  // Fills (для фреймов, прямоугольников, и т.д.)
  if (node.type !== 'TEXT' && 'fills' in node) {
    result.fills = mapFills(node as SceneNode & MinimalFillsMixin);

    // Проверяем Color Variable для fills
    await checkColorVariables(node, result);
  }

  // Strokes
  if ('strokes' in node) {
    result.strokes = mapStrokes(node as SceneNode & MinimalStrokesMixin);
  }

  // Padding (только для контейнеров с Auto Layout)
  if (isLayoutContainer(node)) {
    result.padding = mapPadding(node as FrameNode);
  }

  // Border radius
  result.borderRadius = mapNodeBorderRadius(node);

  return result;
}

function isLayoutContainer(node: SceneNode): boolean {
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE'
  );
}

/**
 * Проверить наличие Text Style.
 */
async function checkTextStyle(
  node: TextNode,
  result: NodeCharacteristics
): Promise<void> {
  try {
    const styleId = node.textStyleId;
    if (typeof styleId === 'string' && styleId !== '') {
      const style = await figma.getStyleByIdAsync(styleId);
      if (style) {
        result.hasTextStyle = true;
        result.textStyleName = style.name;
      }
    }
  } catch {
    // Может быть mixed — игнорируем
  }
}

/**
 * Проверить наличие Color Variables.
 */
async function checkColorVariables(
  node: SceneNode,
  result: NodeCharacteristics
): Promise<void> {
  try {
    if (!('boundVariables' in node)) return;
    const bound = (node as any).boundVariables;
    if (!bound) return;

    // Проверяем fills
    if (bound.fills && Array.isArray(bound.fills)) {
      for (const binding of bound.fills) {
        if (binding?.id) {
          const variable = await figma.variables.getVariableByIdAsync(binding.id);
          if (variable) {
            result.hasColorVariable = true;
            result.colorVariableName = variable.name;
            // Обновляем fills с именем переменной
            if (result.fills.length > 0 && result.fills[0].color) {
              result.fills[0].color.variableName = variable.name;
            }
            break;
          }
        }
      }
    }

    // Проверяем textFill (для текстовых нод)
    if (bound.textFill) {
      // textFill может быть объектом или массивом
      const bindings = Array.isArray(bound.textFill) ? bound.textFill : [bound.textFill];
      for (const binding of bindings) {
        if (binding?.id) {
          const variable = await figma.variables.getVariableByIdAsync(binding.id);
          if (variable) {
            result.hasColorVariable = true;
            result.colorVariableName = variable.name;
            if (result.fills.length > 0 && result.fills[0].color) {
              result.fills[0].color.variableName = variable.name;
            }
            break;
          }
        }
      }
    }
  } catch {
    // Игнорируем ошибки
  }
}

// ─── Рекурсивный обход дочерних элементов ───

const MAX_DEPTH = 10;

/**
 * Собрать полное дерево: сам выбранный элемент + все его дети рекурсивно.
 * Возвращает один ChildNodeInfo (корень) с вложенными children.
 */
export async function extractNodeTree(
  node: SceneNode
): Promise<ChildNodeInfo> {
  return extractSingleChildInfo(node, 0);
}

/**
 * Рекурсивно собрать дерево дочерних элементов с характеристиками.
 */
export async function extractChildrenTree(
  node: SceneNode,
  depth: number = 0
): Promise<ChildNodeInfo[]> {
  if (depth >= MAX_DEPTH) return [];
  if (!('children' in node)) return [];

  const parent = node as SceneNode & ChildrenMixin;
  const visibleChildren: SceneNode[] = [];
  for (const child of parent.children) {
    if ('visible' in child && !child.visible) continue;
    visibleChildren.push(child);
  }

  // Compute grid positions for wrap layouts
  const gridPositions = computeGridPositions(node, visibleChildren);

  const results: ChildNodeInfo[] = [];
  for (const child of visibleChildren) {
    const info = await extractSingleChildInfo(child, depth);
    const gridPos = gridPositions.get(child);
    if (gridPos) {
      info.gridPositionDesc = gridPos;
    }
    results.push(info);
  }

  // ─── Пустые ячейки CSS Grid: вставить placeholder'ы ───
  const frame = node as any;
  if (frame.layoutMode === 'GRID') {
    const cols: number = frame.gridColumnCount || 0;
    const rows: number = frame.gridRowCount || 0;
    if (cols > 0 && rows > 0) {
      // Собираем множество занятых ячеек (ключ "row,col")
      const occupied = new Set<string>();
      for (const child of visibleChildren) {
        const c = child as any;
        const anchorRow = typeof c.gridRowAnchorIndex === 'number' ? c.gridRowAnchorIndex : -1;
        const anchorCol = typeof c.gridColumnAnchorIndex === 'number' ? c.gridColumnAnchorIndex : -1;
        if (anchorRow < 0 || anchorCol < 0) continue;
        const rowSpan: number = c.gridRowSpan || 1;
        const colSpan: number = c.gridColumnSpan || 1;
        for (let r = anchorRow; r < anchorRow + rowSpan; r++) {
          for (let cc = anchorCol; cc < anchorCol + colSpan; cc++) {
            occupied.add(`${r},${cc}`);
          }
        }
      }

      // Для каждой незанятой ячейки создаём placeholder
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (occupied.has(`${r},${c}`)) continue;
          const emptyInfo: ChildNodeInfo = {
            name: '[EMPTY CELL]',
            nodeType: 'EMPTY',
            layoutClasses: '',
            sizingClasses: '',
            styleClasses: '',
            layoutDesc: '',
            positionDesc: '',
            sizeDesc: '',
            typographyDesc: '',
            fillDesc: '',
            radiusDesc: '',
            paddingDesc: '',
            strokeDesc: '',
            overflowDesc: '',
            gridPositionDesc: `grid-area: ${r + 1} / ${c + 1}`,
            effectsDesc: '',
            children: [],
          };
          results.push(emptyInfo);
        }
      }
    }
  }

  return results;
}

async function extractSingleChildInfo(
  node: SceneNode,
  depth: number
): Promise<ChildNodeInfo> {
  // ─── Layout ───
  let layoutClasses = '';
  let layoutDesc = '';
  let overflowDesc = '';

  if (isLayoutContainer(node)) {
    const frame = node as FrameNode;
    const layout = mapAutoLayout(frame);
    const twParts: string[] = [];
    if (layout.direction) twParts.push(layout.direction);
    if (layout.wrap) twParts.push(layout.wrap);
    if (layout.gap) twParts.push(layout.gap);
    if (layout.counterAxisGap) twParts.push(layout.counterAxisGap);
    if (layout.alignItems) twParts.push(layout.alignItems);
    if (layout.justifyContent) twParts.push(layout.justifyContent);
    if (layout.paddingClasses) twParts.push(layout.paddingClasses);
    layoutClasses = twParts.join(' ');

    layoutDesc = buildLayoutDesc(frame);

    // Overflow — явно указываем для обоих случаев, чтобы AI не додумывал
    if ('clipsContent' in frame) {
      if (frame.clipsContent) {
        overflowDesc = 'overflow: hidden';
      } else if ('children' in frame && frame.children.length > 0) {
        overflowDesc = 'overflow: visible (children can extend beyond this frame)';
      }
    }
  }

  // ─── Positioning (absolute only) ───
  let positionDesc = buildPositionDesc(node);

  // z-index для абсолютных элементов (порядок в parent.children)
  if (positionDesc) {
    const parent = node.parent;
    if (parent && 'children' in parent) {
      const siblings = (parent as any).children as SceneNode[];
      const index = siblings.indexOf(node);
      if (index >= 0) {
        positionDesc += `; z-index: ${index + 1}`;
      }
    }
  }

  // ─── Sizing ───
  const sizing = mapSizing(node);
  const sizeParts = [sizing.h, sizing.v].filter(Boolean);

  // Flex-ребёнок больше родителя по main axis → shrink-0
  // В Figma дети не сжимаются, в CSS flex-shrink: 1 по умолчанию
  let sizeOverflowNote = '';
  const parent = node.parent;
  if (parent && 'layoutMode' in parent) {
    const pFrame = parent as FrameNode;
    const isH = pFrame.layoutMode === 'HORIZONTAL';
    const isV = pFrame.layoutMode === 'VERTICAL';

    if (isH || isV) {
      const childMainSize = Math.round(isV ? node.height : node.width);
      const parentMainSize = Math.round(isV ? pFrame.height : pFrame.width);

      if (childMainSize > parentMainSize) {
        sizeParts.push('shrink-0');
        sizeOverflowNote = ' (overflows parent, won\'t shrink)';
      }
    }
  }

  // Min/max constraints
  const minMaxParts = buildMinMaxClasses(node);
  if (minMaxParts.classes) sizeParts.push(minMaxParts.classes);

  const sizingClasses = sizeParts.join(' ');
  const sizeDesc = buildSizeDesc(node) + sizeOverflowNote + minMaxParts.desc;

  // ─── Style classes + descriptions ───
  const styleParts: string[] = [];
  let typographyDesc = '';
  let fillDesc = '';
  let radiusDesc = '';
  let strokeDesc = '';
  let paddingDesc = '';

  // Typography
  let textContent: string | undefined;
  if (node.type === 'TEXT') {
    textContent = node.characters;
    if (typeof node.fontSize === 'number') {
      const typo = mapTypography(node);
      styleParts.push(typo.tailwindClasses);

      const family = typo.fontFamily;
      const size = typo.fontSize;
      const lh = typo.lineHeight ? '/' + Math.round(typo.lineHeight) : '';
      const weightName = weightToName(typo.fontWeight);
      typographyDesc = `${family} ${size}${lh} ${weightName}`;
    }
    const tc = mapTextColor(node);
    if (tc) {
      styleParts.push(tc.tailwindClass);
      const tcOpacity = tc.opacity < 1 ? ` ${Math.round(tc.opacity * 100)}%` : '';
      typographyDesc += `, color ${tc.hex}${tcOpacity}`;
    }
  }

  // Fills
  if (node.type !== 'TEXT' && 'fills' in node) {
    const fills = mapFills(node as SceneNode & MinimalFillsMixin);
    for (const fill of fills) {
      if (fill.type === 'solid' && fill.color) {
        styleParts.push(fill.color.tailwindClass);
        const fillOpacity = fill.color.opacity < 1 ? ` ${Math.round(fill.color.opacity * 100)}%` : '';
        fillDesc = `fill ${fill.color.hex}${fillOpacity}`;
      } else if (fill.type === 'gradient') {
        fillDesc = fill.description || 'gradient';
        if (fill.gradientClasses) {
          styleParts.push(fill.gradientClasses);
        }
      } else if (fill.type === 'image') {
        fillDesc = 'background image';
      }
    }
  }

  // Border radius
  const radius = mapNodeBorderRadius(node);
  if (radius) {
    styleParts.push(radius.tailwindClass);
    const allSame = radius.topLeft === radius.topRight
      && radius.topRight === radius.bottomRight
      && radius.bottomRight === radius.bottomLeft;
    radiusDesc = allSame
      ? `radius ${radius.topLeft}px`
      : `radius ${radius.topLeft} ${radius.topRight} ${radius.bottomRight} ${radius.bottomLeft}`;
  }

  // Strokes
  if ('strokes' in node) {
    const strokes = mapStrokes(node as SceneNode & MinimalStrokesMixin);
    for (const s of strokes) {
      styleParts.push(s.tailwindClasses);
      const sOpacity = s.color.opacity < 1 ? ` ${Math.round(s.color.opacity * 100)}%` : '';
      strokeDesc = `stroke ${s.color.hex}${sOpacity} ${s.weight}px`;
    }
  }

  // Padding
  if (isLayoutContainer(node)) {
    const frame = node as FrameNode;
    const pt = frame.paddingTop || 0;
    const pr = frame.paddingRight || 0;
    const pb = frame.paddingBottom || 0;
    const pl = frame.paddingLeft || 0;
    if (pt > 0 || pr > 0 || pb > 0 || pl > 0) {
      if (pt === pb && pl === pr && pt === pl) {
        paddingDesc = `padding ${pt}`;
      } else if (pt === pb && pl === pr) {
        paddingDesc = `padding ${pt} ${pl}`;
      } else {
        paddingDesc = `padding ${pt} ${pr} ${pb} ${pl}`;
      }
    }
  }

  // Opacity
  if ('opacity' in node && typeof node.opacity === 'number' && node.opacity < 1 && node.opacity > 0) {
    styleParts.push('opacity-' + Math.round(node.opacity * 100));
  }

  // Effects (shadows, blur, backdrop-blur)
  let effectsDesc = '';
  const effects = mapEffects(node);
  if (effects.tailwindClasses) styleParts.push(effects.tailwindClasses);
  effectsDesc = effects.description;

  // Blend mode
  if ('blendMode' in node) {
    const bm = (node as any).blendMode as string;
    if (bm && bm !== 'PASS_THROUGH' && bm !== 'NORMAL') {
      const blendMap: Record<string, string> = {
        MULTIPLY: 'mix-blend-multiply', SCREEN: 'mix-blend-screen',
        OVERLAY: 'mix-blend-overlay', DARKEN: 'mix-blend-darken',
        LIGHTEN: 'mix-blend-lighten', COLOR_DODGE: 'mix-blend-color-dodge',
        COLOR_BURN: 'mix-blend-color-burn', HARD_LIGHT: 'mix-blend-hard-light',
        SOFT_LIGHT: 'mix-blend-soft-light', DIFFERENCE: 'mix-blend-difference',
        EXCLUSION: 'mix-blend-exclusion', HUE: 'mix-blend-hue',
        SATURATION: 'mix-blend-saturation', COLOR: 'mix-blend-color',
        LUMINOSITY: 'mix-blend-luminosity',
      };
      const twBlend = blendMap[bm] || `mix-blend-[${bm.toLowerCase()}]`;
      styleParts.push(twBlend);
      if (effectsDesc) effectsDesc += '; ';
      effectsDesc += `blend: ${bm.toLowerCase()}`;
    }
  }

  // Rotation
  if ('rotation' in node) {
    const rot = (node as any).rotation as number;
    if (rot !== 0 && typeof rot === 'number') {
      const deg = Math.round(rot);
      // Tailwind стандартные: 0, 1, 2, 3, 6, 12, 45, 90, 180
      const twRotMap: Record<number, string> = {
        1: 'rotate-1', 2: 'rotate-2', 3: 'rotate-3', 6: 'rotate-6',
        12: 'rotate-12', 45: 'rotate-45', 90: 'rotate-90', 180: 'rotate-180',
      };
      // Figma хранит как отрицательные для CW (Figma rotation = -CSS rotation)
      const cssDeg = -deg;
      const absDeg = Math.abs(cssDeg);
      let twRot = twRotMap[absDeg] || `rotate-[${absDeg}deg]`;
      if (cssDeg < 0) twRot = '-' + twRot;
      styleParts.push(twRot);
      if (effectsDesc) effectsDesc += '; ';
      effectsDesc += `rotate: ${cssDeg}deg`;
    }
  }

  // Text decoration & text case (для TextNode)
  if (node.type === 'TEXT') {
    const td = (node as any).textDecoration;
    if (td === 'UNDERLINE') {
      styleParts.push('underline');
      typographyDesc += ', underline';
    } else if (td === 'STRIKETHROUGH') {
      styleParts.push('line-through');
      typographyDesc += ', line-through';
    }

    const tc = (node as any).textCase;
    if (tc === 'UPPER') {
      styleParts.push('uppercase');
      typographyDesc += ', uppercase';
    } else if (tc === 'LOWER') {
      styleParts.push('lowercase');
      typographyDesc += ', lowercase';
    } else if (tc === 'TITLE') {
      styleParts.push('capitalize');
      typographyDesc += ', capitalize';
    }

    // Text truncation
    const truncation = (node as any).textTruncation;
    if (truncation === 'ENDING') {
      const maxLines = (node as any).maxLines;
      if (maxLines === 1) {
        styleParts.push('truncate');
        typographyDesc += ', truncate';
      } else if (typeof maxLines === 'number' && maxLines > 1) {
        styleParts.push(`line-clamp-${maxLines}`);
        typographyDesc += `, line-clamp-${maxLines}`;
      }
    }
  }

  // Children (recursion)
  const children = await extractChildrenTree(node, depth + 1);

  return {
    name: node.name,
    nodeType: node.type,
    textContent,
    layoutClasses,
    sizingClasses,
    styleClasses: styleParts.join(' '),
    layoutDesc,
    positionDesc,
    sizeDesc,
    typographyDesc,
    fillDesc,
    radiusDesc,
    paddingDesc,
    strokeDesc,
    overflowDesc,
    effectsDesc,
    gridPositionDesc: '',
    children,
  };
}

// ─── Helpers ───

/**
 * Вычислить grid-позиции (row, col) для детей grid- или wrap-контейнера.
 */
function computeGridPositions(
  parent: SceneNode,
  visibleChildren: SceneNode[]
): Map<SceneNode, string> {
  const result = new Map<SceneNode, string>();
  if (visibleChildren.length === 0) return result;
  if (!('layoutMode' in parent)) return result;

  const frame = parent as FrameNode;

  // ─── CSS Grid: читаем реальные индексы из API ───
  if (frame.layoutMode === 'GRID') {
    // Resolve auto tracks → fr proportions from actual child sizes
    const resolved = resolveGridTracks(frame);

    for (const child of visibleChildren) {
      const c = child as any;
      const row = (typeof c.gridRowAnchorIndex === 'number') ? c.gridRowAnchorIndex + 1 : null;
      const col = (typeof c.gridColumnAnchorIndex === 'number') ? c.gridColumnAnchorIndex + 1 : null;
      if (row === null || col === null) continue;

      const rowSpan: number = c.gridRowSpan || 1;
      const colSpan: number = c.gridColumnSpan || 1;

      // grid-area: row-start / col-start [/ span rows / span cols]
      let gridArea: string;
      if (rowSpan > 1 || colSpan > 1) {
        gridArea = `grid-area: ${row} / ${col} / span ${rowSpan} / span ${colSpan}`;
      } else {
        gridArea = `grid-area: ${row} / ${col}`;
      }

      // Track sizes for this child's position (resolved: auto → computed fr)
      const colTrack = resolved.columns[col - 1] ? formatSingleTrack(resolved.columns[col - 1]) : 'auto';
      const rowTrack = resolved.rows[row - 1] ? formatSingleTrack(resolved.rows[row - 1]) : 'auto';

      result.set(child, `${gridArea}; column track: ${colTrack}; row track: ${rowTrack}`);
    }
    return result;
  }

  // ─── Flex wrap: вычисляем по координатам ───
  if (!('layoutWrap' in parent)) return result;
  if ((frame as any).layoutWrap !== 'WRAP') return result;

  const isHorizontal = frame.layoutMode === 'HORIZONTAL';

  if (isHorizontal) {
    const sorted = [...visibleChildren].sort((a, b) => {
      const dy = Math.round(a.y) - Math.round(b.y);
      if (Math.abs(dy) > 2) return dy;
      return Math.round(a.x) - Math.round(b.x);
    });

    let currentRowY = Math.round(sorted[0].y);
    let rowIndex = 1;
    let colIndex = 1;

    for (const child of sorted) {
      const cy = Math.round(child.y);
      if (Math.abs(cy - currentRowY) > 2) {
        rowIndex++;
        colIndex = 1;
        currentRowY = cy;
      }
      result.set(child, `row ${rowIndex}, col ${colIndex}`);
      colIndex++;
    }
  } else {
    const sorted = [...visibleChildren].sort((a, b) => {
      const dx = Math.round(a.x) - Math.round(b.x);
      if (Math.abs(dx) > 2) return dx;
      return Math.round(a.y) - Math.round(b.y);
    });

    let currentColX = Math.round(sorted[0].x);
    let colIndex = 1;
    let rowIndex = 1;

    for (const child of sorted) {
      const cx = Math.round(child.x);
      if (Math.abs(cx - currentColX) > 2) {
        colIndex++;
        rowIndex = 1;
        currentColX = cx;
      }
      result.set(child, `row ${rowIndex}, col ${colIndex}`);
      rowIndex++;
    }
  }

  return result;
}

/**
 * Определить, является ли элемент абсолютно позиционированным,
 * и если да — вернуть CSS-ready офсеты (top/right/bottom/left).
 */
function buildPositionDesc(node: SceneNode): string {
  const parent = node.parent;
  if (!parent || parent.type === 'PAGE' || parent.type === 'DOCUMENT') return '';

  // Проверяем: родитель — контейнер без Auto Layout → дети абсолютны
  const parentIsAbsolute =
    ('layoutMode' in parent) &&
    ((parent as FrameNode).layoutMode === 'NONE' || !(parent as FrameNode).layoutMode);

  // Или элемент явно исключён из Auto Layout (absoluteRenderBounds)
  const isAbsoluteChild =
    'layoutPositioning' in node &&
    (node as any).layoutPositioning === 'ABSOLUTE';

  if (!parentIsAbsolute && !isAbsoluteChild) return '';

  const x = Math.round(node.x);
  const y = Math.round(node.y);
  const pw = Math.round((parent as SceneNode).width || 0);
  const ph = Math.round((parent as SceneNode).height || 0);
  const nw = Math.round(node.width);
  const nh = Math.round(node.height);

  // CSS offsets
  const top = y;
  const left = x;
  const right = pw - x - nw;
  const bottom = ph - y - nh;

  // Вертикаль: ближайший край
  let vPart: string;
  if (top === 0 && bottom === 0) {
    if (nh < ph) {
      vPart = 'top: 0; bottom: 0 (stretched); centered vertically';
    } else {
      vPart = 'top: 0; bottom: 0 (stretched)';
    }
  } else if (Math.abs(top - bottom) <= 1) {
    vPart = 'centered vertically';
  } else if (Math.abs(top) <= Math.abs(bottom)) {
    vPart = 'top: ' + top + 'px';
  } else {
    vPart = 'bottom: ' + bottom + 'px';
  }

  // Горизонталь: ближайший край
  let hPart: string;
  if (left === 0 && right === 0) {
    if (nw < pw) {
      hPart = 'left: 0; right: 0 (stretched); centered horizontally';
    } else {
      hPart = 'left: 0; right: 0 (stretched)';
    }
  } else if (Math.abs(left - right) <= 1) {
    hPart = 'centered horizontally';
  } else if (Math.abs(left) <= Math.abs(right)) {
    hPart = 'left: ' + left + 'px';
  } else {
    hPart = 'right: ' + right + 'px';
  }

  // Overflow detection
  const overflows = top < 0 || left < 0 || right < 0 || bottom < 0;

  let result = 'absolute; ' + vPart + '; ' + hPart;
  if (overflows) result += ' (overflows parent)';

  return result;
}

function buildLayoutDesc(frame: FrameNode): string {
  if (frame.layoutMode === 'NONE' || !frame.layoutMode) {
    // Нет Auto Layout — абсолютное позиционирование детей
    if ('children' in frame && frame.children.length > 0) {
      return 'no auto layout (children are absolutely positioned)';
    }
    return '';
  }

  // ─── CSS Grid ───
  if (frame.layoutMode === 'GRID') {
    return buildGridLayoutDesc(frame);
  }

  // ─── Flexbox ───
  const parts: string[] = [];
  const isWrap = 'layoutWrap' in frame && (frame as any).layoutWrap === 'WRAP';

  // Direction + wrap
  const dir = frame.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical';
  if (isWrap) {
    parts.push(`Auto Layout: ${dir}, wrap`);
  } else {
    parts.push(`Auto Layout: ${dir}`);
  }

  // Main axis gap
  if (frame.itemSpacing > 0) {
    parts.push(`gap ${frame.itemSpacing}`);
  }

  // Cross axis gap (only for wrap)
  if (isWrap && 'counterAxisSpacing' in frame) {
    const crossGap = (frame as any).counterAxisSpacing as number;
    if (crossGap > 0) {
      const crossLabel = frame.layoutMode === 'HORIZONTAL' ? 'row-gap' : 'column-gap';
      parts.push(`${crossLabel} ${crossGap}`);
    }
  }

  // Align items (counter axis)
  const alignMap: Record<string, string> = {
    MIN: 'start', CENTER: 'center', MAX: 'end', BASELINE: 'baseline',
  };
  if (frame.counterAxisAlignItems && frame.counterAxisAlignItems !== 'MIN') {
    parts.push(`align-items: ${alignMap[frame.counterAxisAlignItems] || frame.counterAxisAlignItems}`);
  }

  // Justify (primary axis)
  const justifyMap: Record<string, string> = {
    MIN: 'start', CENTER: 'center', MAX: 'end', SPACE_BETWEEN: 'space-between',
  };
  if (frame.primaryAxisAlignItems && frame.primaryAxisAlignItems !== 'MIN') {
    parts.push(`justify: ${justifyMap[frame.primaryAxisAlignItems] || frame.primaryAxisAlignItems}`);
  }

  // Counter axis align content (for wrap: how rows/columns are distributed)
  if (isWrap && 'counterAxisAlignContent' in frame) {
    const alignContent = (frame as any).counterAxisAlignContent;
    if (alignContent === 'SPACE_BETWEEN') {
      parts.push('align-content: space-between');
    }
  }

  return parts.join(', ');
}

function buildGridLayoutDesc(frame: FrameNode): string {
  const f = frame as any;
  const cols: number = f.gridColumnCount || 0;
  const rows: number = f.gridRowCount || 0;
  const parts: string[] = [`CSS Grid: ${cols} cols × ${rows} rows`];

  // Resolve auto tracks → fr proportions from actual child sizes
  const resolved = resolveGridTracks(frame);

  // Column sizes — CSS-ready property
  const colDesc = formatTrackSizes(resolved.columns);
  if (colDesc) parts.push(`grid-template-columns: ${colDesc}`);

  // Row sizes — CSS-ready property
  const rowDesc = formatTrackSizes(resolved.rows);
  if (rowDesc) parts.push(`grid-template-rows: ${rowDesc}`);

  // Gaps — CSS-ready properties
  const colGap: number = f.gridColumnGap || 0;
  const rowGap: number = f.gridRowGap || 0;
  if (colGap > 0 && colGap === rowGap) {
    parts.push(`gap: ${colGap}px`);
  } else {
    if (colGap > 0) parts.push(`column-gap: ${colGap}px`);
    if (rowGap > 0) parts.push(`row-gap: ${rowGap}px`);
  }

  return parts.join('; ');
}

function formatTrackSizes(tracks: Array<{ type: string; value?: number }>): string {
  if (!tracks || tracks.length === 0) return '';

  const parts = tracks.map(t => {
    if (t.type === 'FLEX') return t.value ? `${t.value}fr` : '1fr';
    if (t.type === 'FIXED') return `${Math.round(t.value || 0)}px`;
    if (t.type === 'HUG') return 'auto';
    return 'auto';
  });

  return parts.join(' ');
}

function formatSingleTrack(t: { type: string; value?: number }): string {
  if (t.type === 'FLEX') return t.value ? `${t.value}fr` : '1fr';
  if (t.type === 'FIXED') return `${Math.round(t.value || 0)}px`;
  if (t.type === 'HUG') return 'auto';
  return 'auto';
}

function buildSizeDesc(node: SceneNode): string {
  const w = Math.round(node.width);
  const h = Math.round(node.height);

  if (!('layoutSizingHorizontal' in node)) {
    return `${w}x${h}`;
  }

  const lsh = (node as any).layoutSizingHorizontal;
  const lsv = (node as any).layoutSizingVertical;

  const sizeLabels: Record<string, string> = {
    FILL: 'fill',
    HUG: 'hug',
    FIXED: '',
  };

  const wDesc = sizeLabels[lsh];
  const hDesc = sizeLabels[lsv];

  const wStr = wDesc ? `width: ${wDesc}` : `width: ${w}`;
  const hStr = hDesc ? `height: ${hDesc}` : `height: ${h}`;

  return `${wStr}, ${hStr}`;
}

/**
 * Extract min/max width/height constraints.
 * Available on FRAME, COMPONENT, INSTANCE nodes.
 */
function buildMinMaxClasses(node: SceneNode): { classes: string; desc: string } {
  const classParts: string[] = [];
  const descParts: string[] = [];

  if (!('minWidth' in node)) return { classes: '', desc: '' };

  const f = node as any;
  const minW: number | null = f.minWidth ?? null;
  const maxW: number | null = f.maxWidth ?? null;
  const minH: number | null = f.minHeight ?? null;
  const maxH: number | null = f.maxHeight ?? null;

  if (minW !== null && minW > 0) {
    classParts.push(`min-w-${mapSpacing(minW).value}`);
    descParts.push(`min-width: ${Math.round(minW)}px`);
  }
  if (maxW !== null && maxW > 0 && maxW < 10000) {
    classParts.push(`max-w-${mapSpacing(maxW).value}`);
    descParts.push(`max-width: ${Math.round(maxW)}px`);
  }
  if (minH !== null && minH > 0) {
    classParts.push(`min-h-${mapSpacing(minH).value}`);
    descParts.push(`min-height: ${Math.round(minH)}px`);
  }
  if (maxH !== null && maxH > 0 && maxH < 10000) {
    classParts.push(`max-h-${mapSpacing(maxH).value}`);
    descParts.push(`max-height: ${Math.round(maxH)}px`);
  }

  return {
    classes: classParts.join(' '),
    desc: descParts.length > 0 ? `, ${descParts.join(', ')}` : '',
  };
}

function weightToName(w: number): string {
  const map: Record<number, string> = {
    100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
  };
  return map[w] || `w${w}`;
}
