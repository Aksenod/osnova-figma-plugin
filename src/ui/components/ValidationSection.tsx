import React from 'react';
import type { ValidationIssue } from '../../types';

interface Props {
  issues: ValidationIssue[];
}

const severityDotClass: Record<string, string> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

function selectNode(nodeId?: string) {
  if (!nodeId) return;
  parent.postMessage({ pluginMessage: { type: 'select-node', nodeId } }, '*');
}

export function ValidationSection({ issues }: Props) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const problems = [...errors, ...warnings];

  if (problems.length === 0) return null;

  return (
    <div className="section">
      <div className="section-header static">
        <span className="section-marker">!</span>
        <span>Проблемы</span>
        <span className="count">{problems.length}</span>
      </div>
      <div className="section-body">
        {problems.map((issue, i) => (
          <div
            key={i}
            className={`issue${issue.nodeId ? ' clickable' : ''}`}
            onClick={() => selectNode(issue.nodeId)}
          >
            <span className="icon"><span className={`issue-dot ${severityDotClass[issue.severity]}`} /></span>
            <div className="body">
              <span className="node-name">{issue.nodeName}</span>
              {' — '}
              {issue.message}
              {issue.suggestion && (
                <span className="suggestion">{issue.suggestion}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
