import React from 'react';
import type { HierarchyNode } from '../../types';

interface Props {
  hierarchy: HierarchyNode[];
}

export function PositioningSection({ hierarchy }: Props) {
  if (hierarchy.length === 0) return null;

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-marker">#</span>
        <span>Позиционирование</span>
      </div>
      <div className="section-body">
        <div className="tree">
          {hierarchy.map((node, index) => {
            const indent = index === 0 ? '' : '\u00A0\u00A0'.repeat(index - 1) + '\u2514\u2500 ';

            const layoutParts: string[] = [];
            if (node.layoutInfo.direction) layoutParts.push(node.layoutInfo.direction);
            if (node.layoutInfo.wrap) layoutParts.push(node.layoutInfo.wrap);
            if (node.layoutInfo.gap) layoutParts.push(node.layoutInfo.gap);
            if (node.layoutInfo.counterAxisGap) layoutParts.push(node.layoutInfo.counterAxisGap);
            if (node.layoutInfo.alignItems) layoutParts.push(node.layoutInfo.alignItems);
            if (node.layoutInfo.justifyContent) layoutParts.push(node.layoutInfo.justifyContent);
            if (node.layoutInfo.paddingClasses) layoutParts.push(node.layoutInfo.paddingClasses);

            const sizingParts = [node.sizingH, node.sizingV].filter(Boolean);

            const label = node.isTarget ? `${node.cssName} [ЭТОТ ЭЛЕМЕНТ]` : node.cssName;
            const details = node.isTarget
              ? sizingParts.join(', ')
              : layoutParts.length > 0
                ? layoutParts.join(', ')
                : sizingParts.join(', ');

            return (
              <div key={index}>
                {indent}
                <span className={node.isTarget ? 'target' : ''}>
                  {label}
                </span>
                {details ? ` (${details})` : ''}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
