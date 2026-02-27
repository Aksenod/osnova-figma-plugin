// ─── Валидация ───

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  nodeName: string;
  nodeId?: string;
  message: string;
  suggestion?: string;
}

// ─── Иерархия ───

export interface LayoutInfo {
  direction: string;      // flex-row | flex-col | ''
  gap: string;            // gap-4 etc
  counterAxisGap: string; // gap-y-4 / gap-x-4 (only for wrap)
  wrap: string;           // flex-wrap | ''
  paddingClasses: string; // p-4 | px-6 py-4 etc
  alignItems: string;     // items-start etc
  justifyContent: string; // justify-center etc
}

export interface HierarchyNode {
  name: string;
  cssName: string;           // ".hero-section"
  layoutInfo: LayoutInfo;
  sizingH: string;           // w-full
  sizingV: string;           // h-auto
  isTarget: boolean;
}

// ─── Характеристики ───

export interface TypographyInfo {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number | null;
  letterSpacing: number | null;
  textAlignH: string;
  tailwindClasses: string;
  rawDescription: string;   // "Inter 24/32 Bold"
}

export interface ColorInfo {
  hex: string;
  opacity: number;
  tailwindClass: string;
  isExact: boolean;          // true если точное совпадение с Tailwind
  variableName?: string;     // имя Figma-переменной, если есть
}

export interface FillInfo {
  type: 'solid' | 'gradient' | 'image';
  color?: ColorInfo;
  description?: string;      // для градиентов/изображений
  gradientClasses?: string;  // Tailwind gradient classes (from-*/via-*/to-*)
}

export interface SpacingInfo {
  top: number;
  right: number;
  bottom: number;
  left: number;
  tailwindClasses: string;
}

export interface BorderRadiusInfo {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
  tailwindClass: string;
}

export interface StrokeInfo {
  color: ColorInfo;
  weight: number;
  tailwindClasses: string;
}

export interface NodeCharacteristics {
  typography?: TypographyInfo;
  fills: FillInfo[];
  strokes: StrokeInfo[];
  padding: SpacingInfo | null;
  borderRadius: BorderRadiusInfo | null;
  opacity: number;
  width: number;
  height: number;
  hasTextStyle: boolean;
  textStyleName?: string;
  hasColorVariable: boolean;
  colorVariableName?: string;
}

// ─── Дочерний элемент (рекурсивное дерево) ───

export interface ChildNodeInfo {
  name: string;
  nodeType: string;
  textContent?: string;
  // Tailwind-классы (для секции ИНСТРУКЦИЯ)
  layoutClasses: string;
  sizingClasses: string;
  styleClasses: string;
  // Описания (для секции СТРУКТУРА)
  layoutDesc: string;             // "Auto Layout: vertical, gap 24, align-items: center, justify: end"
  positionDesc: string;           // "absolute, x: 175, y: -93" или "" если в Auto Layout
  sizeDesc: string;               // "width: fill, height: hug" или "410×553"
  typographyDesc: string;         // "Inter 24/32 Bold, color #1A1A1A"
  fillDesc: string;               // "fill #3B82F6" или ""
  radiusDesc: string;             // "radius 8" или ""
  paddingDesc: string;            // "padding 16 24" или ""
  strokeDesc: string;             // "stroke #E5E7EB 1px" или ""
  overflowDesc: string;           // "clip content" или ""
  gridPositionDesc: string;       // "row 1, col 3" или "" если не в grid/wrap
  effectsDesc: string;            // "shadow 0 4 6 rgba(0,0,0,0.1)" или ""
  children: ChildNodeInfo[];
}

// ─── Контекст родителя ───

export interface ParentContextInfo {
  parentName: string;
  layoutType: string;          // "horizontal flex" | "vertical flex" | "no auto layout"
  wrap: boolean;
  gap: number;
  primaryAxisAlign: string;
  counterAxisAlign: string;
  padding: { top: number; right: number; bottom: number; left: number };
  childIndex: number;          // 0-based
  totalVisibleChildren: number;
  sizingInParent: { width: string; height: string }; // "fill" | "hug" | "fixed"
}

// ─── Результат анализа ───

export interface AnalysisResult {
  nodeName: string;
  nodeType: string;
  validationIssues: ValidationIssue[];
  hierarchy: HierarchyNode[];
  characteristics: NodeCharacteristics;
  nodeTree: ChildNodeInfo;
  formattedOutput: string;
  parentContextOutput: string;
}

// ─── Сообщения code ↔ ui ───

export type PluginMessage =
  | { type: 'analysis-result'; data: AnalysisResult }
  | { type: 'no-selection' }
  | { type: 'multiple-selection'; count: number }
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'screenshot-data'; bytes: number[] }
  | { type: 'screenshot-error' };
