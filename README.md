# Основа — Figma-плагин для генерации Tailwind-спецификаций

Figma-плагин, который анализирует выбранный элемент и генерирует текстовый промпт с полным описанием: layout, стили, позиционирование, вложенные элементы, Tailwind-классы. Промпт копируется в буфер и вставляется в AI-ассистент (Cursor, Claude и т.д.) для генерации кода.

## Стек

- **TypeScript** — весь код
- **React 18** — UI панели плагина
- **Webpack 5** — сборка (два entry: `code.ts` и `ui.tsx`)
- **Figma Plugin API** — типы `@figma/plugin-typings`
- **Tailwind v4** — справочные таблицы цветов, spacing, типографики

## Дизайн UI

UI выполнен в стиле Nothing Phone:
- **Шрифт:** Space Mono (Google Fonts) — терминальный моноширинный характер
- **Палитра:** монохром + красный акцент `#D92D20`
- **Углы:** `border-radius: 0` везде — острые углы на кнопках, toggle, badge, scrollbar
- **Иконки:** text-маркеры (`!`, `i`, `#`, `*`) в квадратных рамках вместо эмодзи
- **Индикаторы:** dot 6px (filled red = error, hollow = warning, dash = info)
- **Figma CSS variables** как fallback → light/dark mode автоматически

## Быстрый старт

```bash
npm install
npm run build     # production-сборка → dist/
npm run dev       # watch-режим для разработки
```

Загрузка в Figma:
1. Figma → Plugins → Development → Import plugin from manifest
2. Указать путь к `manifest.json`
3. При каждом изменении кода: `npm run build`, затем перезапуск плагина в Figma

## Архитектура

```
figma2vibe/
├── manifest.json              # Конфиг Figma-плагина
├── package.json
├── tsconfig.json
├── webpack.config.js          # 2 entry: code + ui, inline scripts
├── src/
│   ├── code.ts                # Entry: sandbox Figma (доступ к API нод)
│   ├── types.ts               # Все интерфейсы и типы
│   ├── ui.tsx                  # Entry: React UI (iframe)
│   ├── modules/
│   │   ├── extractor.ts       # Главный: обход дерева, извлечение данных
│   │   ├── tailwind-mapper.ts # Маппинг Figma-значений → Tailwind-классы
│   │   ├── hierarchy.ts       # Цепочка родителей, контекст позиционирования
│   │   ├── formatter.ts       # Сборка текстового промпта из данных
│   │   └── validator.ts       # 7 правил валидации макета
│   ├── data/
│   │   ├── tailwind-colors.ts    # Палитра Tailwind v4 (22 цвета × 11 оттенков)
│   │   ├── tailwind-spacing.ts   # Spacing scale (0–384px → Tailwind-классы)
│   │   └── tailwind-typography.ts # font-size, weight, line-height, letter-spacing, border-radius
│   └── ui/
│       ├── index.html          # HTML-шаблон для webpack
│       ├── styles.css          # Стили панели плагина (Nothing Phone design)
│       ├── App.tsx             # Корневой компонент UI
│       └── components/
│           ├── ValidationSection.tsx      # Секция проблем (errors + warnings)
│           ├── PositioningSection.tsx      # Дерево иерархии
│           ├── CharacteristicsSection.tsx  # Таблица свойств
│           └── RecommendationsSection.tsx  # Info-подсказки
└── dist/                       # Результат сборки
    ├── code.js                 # Sandbox-код
    └── ui.html                 # UI со встроенным JS/CSS
```

## Поток данных

