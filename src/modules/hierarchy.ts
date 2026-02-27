import type { HierarchyNode, ParentContextInfo } from '../types';
import { mapAutoLayout, mapSizing } from './tailwind-mapper';

/**
 * Приводит имя ноды к CSS-like формату.
 * "Hero Section" → ".hero-section"
 */
function toCssName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned ? `.${cleaned}` : '.unnamed';
}

/**
 * Собирает цепочку от корня (Page) до выбранной ноды.
 * Возвращает массив, где [0] — ближайший к корню фрейм, последний — целевой элемент.
 */
export function buildHierarchy(node: SceneNode): HierarchyNode[] {
  const chain: SceneNode[] = [];

  let current: BaseNode | null = node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if ('visible' in current) {
      chain.unshift(current as SceneNode);
    }
    current = current.parent;
  }

  return chain.map((n, index) => {
    const isTarget = index === chain.length - 1;
    const sizing = mapSizing(n);

    let layoutInfo = { direction: '', gap: '', counterAxisGap: '', wrap: '', paddingClasses: '', alignItems: '', justifyContent: '' };
    if (
      n.type === 'FRAME' ||
      n.type === 'COMPONENT' ||
      n.type === 'INSTANCE' ||
      n.type === 'COMPONENT_SET'
    ) {
      layoutInfo = mapAutoLayout(n as FrameNode);
    }

    return {
      name: n.name,
      cssName: toCssName(n.name),
      layoutInfo,
      sizingH: sizing.h,
      sizingV: sizing.v,
      isTarget,
    };
  });
}

/**
 * Извлекает контекст родительского контейнера для выбранной ноды.
 * Возвращает null, если родитель — PAGE или DOCUMENT.
 */
export function extractParentContext(node: SceneNode): ParentContextInfo | null {
  const parent = node.parent;
  if (!parent || parent.type === 'PAGE' || parent.type === 'DOCUMENT') {
    return null;
  }

  const parentNode = parent as SceneNode;

  // Layout type
  let layoutType = 'no auto layout';
  let wrap = false;
  let gap = 0;
  let primaryAxisAlign = '';
  let counterAxisAlign = '';
  let padTop = 0;
  let padRight = 0;
  let padBottom = 0;
  let padLeft = 0;

  if (
    parentNode.type === 'FRAME' ||
    parentNode.type === 'COMPONENT' ||
    parentNode.type === 'INSTANCE' ||
    parentNode.type === 'COMPONENT_SET'
  ) {
    const frame = parentNode as FrameNode;
    if (frame.layoutMode === 'HORIZONTAL') {
      layoutType = 'horizontal flex';
    } else if (frame.layoutMode === 'VERTICAL') {
      layoutType = 'vertical flex';
    }

    if ('layoutWrap' in frame) {
      wrap = (frame as any).layoutWrap === 'WRAP';
    }

    gap = frame.itemSpacing || 0;

    const primaryMap: Record<string, string> = {
      MIN: 'start', CENTER: 'center', MAX: 'end', SPACE_BETWEEN: 'space-between',
    };
    const counterMap: Record<string, string> = {
      MIN: 'start', CENTER: 'center', MAX: 'end', BASELINE: 'baseline',
    };
    primaryAxisAlign = primaryMap[frame.primaryAxisAlignItems] || '';
    counterAxisAlign = counterMap[frame.counterAxisAlignItems] || '';

    padTop = frame.paddingTop || 0;
    padRight = frame.paddingRight || 0;
    padBottom = frame.paddingBottom || 0;
    padLeft = frame.paddingLeft || 0;
  }

  // Child index among visible children
  let childIndex = 0;
  let totalVisibleChildren = 0;
  if ('children' in parent) {
    const children = (parent as any).children as ReadonlyArray<SceneNode>;
    const visible = children.filter(function (c: SceneNode) { return c.visible !== false; });
    totalVisibleChildren = visible.length;
    for (let i = 0; i < visible.length; i++) {
      if (visible[i].id === node.id) {
        childIndex = i;
        break;
      }
    }
  }

  // Sizing of current node in parent
  let widthSizing = 'fixed';
  let heightSizing = 'fixed';
  if ('layoutSizingHorizontal' in node) {
    const lsh = (node as any).layoutSizingHorizontal;
    if (lsh === 'FILL') widthSizing = 'fill';
    else if (lsh === 'HUG') widthSizing = 'hug';
  }
  if ('layoutSizingVertical' in node) {
    const lsv = (node as any).layoutSizingVertical;
    if (lsv === 'FILL') heightSizing = 'fill';
    else if (lsv === 'HUG') heightSizing = 'hug';
  }

  return {
    parentName: parentNode.name,
    layoutType: layoutType,
    wrap: wrap,
    gap: gap,
    primaryAxisAlign: primaryAxisAlign,
    counterAxisAlign: counterAxisAlign,
    padding: { top: padTop, right: padRight, bottom: padBottom, left: padLeft },
    childIndex: childIndex,
    totalVisibleChildren: totalVisibleChildren,
    sizingInParent: { width: widthSizing, height: heightSizing },
  };
}

/**
 * Форматирует иерархию в текстовое дерево для вывода.
 */
export function formatHierarchyTree(hierarchy: HierarchyNode[]): string {
  if (hierarchy.length === 0) return '';

  const lines: string[] = [];

  hierarchy.forEach((node, index) => {
    const indent = index === 0 ? '' : '  '.repeat(index - 1) + (index > 0 ? '└─ ' : '');

    const layoutParts: string[] = [];
    if (node.layoutInfo.direction) layoutParts.push(node.layoutInfo.direction);
    if (node.layoutInfo.wrap) layoutParts.push(node.layoutInfo.wrap);
    if (node.layoutInfo.gap) layoutParts.push(node.layoutInfo.gap);
    if (node.layoutInfo.counterAxisGap) layoutParts.push(node.layoutInfo.counterAxisGap);
    if (node.layoutInfo.alignItems) layoutParts.push(node.layoutInfo.alignItems);
    if (node.layoutInfo.justifyContent) layoutParts.push(node.layoutInfo.justifyContent);
    if (node.layoutInfo.paddingClasses) layoutParts.push(node.layoutInfo.paddingClasses);

    const sizingParts = [node.sizingH, node.sizingV].filter(Boolean);

    const label = node.isTarget ? `${node.name} [ЭТОТ ЭЛЕМЕНТ]` : node.cssName;
    const allParts = [...layoutParts, ...sizingParts];
    const details = allParts.join(', ');

    lines.push(`${indent}${label} (${details})`);
  });

  return lines.join('\n');
}
