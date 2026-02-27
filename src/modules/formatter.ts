import type {
  AnalysisResult,
  ValidationIssue,
  HierarchyNode,
  NodeCharacteristics,
  ChildNodeInfo,
  ParentContextInfo,
} from '../types';
import { formatHierarchyTree } from './hierarchy';

/**
 * Собрать полный текстовый вывод из результатов анализа.
 * Язык: русский.
 */
export function formatOutput(
  nodeName: string,
  nodeType: string,
  issues: ValidationIssue[],
  hierarchy: HierarchyNode[],
  characteristics: NodeCharacteristics,
  nodeTree: ChildNodeInfo
): string {
  const sections: string[] = [];

  // ─── Секция 1: Объект ───
  const objectLines = formatObjectSection(nodeTree);
  sections.push(`ОБЪЕКТ:\n${objectLines}`);

  // ─── Секция 2: Позиционирование ───
  if (hierarchy.length > 0) {
    const tree = formatHierarchyTree(hierarchy);
    sections.push(`ПОЗИЦИОНИРОВАНИЕ:\n${tree}`);
  }

  // ─── Секция 3: Характеристики ───
  const charLines = formatCharacteristics(characteristics, nodeType);
  if (charLines.length > 0) {
    sections.push(`ХАРАКТЕРИСТИКИ:\n${charLines.join('\n')}`);
  }

  // ─── Секция 4: Вложенные элементы ───
  if (nodeTree.children.length > 0) {
    const childrenLines = formatChildrenTree(nodeTree.children, 0);
    sections.push(`ВЛОЖЕННЫЕ ЭЛЕМЕНТЫ:\n${childrenLines}`);
  }

  // ─── Проблемы (если есть) ───
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  if (errors.length > 0 || warnings.length > 0) {
    const problemLines = [...errors, ...warnings].map(i => {
      return `- "${i.nodeName}" — ${i.message}`;
    });
    sections.push(`ПРОБЛЕМЫ:\n${problemLines.join('\n')}`);
  }

  sections.push('ВАЖНО:\nВерстай строго по спецификации. Визуальный результат должен точно соответствовать описанным стилям.\nВместо картинок используй серые плейсхолдеры (bg-gray-200/50) с сохранением пропорций оригинала.');

  return sections.join('\n\n');
}

/**
 * Форматировать секцию характеристик.
 */
function formatCharacteristics(
  chars: NodeCharacteristics,
  nodeType: string
): string[] {
  const lines: string[] = [];

  // Типографика
  if (chars.typography) {
    const t = chars.typography;
    lines.push(`Шрифт: ${t.rawDescription} → ${t.tailwindClasses}`);

    // Text style name
    if (chars.hasTextStyle && chars.textStyleName) {
      lines.push(`Стиль текста: ${chars.textStyleName}`);
    }
  }

  // Fills / цвета
  for (const fill of chars.fills) {
    if (fill.type === 'solid' && fill.color) {
      const label = chars.typography ? 'Цвет текста' : 'Фон';
      let desc = `${fill.color.hex} → ${fill.color.tailwindClass}`;
      if (fill.color.variableName) {
        desc += ` (${fill.color.variableName})`;
      }
      if (fill.color.opacity < 1) {
        desc += ` / ${Math.round(fill.color.opacity * 100)}%`;
      }
      lines.push(`${label}: ${desc}`);
    } else if (fill.type === 'gradient') {
      let desc = fill.description || 'gradient';
      if (fill.gradientClasses) desc += ` → ${fill.gradientClasses}`;
      lines.push(`Фон: ${desc}`);
    } else if (fill.type === 'image') {
      lines.push(`Фон: изображение`);
    }
  }

  // Strokes
  for (const stroke of chars.strokes) {
    let desc = `${stroke.color.hex} ${stroke.weight}px → ${stroke.tailwindClasses}`;
    lines.push(`Обводка: ${desc}`);
  }

  // Padding
  if (chars.padding && chars.padding.tailwindClasses) {
    const p = chars.padding;
    lines.push(
      `Отступы: ${p.top} ${p.right} ${p.bottom} ${p.left} → ${p.tailwindClasses}`
    );
  }

  // Border radius
  if (chars.borderRadius) {
    const r = chars.borderRadius;
    const allSame =
      r.topLeft === r.topRight &&
      r.topRight === r.bottomRight &&
      r.bottomRight === r.bottomLeft;
    const pxDesc = allSame ? `${r.topLeft}` : `${r.topLeft} ${r.topRight} ${r.bottomRight} ${r.bottomLeft}`;
    lines.push(`Скругление: ${pxDesc} → ${r.tailwindClass}`);
  }

  // Opacity
  if (chars.opacity < 1 && chars.opacity > 0) {
    const pct = Math.round(chars.opacity * 100);
    lines.push(`Прозрачность: ${pct}% → opacity-${pct}`);
  }

  // Размеры
  lines.push(`Размер: ${chars.width}×${chars.height}px`);

  return lines;
}

/**
 * Форматировать секцию ОБЪЕКТ — описание выбранного элемента.
 */