```
Figma Canvas
    │
    ▼ selectionchange / первый запуск
code.ts — analyzeSelection()
    │
    ├─► hierarchy.ts — buildHierarchy(node)
    │     Строит цепочку от PAGE до выбранной ноды.
    │     Каждый узел: name, cssName, layoutInfo (Tailwind), sizing.
    │
    ├─► hierarchy.ts — extractParentContext(node)
    │     Контекст непосредственного родителя: layout, gap, align, padding,
    │     индекс ребёнка, sizing в родителе.
    │
    ├─► extractor.ts — extractCharacteristics(node)
    │     Свойства самой ноды: fills, strokes, padding, radius, opacity,
    │     typography (TextNode), Text Style, Color Variable.
    │
    ├─► extractor.ts — extractNodeTree(node)
    │     Рекурсивный обход (до 10 уровней). Для каждого потомка:
    │     layout, position, size, typography, fill, radius, stroke, padding,
    │     overflow, gridPosition + Tailwind-классы.
    │     Пустые CSS Grid ячейки → placeholder [EMPTY CELL] с grid-area.
    │
    ├─► validator.ts — validateNode(node, chars, hierarchy)
    │     7 правил → массив ValidationIssue[].
    │
    └─► formatter.ts — buildAnalysisResult(...)
          Собирает AnalysisResult, включая formattedOutput (текстовый промпт).
          │
          ▼ postMessage
    UI (React) — App.tsx
          │
          ├─ Показывает секции: Проблемы, Позиционирование, Характеристики, Рекомендации
          └─ Кнопка «Скопировать промпт» → clipboard (formattedOutput)
```

## Модули — подробное описание

### `code.ts` — точка входа sandbox

Figma-плагин работает в двух процессах:
- **Sandbox** (`code.ts`) — доступ к Figma API, нодам, стилям, переменным
- **UI** (`ui.tsx`) — iframe, нет доступа к нодам, общение через `postMessage`

`code.ts` слушает `selectionchange`, вызывает `analyzeSelection()`, отправляет результат в UI.

### `extractor.ts` — главный модуль извлечения данных

**Публичные функции:**
- `extractCharacteristics(node)` — плоские свойства ноды (fills, strokes, padding, radius, opacity, typography, Text Style, Color Variable)
- `extractNodeTree(node)` — полное дерево: корень + все потомки рекурсивно
- `extractChildrenTree(node, depth)` — только дети (используется рекурсивно)

**Внутренние функции:**
- `extractSingleChildInfo(node, depth)` — собирает `ChildNodeInfo` для одной ноды: вызывает `mapAutoLayout`, `mapSizing`, `mapTypography`, `mapFills`, `mapStrokes`, `mapNodeBorderRadius`, `mapPadding`, затем рекурсивно обходит детей
- `computeGridPositions(parent, children)` — вычисляет grid-позиции для детей:
  - **CSS Grid**: читает `gridRowAnchorIndex`, `gridColumnAnchorIndex`, `gridRowSpan`, `gridColumnSpan` из Figma API. Формат: `grid-area: 1 / 2; column track: 3fr; row track: auto`
  - **Flex wrap**: вычисляет row/col по координатам (сортировка по y → по x)
- **Пустые CSS Grid ячейки**: после обработки реальных детей, плагин вычисляет `cols × rows`, находит занятые ячейки (включая spans) и создаёт `[EMPTY CELL]` placeholder с `grid-area` для каждой незанятой позиции
- `buildGridLayoutDesc(frame)` — CSS-ready описание грида: `CSS Grid: 2 cols × 2 rows; grid-template-columns: 1fr 3fr; grid-template-rows: auto auto; gap: 10px`
- `buildLayoutDesc(frame)` — описание flex-контейнера: `Auto Layout: horizontal, gap 24, align-items: center`
- `buildPositionDesc(node)` — absolute-позиционирование: `absolute; top: 20px; left: 40px`
- `buildSizeDesc(node)` — `width: fill, height: hug` или `410×553`
- `formatTrackSizes(tracks)` — массив `{type, value}` → строку `1fr 3fr` или `auto 200px`
- `formatSingleTrack(track)` — один трек → строку

**Grid track resolution (auto → fr):**
Когда Figma задаёт колонки как `auto` (HUG), плагин измеряет фактические размеры детей и вычисляет пропорциональные `fr`. Логика в `resolveGridTracks()` (tailwind-mapper.ts):
1. Для каждой auto-колонки находит максимальную ширину не-spanning ребёнка
2. Делит все ширины на наименьшую, округляет до целых
3. Пример: колонки 240px и 760px → `1fr 3fr`

### `tailwind-mapper.ts` — маппинг Figma → Tailwind

