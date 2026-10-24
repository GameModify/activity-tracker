import { readCollectorDiagnostics } from './collector-diagnostics.ts';
import { element } from './ui.ts';
export async function renderDiagnostics(): Promise<void> {
  const items = await readCollectorDiagnostics();
  element('version', HTMLSpanElement).textContent = chrome.runtime.getManifest().version;
  const rows = items.map(diagnosticRow);
  const list = element('diagnostics', HTMLUListElement);
  list.replaceChildren(...rows);
  if (!items.length) list.textContent = 'Ошибок сборщика не зарегистрировано.';
}

function diagnosticRow(
  item: Awaited<ReturnType<typeof readCollectorDiagnostics>>[number],
): HTMLLIElement {
  const row = document.createElement('li');
  row.textContent =
    new Date(item.timestamp).toLocaleString('ru-RU') +
    ' · ' +
    item.version +
    ' · ' +
    item.origin +
    '\n' +
    item.script +
    ':' +
    String(item.line) +
    ':' +
    String(item.column) +
    '\n' +
    item.message;
  return row;
}
