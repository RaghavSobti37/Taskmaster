import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RefreshCw, FileText, Layers, Share2 } from 'lucide-react';
import { Card, Button, Badge } from './primitives';
import DOMPurify from 'dompurify';

const sanitizeHtml = (html) => {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'svg', 'path', 'g', 'rect', 'circle', 'text', 'line', 'polygon', 'polyline', 'style'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'class', 'style', 'id', 'width', 'height', 'viewBox', 'fill', 'stroke', 'd', 'transform', 'x', 'y', 'cx', 'cy', 'r', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
  });
};

let mermaidReady;

async function renderMermaidDiagram(source) {
  if (!mermaidReady) {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Geist, sans-serif',
    });
    mermaidReady = mermaid;
  }
  const id = `mermaid-svg-${Date.now()}`;
  const { svg } = await mermaidReady.render(id, source);
  return svg;
}

export const VisualExplainerModal = ({ isOpen, onClose, title = 'Visual Explainer', data }) => {
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [activeTab, setActiveTab] = useState('diagram');
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!isOpen || !data?.mermaid || activeTab !== 'diagram') return undefined;
    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const svg = await renderMermaidDiagram(data.mermaid);
        if (!cancelled) setSvgContent(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (!cancelled) {
          setSvgContent('<div className="p-4 text-rose-500 text-xs font-mono">Failed to render architecture diagram. Verify syntax.</div>');
        }
      }
    };

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [isOpen, data, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="tm-modal-overlay fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
      <Card className="tm-modal-panel max-w-5xl h-[85vh] bg-[var(--color-bg-workspace)] border-white/10 flex flex-col overflow-hidden shadow-2xl" role="dialog" aria-modal="true">
        <div className="px-6 py-4 border-b border-white/10 bg-[var(--color-bg-secondary)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide flex items-center gap-2">{title}</h2>
              <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase font-mono">{data?.subtitle || 'System Diagram & Overview'}</p>
            </div>
            <Badge variant="mint" className="ml-2 font-mono">System Flow</Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white/5 p-1 rounded-lg flex items-center gap-1 border border-white/10 mr-2">
              <Button size="xs" variant={activeTab === 'diagram' ? 'primary' : 'ghost'} onClick={() => setActiveTab('diagram')}>
                Diagram
              </Button>
              <Button size="xs" variant={activeTab === 'report' ? 'primary' : 'ghost'} onClick={() => setActiveTab('report')}>
                Overview
              </Button>
            </div>

            {activeTab === 'diagram' && (
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 mr-2">
                <Button size="xs" variant="ghost" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}><ZoomOut size={12} /></Button>
                <span className="text-[10px] font-mono px-2 text-slate-300">{Math.round(scale * 100)}%</span>
                <Button size="xs" variant="ghost" onClick={() => setScale((s) => Math.min(2, s + 0.1))}><ZoomIn size={12} /></Button>
                <Button size="xs" variant="ghost" onClick={() => setScale(1)}><RefreshCw size={12} /></Button>
              </div>
            )}

            <Button size="sm" variant="ghost" onClick={onClose}><X size={16} /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 flex items-center justify-center relative bg-slate-950/50">
          {activeTab === 'diagram' ? (
            <div
              ref={containerRef}
              style={{ transform: `scale(${scale})`, transition: 'transform 0.2s ease' }}
              className="w-full h-full flex items-center justify-center cursor-move select-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(svgContent) || '<div className="text-xs text-slate-500">Generating diagram...</div>' }}
            />
          ) : (
            <div className="max-w-3xl w-full space-y-6 text-slate-200 text-xs self-start my-auto">
              <div className="p-6 bg-slate-900/80 rounded-xl border border-white/10 space-y-4 shadow-xl">
                <h3 className="text-sm font-black text-white border-b border-white/10 pb-2 flex items-center gap-2">
                  <FileText size={16} className="text-blue-400" /> System Overview
                </h3>
                <div className="space-y-2 leading-relaxed text-slate-300" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data?.reportHtml) || '<p>No structured report available.</p>' }} />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-white/10 bg-[var(--color-bg-secondary)]/50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>System Flow & Activity Visualizer</span>
          <Button size="xs" variant="ghost" className="hover:text-white" onClick={() => navigator.clipboard.writeText(data?.mermaid || '')}>
            <Share2 size={12} className="mr-1.5" /> Copy Diagram Code
          </Button>
        </div>
      </Card>
    </div>
  );
};