**Публичные функции:**
- `mapTypography(node: TextNode)` → `TypographyInfo` — font-size, weight, line-height, letter-spacing, text-align → Tailwind-классы
- `mapFills(node)` → `FillInfo[]` — solid/gradient/image fills → bg-классы
- `mapTextColor(node: TextNode)` → `ColorInfo | null` — цвет текста → text-класс
- `mapStrokes(node)` → `StrokeInfo[]` — обводки → border-классы
- `mapPadding(node)` → `SpacingInfo | null` — padding → p-/px-/py-/pt-/pr-/pb-/pl-классы
- `mapNodeBorderRadius(node)` → `BorderRadiusInfo | null` — скругления → rounded-классы
- `mapAutoLayout(node)` → `LayoutInfo` — направление + gap + align + justify + padding:
  - **Flex**: `flex-row gap-4 items-center justify-between`
  - **CSS Grid**: `grid grid-cols-[1fr_3fr] gap-2.5` (arbitrary для нестандартных пропорций, стандартный `grid-cols-N` для равных 1fr)
- `mapSizing(node)` → `{h, v}` — `w-full`, `h-auto`, пустая строка для FIXED
- `resolveGridTracks(frame)` → `{columns, rows}` — резолвит HUG-треки в пропорциональные fr через измерение фактических размеров детей

**Логика grid-пропорций в `mapAutoLayout`:**
1. Вызывает `resolveGridTracks(frame)` — получает resolved-массивы
2. Проверяет: все колонки `1fr`? → `grid grid-cols-N` (стандартный)
3. Иначе → `grid grid-cols-[1fr_3fr]` (arbitrary Tailwind)
4. Аналогично для рядов: `grid-rows-N` или `grid-rows-[auto_200px]`

### `hierarchy.ts` — иерархия и контекст

**Публичные функции:**
- `buildHierarchy(node)` → `HierarchyNode[]` — цепочка от корневого фрейма до выбранного элемента. Каждый узел содержит cssName (`.hero-section`), layoutInfo (Tailwind-классы контейнера), sizing
- `extractParentContext(node)` → `ParentContextInfo | null` — контекст непосредственного родителя: layoutType, wrap, gap, align, padding, childIndex, totalVisibleChildren, sizingInParent
- `formatHierarchyTree(hierarchy)` → текстовое дерево для вывода

### `formatter.ts` — сборка текстового промпта

**Формат вывода (4 секции):**

```
ОБЪЕКТ:
Section (FRAME)
Layout: CSS Grid: 2 cols × 2 rows; grid-template-columns: 1fr 3fr; ...
Size: width: hug, height: hug
Fill: fill #ffffff
Tailwind: grid grid-cols-[1fr_3fr] gap-2.5 w-auto h-auto bg-white

ПОЗИЦИОНИРОВАНИЕ:
.page-wrapper (flex-col, gap-6, p-8)
  └─ Section [ЭТОТ ЭЛЕМЕНТ] (w-full, h-auto)

ХАРАКТЕРИСТИКИ:
Фон: #ffffff → bg-white
Размер: 1010×610px

ВЛОЖЕННЫЕ ЭЛЕМЕНТЫ:
|- Card -- Auto Layout: vertical, ...; grid-area: 2 / 2; column track: 3fr; ... [flex-col ...]
  |- image 32 -- width: 410, height: 553; fill #ff0000 [bg-[#ff0000]]
  |- Круг -- absolute; top: -40px; left: -40px ... [bg-zinc-300 rounded-full]
|- [EMPTY CELL] -- grid-area: 1 / 2

ПРОБЛЕМЫ:
- "Круг" — нет Auto Layout → не переведётся в flexbox
```

**Опциональная секция PARENT CONTEXT** (включается тогглом в UI):
```
PARENT CONTEXT:
Parent: "Wrapper"
Layout: horizontal flex
Gap: 24px
This element: child 2 of 3
Sizing in parent: width: fill, height: hug
```

### `validator.ts` — 7 правил валидации

| # | Правило | Severity | Что проверяет |
|---|---------|----------|---------------|
| 1 | No Auto Layout | warning | Фрейм с детьми без layoutMode → absolute positioning |
| 2 | No Text Style | info | TextNode без привязанного Text Style |
| 3 | No Color Variable | info | Solid fill без привязанной Color Variable |
| 4 | Non-4px spacing | warning | Padding/gap не кратные 4px |
| 5 | Odd sizes | info | Нечётные width/height на фиксированных элементах |
| 6 | Group | warning | GROUP вместо FRAME → нет layout-свойств |
| 7 | Container opacity | info | Opacity < 1 на контейнере с детьми |

