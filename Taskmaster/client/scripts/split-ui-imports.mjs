import fs from 'fs';
import path from 'path';

const root = path.resolve('src');
const modalNames = new Set([
  'NexusModal', 'Modal', 'MODAL_SIZES', 'ModalShell', 'ModalHeader', 'ModalBody',
  'ModalFooter', 'ModalOverlay', 'MODAL_WIDTH_PX', 'MODAL_PANEL_CLASS', 'MODAL_OVERLAY_CLASS',
  'getModalPanelStyle', 'getModalPanelClassName', 'CenteredModal', 'VisualExplainerModal',
]);
const chartNames = new Set(['DataMiniChart', 'ChartSurface', 'CHART_MUTED']);
const skip = new Set(['index.jsx', 'modals.jsx', 'charts.jsx', 'NexusModal.jsx', 'ModalShell.jsx']);

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(jsx|js)$/.test(ent.name) && !skip.has(ent.name)) processFile(p);
  }
}

function processFile(file) {
  let s = fs.readFileSync(file, 'utf8');
  const re = /import\s+\{([^}]+)\}\s+from\s+(['"])([^'"]*(?:\/ui|components\/ui))\2/g;
  let changed = false;
  s = s.replace(re, (full, specList, quote, base) => {
    const specs = specList.split(',').map((x) => x.trim()).filter(Boolean);
    const modals = [];
    const charts = [];
    const rest = [];
    for (const spec of specs) {
      const name = spec.split(/\s+as\s+/)[0].trim();
      if (modalNames.has(name)) modals.push(spec);
      else if (chartNames.has(name)) charts.push(spec);
      else rest.push(spec);
    }
    if (!modals.length && !charts.length) return full;
    changed = true;
    const modalPath = base.endsWith('/ui') ? `${base}/modals` : base.replace(/\/ui$/, '/ui/modals');
    const chartPath = base.endsWith('/ui') ? `${base}/charts` : base.replace(/\/ui$/, '/ui/charts');
    const lines = [];
    if (rest.length) lines.push(`import { ${rest.join(', ')} } from ${quote}${base}${quote};`);
    if (modals.length) lines.push(`import { ${modals.join(', ')} } from ${quote}${modalPath}${quote};`);
    if (charts.length) lines.push(`import { ${charts.join(', ')} } from ${quote}${chartPath}${quote};`);
    return lines.join('\n');
  });
  if (changed) {
    fs.writeFileSync(file, s);
    console.log('fixed', path.relative(root, file));
  }
}

walk(root);
