import type { ValidationIssue, NodeCharacteristics, HierarchyNode } from '../types';
import { isMultipleOf4 } from '../data/tailwind-spacing';

/**
 * 7 правил валидации макета (только выделенный узел).
 */
export function validateNode(
  node: SceneNode,
  characteristics: NodeCharacteristics,
  hierarchy: HierarchyNode[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Правило 1: Нет Auto Layout на контейнере
  checkAutoLayout(node, issues);

  // Правило 2: Нет Text Style
  checkTextStyle(node, characteristics, issues);

  // Правило 3: Нет Color Variable
  checkColorVariable(node, characteristics, issues);

  // Правило 4: Отступы не кратны 4px
  checkSpacing(node, issues);

  // Правило 5: Нечётные размеры (нестандартные)
  checkOddSizes(node, issues);

  // Правило 6: Group вместо Frame
  checkGroup(node, issues);

  // Правило 7: Opacity на контейнере (вместо цвета)
  checkOpacity(node, characteristics, issues);

  return issues;
}

/**
 * Рекурсивная валидация всех дочерних узлов.
 * Проверяет правила, которые не требуют async-характеристик:
 * 1 (Auto Layout), 4 (Spacing), 5 (Odd sizes), 6 (Group), 7 (Opacity).
 */
export function validateDescendants(node: SceneNode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!('children' in node)) return issues;

  const MAX_ISSUES = 50;

  function walk(n: SceneNode): void {
    if (issues.length >= MAX_ISSUES) return;

    checkAutoLayoutSelf(n, issues);
    checkSpacing(n, issues);
    checkOddSizes(n, issues);
    checkGroup(n, issues);
    checkOpacitySelf(n, issues);

    if ('children' in n) {
      const children = (n as any).children as SceneNode[];
      for (const child of children) {
        if (child.visible === false) continue;
        if (issues.length >= MAX_ISSUES) break;
        walk(child);
      }
    }
  }

  const children = (node as any).children as SceneNode[];
  for (const child of children) {
    if (child.visible === false) continue;
    walk(child);
  }

  return issues;
}

// ─── Правило 1: Auto Layout (полная — с проверкой родителей) ───

function checkAutoLayout(node: SceneNode, issues: ValidationIssue[]): void {
  if (
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    'children' in node &&
    node.children.length > 0
  ) {
    const frame = node as FrameNode;
    if (frame.layoutMode === 'NONE' || !frame.layoutMode) {
      issues.push({
        severity: 'warning',
        nodeName: node.name,
        nodeId: node.id,
        message: 'нет Auto Layout → не переведётся в flexbox',
        suggestion: 'Добавь Auto Layout (Shift+A) для корректной вёрстки',
      });
    }
  }

  // Проверяем родителей
  let parent = node.parent;
  while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
    if (
      (parent.type === 'FRAME' || parent.type === 'COMPONENT' || parent.type === 'INSTANCE') &&
      'children' in parent &&
      parent.children.length > 1
    ) {
      const frame = parent as FrameNode;
      if (frame.layoutMode === 'NONE' || !frame.layoutMode) {
        issues.push({
          severity: 'warning',
          nodeName: parent.name,
          nodeId: parent.id,
          message: 'родительский фрейм без Auto Layout → дочерние элементы будут с абсолютным позиционированием',
          suggestion: `Добавь Auto Layout на "${parent.name}"`,
        });
      }
    }
    parent = parent.parent;
  }
}

// ─── Правило 1 (для потомков): только сам узел, без родителей ───

function checkAutoLayoutSelf(node: SceneNode, issues: ValidationIssue[]): void {
  if (
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    'children' in node &&
    node.children.length > 0
  ) {
    const frame = node as FrameNode;
    if (frame.layoutMode === 'NONE' || !frame.layoutMode) {
      issues.push({
        severity: 'warning',
        nodeName: node.name,
        nodeId: node.id,
        message: 'нет Auto Layout → не переведётся в flexbox',
        suggestion: 'Добавь Auto Layout (Shift+A) для корректной вёрстки',
      });
    }
  }
}

// ─── Правило 2: Text Style ───

function checkTextStyle(
  node: SceneNode,
  characteristics: NodeCharacteristics,
  issues: ValidationIssue[]
): void {
  if (node.type === 'TEXT' && !characteristics.hasTextStyle) {
    issues.push({
      severity: 'info',
      nodeName: node.name,
      nodeId: node.id,
      message: 'стиль текста не задан',
      suggestion: `Создай Text Style для переиспользования`,
    });
  }
}

// ─── Правило 3: Color Variable ───

function checkColorVariable(
  node: SceneNode,
  characteristics: NodeCharacteristics,
  issues: ValidationIssue[]
): void {
  if (
    characteristics.fills.length > 0 &&
    characteristics.fills[0].type === 'solid' &&
    !characteristics.hasColorVariable
  ) {
    const hex = characteristics.fills[0].color?.hex;
    if (hex) {
      issues.push({
        severity: 'info',
        nodeName: node.name,
        nodeId: node.id,
        message: `цвет ${hex} не привязан к переменной`,
        suggestion: `Создай Color Variable для ${hex}`,
      });
    }
  }
}

