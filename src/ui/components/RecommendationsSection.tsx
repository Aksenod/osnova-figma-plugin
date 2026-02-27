import React from 'react';
import type { ValidationIssue } from '../../types';

interface Props {
  issues: ValidationIssue[];
}

function selectNode(nodeId?: string) {
  if (!nodeId) return;
  parent.postMessage({ pluginMessage: { type: 'select-node', nodeId } }, '*');
}

export function RecommendationsSection({ issues }: Props) {
  const infos = issues.filter(i => i.severity === 'info' && i.suggestion);

  if (infos.length === 0) return null;

  return (
    <div className="section">
      <div className="section-header static">
        <span className="section-marker">i</span>
        <span>Рекомендации</span>
        <span className="count">{infos.length}</span>
      </div>
      <div className="section-body">
        {infos.map((issue, i) => (
          <div
            key={i}
            className={`issue${issue.nodeId ? ' clickable' : ''}`}
            onClick={() => selectNode(issue.nodeId)}
          >
            <span className="icon"><span className="issue-dot info" /></span>
            <div className="body">
              {issue.suggestion}
              <span className="suggestion">
                {issue.nodeName}: {issue.message}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
