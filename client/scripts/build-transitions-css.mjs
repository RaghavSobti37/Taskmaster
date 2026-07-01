import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(__dirname, '../../../../.agents/skills/transitions-dev');
const out = path.resolve(__dirname, '../src/styles/transitions.css');

const root = fs.readFileSync(path.join(skillDir, '_root.css'), 'utf8');
const files = fs.readdirSync(skillDir).filter((f) => /^\d{2}-/.test(f)).sort();

let css = `${root}\n\n/* ── Transition snippets (transitions.dev) ── */\n`;
for (const f of files) {
  const md = fs.readFileSync(path.join(skillDir, f), 'utf8');
  const m = md.match(/## CSS\s+```css\s+([\s\S]*?)```/);
  if (m) css += `\n/* ${f} */\n${m[1]}\n`;
}

css += `
.dark {
  --tabs-text-muted: rgba(255, 255, 255, 0.65);
  --tabs-text-active: #f1f5f9;
  --tabs-bar-bg: rgba(255, 255, 255, 0.06);
  --tabs-pill-bg: rgba(255, 255, 255, 0.1);
  --shimmer-base: #64748b;
  --shimmer-highlight: #e2e8f0;
  --tt-bg: var(--global-surface-3, #1e293b);
  --tt-fg: #e2e8f0;
}

/* Backdrop fade for modal overlay */
.t-modal-backdrop {
  opacity: 0;
  transition: opacity var(--modal-open-dur) var(--modal-ease);
}
.t-modal-backdrop.is-open {
  opacity: 1;
}
.t-modal-backdrop.is-closing {
  opacity: 0;
  transition: opacity var(--modal-close-dur) var(--modal-ease);
}

@media (prefers-reduced-motion: reduce) {
  .t-modal-backdrop { transition: none !important; }
}
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, css);
console.log('Wrote', out, css.length, 'chars');
