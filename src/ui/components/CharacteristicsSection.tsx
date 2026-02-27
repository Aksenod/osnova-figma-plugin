import React from 'react';
import type { NodeCharacteristics } from '../../types';

interface Props {
  characteristics: NodeCharacteristics;
  nodeType: string;
}

export function CharacteristicsSection({ characteristics: chars, nodeType }: Props) {
  const rows: { label: string; value: string; raw?: string; color?: string }[] = [];

  // Типографика
  if (chars.typography) {
    const t = chars.typography;
    rows.push({
      label: 'Шрифт',
      value: t.tailwindClasses,
      raw: t.rawDescription,
    });

    if (chars.hasTextStyle && chars.textStyleName) {
      rows.push({ label: 'Стиль текста', value: chars.textStyleName });
    }
  }

  // Fills / цвета
  for (const fill of chars.fills) {
    if (fill.type === 'solid' && fill.color) {
      const label = chars.typography ? 'Цвет текста' : 'Фон';
      let value = fill.color.tailwindClass;
      if (fill.color.variableName) {
        value += ` (${fill.color.variableName})`;
      }
      rows.push({
        label,
        value,
        raw: fill.color.hex,
        color: fill.color.hex,
      });
    } else if (fill.type === 'gradient') {
      rows.push({ label: 'Фон', value: fill.description || 'gradient' });
    } else if (fill.type === 'image') {
      rows.push({ label: 'Фон', value: 'изображение' });
    }
  }

  // Strokes
  for (const stroke of chars.strokes) {
    rows.push({
      label: 'Обводка',
      value: stroke.tailwindClasses,
      raw: `${stroke.color.hex} ${stroke.weight}px`,
      color: stroke.color.hex,
    });
  }

  // Padding
  if (chars.padding && chars.padding.tailwindClasses) {
    const p = chars.padding;
    rows.push({
      label: 'Отступы',
      value: p.tailwindClasses,
      raw: `${p.top} ${p.right} ${p.bottom} ${p.left}`,
    });
  }

  // Border radius
  if (chars.borderRadius) {
    const r = chars.borderRadius;
    const allSame =
      r.topLeft === r.topRight &&
      r.topRight === r.bottomRight &&
      r.bottomRight === r.bottomLeft;
    rows.push({
      label: 'Скругление',
      value: r.tailwindClass,
      raw: allSame ? `${r.topLeft}px` : `${r.topLeft} ${r.topRight} ${r.bottomRight} ${r.bottomLeft}`,
    });
  }

  // Opacity
  if (chars.opacity < 1 && chars.opacity > 0) {
    const pct = Math.round(chars.opacity * 100);
    rows.push({
      label: 'Прозрачность',
      value: `opacity-${pct}`,
      raw: `${pct}%`,
    });
  }

  // Размеры
  rows.push({
    label: 'Размер',
    value: `${chars.width}\u00D7${chars.height}px`,
  });

  if (rows.length === 0) return null;

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-marker">*</span>
        <span>Характеристики</span>
      </div>
      <div className="section-body">
        {rows.map((row, i) => (
          <div key={i} className="char-row">
            <span className="label">{row.label}</span>
            <span className="value">
              {row.color && (
                <span
                  className="color-swatch"
                  style={{ backgroundColor: row.color }}
                />
              )}
              {row.value}
              {row.raw && <span className="raw"> ({row.raw})</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