### `data/` — справочные таблицы Tailwind v4

**`tailwind-colors.ts`:**
- 22 цветовые группы × 11 оттенков (50–950) + black + white = 244 цвета
- `mapColor(hex, prefix)` — Euclidean RGB distance, порог 30. Ближе → именованный класс (`bg-blue-500`), дальше → arbitrary (`bg-[#1a2b3c]`)
- `rgbaToHex(r, g, b)` — конвертация Figma 0..1 → hex

**`tailwind-spacing.ts`:**
- Шкала: 0, 1(px), 2(0.5), 4(1), 6(1.5), ... 384(96)
- `mapSpacing(px)` — точное совпадение → `{value: '4', isExact: true}`, нет → `{value: '[13px]', isExact: false}`
- `isMultipleOf4(px)` — для валидации

**`tailwind-typography.ts`:**
- Font sizes: 12px–128px → text-xs ... text-9xl
- Font weights: 100–900 → font-thin ... font-black
- Line heights: абсолютные (px) + relative (ratio)
- Letter spacing: em → tracking-*
- Border radius: 0–9999 → rounded-none ... rounded-full
- Для нестандартных значений → arbitrary: `text-[15px]`, `rounded-[10px]`

## UI-компоненты (React)

**`App.tsx`** — корневой компонент, 4 состояния:
- `empty` — нет выделения
- `loading` — анализ в процессе
- `multiple` — выделено несколько элементов (не поддерживается)
- `result` — результат анализа

Нижняя панель:
- Тоггл «Include parent context» — добавляет секцию PARENT CONTEXT в промпт
- Кнопка «Скопировать промпт» — копирует `formattedOutput` в clipboard

**Секции:**
- `ValidationSection` — errors + warnings (dot-индикаторы: filled red / hollow / dash)
- `PositioningSection` — дерево иерархии с Tailwind-классами
- `CharacteristicsSection` — таблица свойств (шрифт, фон, обводка, padding, radius, opacity, размер)
- `RecommendationsSection` — info-подсказки (Text Style, Color Variable, нечётные размеры)

## Сборка

Webpack собирает два бандла:
- `dist/code.js` — sandbox-код (entry: `src/code.ts`)
- `dist/ui.html` — UI с инлайн JS/CSS (entry: `src/ui.tsx`, шаблон: `src/ui/index.html`)

Figma требует, чтобы UI был одним HTML-файлом с инлайн-скриптами (`HtmlInlineScriptPlugin`).

## Типы (`types.ts`)

Ключевые интерфейсы:
- `ChildNodeInfo` — узел дерева: layoutClasses, sizingClasses, styleClasses + описания (layoutDesc, positionDesc, sizeDesc, typographyDesc, fillDesc, radiusDesc, paddingDesc, strokeDesc, overflowDesc, gridPositionDesc) + children[]
- `AnalysisResult` — полный результат: nodeName, nodeType, validationIssues, hierarchy, characteristics, nodeTree, formattedOutput, parentContextOutput
- `PluginMessage` — union для code ↔ ui общения: `analysis-result | no-selection | multiple-selection | loading`

## Как добавить новое свойство

1. Добавить поле в `ChildNodeInfo` (types.ts)
2. Извлечь значение в `extractSingleChildInfo()` (extractor.ts)
3. Добавить маппинг в tailwind-mapper.ts (если нужен Tailwind-класс)
4. Добавить в `formatSingleNode()` и/или `formatObjectSection()` (formatter.ts)
5. При необходимости — добавить правило валидации в validator.ts

## Как добавить новое правило валидации

1. Написать функцию `checkXxx(node, issues)` в validator.ts
2. Вызвать её в `validateNode()`
3. Указать severity: `error` (красный), `warning` (жёлтый), `info` (подсказка)

## Как расширить Tailwind-маппинг

Справочные таблицы в `src/data/`:
- Добавить значения в соответствующий MAP
- Для нестандартных значений автоматически генерируется arbitrary: `text-[15px]`, `bg-[#1a2b3c]`
- Порог цвета (`DISTANCE_THRESHOLD = 30`) можно настраивать