function formatObjectSection(root: ChildNodeInfo): string {
  const lines: string[] = [];

  lines.push(`${root.name} (${root.nodeType})`);

  if (root.layoutDesc) lines.push(`Layout: ${root.layoutDesc}`);
  if (root.sizeDesc) lines.push(`Size: ${root.sizeDesc}`);
  if (root.paddingDesc) lines.push(`Padding: ${root.paddingDesc}`);
  if (root.overflowDesc) lines.push(`Overflow: ${root.overflowDesc}`);
  if (root.fillDesc) lines.push(`Fill: ${root.fillDesc}`);
  if (root.radiusDesc) lines.push(`Radius: ${root.radiusDesc}`);
  if (root.strokeDesc) lines.push(`Stroke: ${root.strokeDesc}`);
  if (root.effectsDesc) lines.push(`Effects: ${root.effectsDesc}`);
  if (root.typographyDesc) lines.push(`Typography: ${root.typographyDesc}`);
  if (root.positionDesc) lines.push(`Position: ${root.positionDesc}`);

  // Tailwind classes
  const twParts: string[] = [];
  if (root.layoutClasses) twParts.push(root.layoutClasses);
  if (root.sizingClasses) twParts.push(root.sizingClasses);
  if (root.styleClasses) twParts.push(root.styleClasses);
  if (twParts.length > 0) lines.push(`Tailwind: ${twParts.join(' ')}`);

  return lines.join('\n');
}

/**
 * Рекурсивно форматировать дерево дочерних элементов.
 * Формат дизайнерский, но понятный для AI-ассистента.
 */
function formatChildrenTree(children: ChildNodeInfo[], depth: number): string {
  const lines: string[] = [];

  for (const child of children) {
    lines.push(formatSingleNode(child, depth, '|- '));

    // Рекурсия — дочерние
    if (child.children.length > 0) {
      lines.push(formatChildrenTree(child.children, depth + 1));
    }
  }

  return lines.join('\n');
}

/**
 * Форматировать одну ноду в строку.
 */
function formatSingleNode(node: ChildNodeInfo, depth: number, connector: string): string {
  const indent = '  '.repeat(depth);
  const descParts: string[] = [];

  // Layout (что за контейнер)
  if (node.layoutDesc) descParts.push(node.layoutDesc);

  // Позиционирование (только для absolute)
  if (node.positionDesc) descParts.push(node.positionDesc);

  // Grid position (только для wrap-контейнеров)
  if (node.gridPositionDesc) descParts.push(node.gridPositionDesc);

  // Размеры
  if (node.sizeDesc) descParts.push(node.sizeDesc);

  // Padding
  if (node.paddingDesc) descParts.push(node.paddingDesc);

  // Overflow
  if (node.overflowDesc) descParts.push(node.overflowDesc);

  // Fill
  if (node.fillDesc) descParts.push(node.fillDesc);

  // Radius
  if (node.radiusDesc) descParts.push(node.radiusDesc);

  // Stroke
  if (node.strokeDesc) descParts.push(node.strokeDesc);

  // Effects (shadows, blur, rotation, blend)
  if (node.effectsDesc) descParts.push(node.effectsDesc);

  // Typography
  if (node.typographyDesc) descParts.push(node.typographyDesc);

  const desc = descParts.length > 0 ? ` -- ${descParts.join('; ')}` : '';

  // Tailwind classes ref
  const twParts: string[] = [];
  if (node.layoutClasses) twParts.push(node.layoutClasses);
  if (node.sizingClasses) twParts.push(node.sizingClasses);
  if (node.styleClasses) twParts.push(node.styleClasses);
  const twRef = twParts.length > 0 ? ` [${twParts.join(' ')}]` : '';

  // Text content
  let textStr = '';
  if (node.textContent) {
    const truncated = node.textContent.length > 60
      ? node.textContent.substring(0, 60) + '...'
      : node.textContent;
    textStr = `: "${truncated}"`;
  }

  return `${indent}${connector}${node.name}${textStr}${desc}${twRef}`;
}

/**
 * Форматировать контекст родителя в текстовую секцию.
 */
export function formatParentContext(info: ParentContextInfo | null): string {
  if (!info) return '';

  var lines: string[] = [];

  lines.push('PARENT CONTEXT:');
  lines.push('Parent: "' + info.parentName + '"');

  var layoutStr = info.layoutType;
  if (info.wrap) layoutStr += ', wrap';
  lines.push('Layout: ' + layoutStr);

  if (info.gap > 0) {
    lines.push('Gap: ' + info.gap + 'px');
  }

  if (info.primaryAxisAlign || info.counterAxisAlign) {
    var alignParts: string[] = [];
    if (info.primaryAxisAlign) alignParts.push('primary-axis ' + info.primaryAxisAlign);
    if (info.counterAxisAlign) alignParts.push('counter-axis ' + info.counterAxisAlign);
    lines.push('Align: ' + alignParts.join(', '));
  }

  var p = info.padding;
  if (p.top > 0 || p.right > 0 || p.bottom > 0 || p.left > 0) {
    lines.push('Padding: ' + p.top + ' ' + p.right + ' ' + p.bottom + ' ' + p.left);
  }

  lines.push(
    'This element: child ' + (info.childIndex + 1) + ' of ' + info.totalVisibleChildren
  );
  lines.push(
    'Sizing in parent: width: ' + info.sizingInParent.width +
    ', height: ' + info.sizingInParent.height
  );

  return lines.join('\n');
}

/**
 * Собрать полный AnalysisResult.
 */
export function buildAnalysisResult(
  node: SceneNode,
  issues: ValidationIssue[],
  hierarchy: HierarchyNode[],
  characteristics: NodeCharacteristics,
  nodeTree: ChildNodeInfo,
  parentContext: ParentContextInfo | null
): AnalysisResult {
  const formattedOutput = formatOutput(
    node.name,
    node.type,
    issues,
    hierarchy,
    characteristics,
    nodeTree
  );

  const parentContextOutput = formatParentContext(parentContext);

  return {
    nodeName: node.name,
    nodeType: node.type,
    validationIssues: issues,
    hierarchy,
    characteristics,
    nodeTree,
    formattedOutput,
    parentContextOutput,
  };
}
