import React, { useState, useEffect, useCallback } from 'react';
import type { PluginMessage, AnalysisResult } from '../types';
import { ValidationSection } from './components/ValidationSection';
import { PositioningSection } from './components/PositioningSection';
import { CharacteristicsSection } from './components/CharacteristicsSection';
import { RecommendationsSection } from './components/RecommendationsSection';

type UIState =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'multiple'; count: number }
  | { kind: 'error'; message: string }
  | { kind: 'result'; data: AnalysisResult };

export function App() {
  const [state, setState] = useState<UIState>({ kind: 'empty' });
  const [copied, setCopied] = useState(false);
  const [includeLayerNames, setIncludeLayerNames] = useState(false);
  const [rootSizing, setRootSizing] = useState<'auto' | 'fill' | 'hug'>('auto');
  const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'loading' | 'copied' | 'downloaded'>('idle');

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'no-selection':
          setState({ kind: 'empty' });
          break;
        case 'multiple-selection':
          setState({ kind: 'multiple', count: msg.count });
          break;
        case 'loading':
          setState({ kind: 'loading' });
          break;
        case 'error':
          setState({ kind: 'error', message: msg.message });
          break;
        case 'analysis-result':
          setState({ kind: 'result', data: msg.data });
          break;
        case 'screenshot-data':
          processScreenshot(msg.bytes);
          break;
        case 'screenshot-error':
          setScreenshotStatus('idle');
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleScreenshot = useCallback(() => {
    setScreenshotStatus('loading');
    parent.postMessage({ pluginMessage: { type: 'take-screenshot' } }, '*');
  }, []);

  const processScreenshot = useCallback(async (bytes: number[]) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });

    // Пытаемся скопировать в буфер обмена
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setScreenshotStatus('copied');
    } catch {
      // Fallback — скачиваем файл
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = state.kind === 'result' ? state.data.nodeName : 'screenshot';
      a.download = `${name}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setScreenshotStatus('downloaded');
    }

    setTimeout(() => setScreenshotStatus('idle'), 1500);
  }, [state]);

  const handleCopy = useCallback(() => {
    if (state.kind !== 'result') return;

    let output = state.data.formattedOutput;

    // Вставляем оригинальные имена слоёв в секцию ПОЗИЦИОНИРОВАНИЕ
    if (includeLayerNames && state.data.hierarchy.length > 0) {
      for (const node of state.data.hierarchy) {
        if (!node.isTarget && node.cssName !== `.${node.name}`) {
          output = output.replace(
            node.cssName + ' (',
            `${node.cssName} "${node.name}" (`
          );
        }
      }
      // Инструкция для AI — строго использовать имена слоёв как CSS-классы
      output = `ВАЖНО: Используй имена слоёв из макета как CSS-классы (class="имя-слоя"). Не придумывай свои имена — строго бери из описания.\n\n` + output;
    }

    // Подмена sizing корневого элемента
    if (rootSizing !== 'auto') {
      const sizeLabel = rootSizing; // 'fill' | 'hug'
      const newSizeDesc = `width: ${sizeLabel}, height: ${sizeLabel}`;
      const newSizingClasses = rootSizing === 'fill' ? 'w-full h-full' : 'w-auto h-auto';

      // 1. Size: ... в секции ОБЪЕКТ
      output = output.replace(/^Size: .+$/m, `Size: ${newSizeDesc}`);

      // 2. Tailwind: ... в секции ОБЪЕКТ — заменить или дополнить sizing-классы
      const origSizing = state.data.nodeTree.sizingClasses;
      output = output.replace(/^(Tailwind: )(.+)$/m, (_match, prefix: string, classes: string) => {
        if (origSizing) {
          return prefix + classes.replace(origSizing, newSizingClasses);
        }
        return prefix + classes + ' ' + newSizingClasses;
      });

      // 3. Размер: ... в секции ХАРАКТЕРИСТИКИ
      output = output.replace(/^Размер: .+$/m, `Размер: ${sizeLabel} × ${sizeLabel}`);
    }

    const textarea = document.createElement('textarea');
    textarea.value = output;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [state, includeLayerNames, rootSizing]);

  // ─── Пустое состояние ───
  if (state.kind === 'empty') {
    return (
      <div className="app">
        <Header />
        <div className="content">
          <div className="empty-state">
            <div className="icon">[ ]</div>
            <h2>Выдели элемент</h2>
            <p>Выбери любой элемент на канвасе, чтобы увидеть его спецификации и Tailwind-классы</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Ошибка ───
  if (state.kind === 'error') {
    return (
      <div className="app">
        <Header />
        <div className="content">
          <div className="empty-state">
            <div className="icon">[!]</div>
            <h2>Ошибка анализа</h2>
            <p>{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Загрузка ───
  if (state.kind === 'loading') {
    return (
      <div className="app">
        <Header />
        <div className="content">
          <div className="loading">
            <span className="spinner" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Множественное выделение ───
  if (state.kind === 'multiple') {
    return (
      <div className="app">
        <Header />
        <div className="content">
          <div className="empty-state">
            <div className="icon">[x]</div>
            <h2>Выделено {state.count} элементов</h2>
            <p>Выдели один элемент для анализа. Множественное выделение пока не поддерживается.</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Результат ───
  const { data } = state;
  const hasProblems = data.validationIssues.some(
    i => i.severity === 'error' || i.severity === 'warning'
  );

  return (
    <div className="app">
      <Header nodeName={data.nodeName} nodeType={data.nodeType} />
      <div className="content">
        <ValidationSection issues={data.validationIssues} />
        <PositioningSection hierarchy={data.hierarchy} />
        <CharacteristicsSection
          characteristics={data.characteristics}
          nodeType={data.nodeType}
        />
        <RecommendationsSection issues={data.validationIssues} />
      </div>
      <div className="copy-bar">
        <div className="radio-group">
          <span className="radio-group-label">Sizing</span>
          <div className="radio-options">
            {(['auto', 'fill', 'hug'] as const).map((value) => (
              <label key={value} className={`radio-option${rootSizing === value ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="rootSizing"
                  value={value}
                  checked={rootSizing === value}
                  onChange={() => setRootSizing(value)}
                />
                {value === 'auto' ? 'Как в макете' : value === 'fill' ? 'Fill' : 'Hug'}
              </label>
            ))}
          </div>
        </div>
        <div className="toggle-row">
          <span className="toggle-label">Имена слоёв в промпте</span>
          <input
            type="checkbox"
            className="toggle-switch"
            checked={includeLayerNames}
            onChange={(e) => setIncludeLayerNames(e.target.checked)}
          />
        </div>
        <div className="btn-row">
          <button
            className={`copy-btn primary ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            disabled={hasProblems}
            title={hasProblems ? 'Исправьте проблемы перед копированием' : undefined}
          >
            {copied ? '\u2713 Скопировано!' : hasProblems ? 'Есть проблемы' : 'Скопировать промпт'}
          </button>
          <button
            className={`copy-btn secondary ${screenshotStatus === 'copied' || screenshotStatus === 'downloaded' ? 'copied' : ''}`}
            onClick={handleScreenshot}
            disabled={screenshotStatus === 'loading'}
          >
            {screenshotStatus === 'loading' ? '...' :
             screenshotStatus === 'copied' ? '\u2713' :
             screenshotStatus === 'downloaded' ? '\u2193' : 'PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Header ───

function Header({ nodeName, nodeType }: { nodeName?: string; nodeType?: string }) {
  return (
    <div className="header">
      <h1>Основа</h1>
      {nodeName && (
        <span className="badge">{nodeType?.toLowerCase()} — {nodeName && nodeName.length > 25 ? nodeName.substring(0, 25) + '...' : nodeName}</span>
      )}
    </div>
  );
}
