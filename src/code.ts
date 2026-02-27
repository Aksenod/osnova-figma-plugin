import { buildHierarchy, extractParentContext } from './modules/hierarchy';
import { extractCharacteristics, extractNodeTree } from './modules/extractor';
import { validateNode, validateDescendants } from './modules/validator';
import { buildAnalysisResult } from './modules/formatter';
import type { PluginMessage } from './types';

// Открываем UI
figma.showUI(__html__, { width: 420, height: 560, themeColors: true });

/**
 * Анализировать выбранную ноду.
 */
async function analyzeSelection(): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    const msg: PluginMessage = { type: 'no-selection' };
    figma.ui.postMessage(msg);
    return;
  }

  if (selection.length > 1) {
    const msg: PluginMessage = { type: 'multiple-selection', count: selection.length };
    figma.ui.postMessage(msg);
    return;
  }

  const node = selection[0];

  // Показываем загрузку
  const loadingMsg: PluginMessage = { type: 'loading' };
  figma.ui.postMessage(loadingMsg);

  try {
    // Собираем данные
    const hierarchy = buildHierarchy(node);
    const parentContext = extractParentContext(node);
    const characteristics = await extractCharacteristics(node);
    const nodeTree = await extractNodeTree(node);

    // Валидация самого узла + рекурсивно всех потомков
    const selfIssues = validateNode(node, characteristics, hierarchy);
    const childIssues = validateDescendants(node);
    const issues = [...selfIssues, ...childIssues];

    const result = buildAnalysisResult(node, issues, hierarchy, characteristics, nodeTree, parentContext);

    const msg: PluginMessage = { type: 'analysis-result', data: result };
    figma.ui.postMessage(msg);
  } catch (err) {
    console.error('ОСНОВА: ошибка анализа', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    const msg: PluginMessage = { type: 'error', message: errMsg };
    figma.ui.postMessage(msg);
  }
}

// Слушаем изменения выделения
figma.on('selectionchange', () => {
  analyzeSelection();
});

// Первый запуск
analyzeSelection();

// Сообщения от UI
figma.ui.onmessage = async (msg: { type: string; [key: string]: any }) => {
  if (msg.type === 'close') {
    figma.closePlugin();
  }

  if (msg.type === 'select-node') {
    const nodeId = msg.nodeId as string;
    if (!nodeId) return;
    const target = await figma.getNodeByIdAsync(nodeId);
    if (target && 'absoluteTransform' in target) {
      figma.currentPage.selection = [target as SceneNode];
      figma.viewport.scrollAndZoomIntoView([target as SceneNode]);
    }
  }

  if (msg.type === 'take-screenshot') {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1) return;

    try {
      const node = selection[0];
      const bytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 2 },
      });
      figma.ui.postMessage({
        type: 'screenshot-data',
        bytes: Array.from(bytes),
      });
    } catch (err) {
      console.error('ОСНОВА: ошибка скриншота', err);
      figma.ui.postMessage({ type: 'screenshot-error' });
    }
  }
};