// ─── Правило 4: Отступы кратны 4px ───

function checkSpacing(node: SceneNode, issues: ValidationIssue[]): void {
  if (
    node.type !== 'FRAME' &&
    node.type !== 'COMPONENT' &&
    node.type !== 'INSTANCE'
  ) return;

  const frame = node as FrameNode;
  if (frame.layoutMode === 'NONE') return;

  const paddingValues = {
    top: frame.paddingTop ?? 0,
    right: frame.paddingRight ?? 0,
    bottom: frame.paddingBottom ?? 0,
    left: frame.paddingLeft ?? 0,
  };

  const gap = frame.itemSpacing ?? 0;

  const badPaddings = Object.entries(paddingValues)
    .filter(([, v]) => v > 0 && !isMultipleOf4(v))
    .map(([, v]) => v);

  const badGap = gap > 0 && !isMultipleOf4(gap);

  const roundTo4 = (v: number) => Math.round(v / 4) * 4;

  const parts: string[] = [];
  const fixes: string[] = [];
  if (badPaddings.length > 0) {
    const unique = [...new Set(badPaddings)];
    parts.push(`padding: ${unique.join(', ')}px`);
    unique.forEach(v => fixes.push(`padding ${v}px → ${roundTo4(v)}px`));
  }
  if (badGap) {
    parts.push(`gap: ${gap}px`);
    fixes.push(`gap ${gap}px → ${roundTo4(gap)}px`);
  }

  if (parts.length > 0) {
    issues.push({
      severity: 'info',
      nodeName: node.name,
      nodeId: node.id,
      message: `не кратны 4px → ${parts.join('; ')}`,
      suggestion: `Исправь: ${fixes.join('; ')}`,
    });
  }
}

// ─── Правило 5: Нечётные размеры ───

function checkOddSizes(node: SceneNode, issues: ValidationIssue[]): void {
  const w = Math.round(node.width);
  const h = Math.round(node.height);

  // Пропускаем текст — его размер определяется контентом
  if (node.type === 'TEXT') return;

  // Проверяем только оси с фиксированным размером
  let checkW = true;
  let checkH = true;
  if ('layoutSizingHorizontal' in node) {
    const lsh = (node as any).layoutSizingHorizontal;
    const lsv = (node as any).layoutSizingVertical;
    if (lsh === 'FILL' || lsh === 'HUG') checkW = false;
    if (lsv === 'FILL' || lsv === 'HUG') checkH = false;
  }

  const oddW = checkW && w % 2 !== 0;
  const oddH = checkH && h % 2 !== 0;

  if (oddW || oddH) {
    const roundUp = (v: number) => v % 2 !== 0 ? v + 1 : v;
    issues.push({
      severity: 'info',
      nodeName: node.name,
      nodeId: node.id,
      message: `нечётные размеры (${w}×${h}px)`,
      suggestion: `Исправь: ${w}×${h}px → ${roundUp(w)}×${roundUp(h)}px`,
    });
  }
}

// ─── Правило 6: Group ───

function checkGroup(node: SceneNode, issues: ValidationIssue[]): void {
  if (node.type === 'GROUP') {
    issues.push({
      severity: 'warning',
      nodeName: node.name,
      nodeId: node.id,
      message: 'Group не имеет свойств layout → сложно перевести в код',
      suggestion: 'Замени Group на Frame с Auto Layout',
    });
  }
}

// ─── Правило 7: Opacity на контейнере (полная — с characteristics) ───

function checkOpacity(
  node: SceneNode,
  characteristics: NodeCharacteristics,
  issues: ValidationIssue[]
): void {
  if (
    characteristics.opacity < 1 &&
    characteristics.opacity > 0 &&
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    'children' in node &&
    node.children.length > 0
  ) {
    issues.push({
      severity: 'info',
      nodeName: node.name,
      nodeId: node.id,
      message: `opacity ${Math.round(characteristics.opacity * 100)}% на контейнере → применится ко всем дочерним элементам`,
      suggestion: 'Лучше использовать полупрозрачный цвет фона вместо opacity на контейнере',
    });
  }
}

// ─── Правило 7 (для потомков): без characteristics ───

function checkOpacitySelf(node: SceneNode, issues: ValidationIssue[]): void {
  const opacity = 'opacity' in node ? (node as any).opacity as number : 1;
  if (
    opacity < 1 &&
    opacity > 0 &&
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    'children' in node &&
    node.children.length > 0
  ) {
    issues.push({
      severity: 'info',
      nodeName: node.name,
      nodeId: node.id,
      message: `opacity ${Math.round(opacity * 100)}% на контейнере → применится ко всем дочерним элементам`,
      suggestion: 'Лучше использовать полупрозрачный цвет фона вместо opacity на контейнере',
    });
  }
}
