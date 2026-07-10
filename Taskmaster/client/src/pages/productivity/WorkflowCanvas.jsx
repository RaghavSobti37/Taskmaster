import React, { useState, useCallback } from 'react';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Plus, Zap, Filter, Send, Settings, RefreshCw, Layers } from 'lucide-react';
import { PageContainer, PageHeader, Button, Badge } from '../../components/ui';
import QueryErrorBanner from '../../components/ui/QueryErrorBanner';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Event: New Lead Captured' },
    position: { x: 250, y: 50 },
    style: { background: 'var(--color-bg-surface)', color: 'var(--color-pastel-blue-text)', border: '1px solid var(--color-pastel-blue-text)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '11px', fontWeight: 'bold' }
  },
  {
    id: '2',
    data: { label: 'Filter: High Intent / Campaign Lead' },
    position: { x: 250, y: 175 },
    style: { background: 'var(--color-bg-surface)', color: 'var(--color-pastel-apricot-text)', border: '1px solid var(--color-pastel-apricot-text)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '11px', fontWeight: 'bold' }
  },
  {
    id: '3',
    type: 'output',
    data: { label: 'Action: Send Email Campaign' },
    position: { x: 250, y: 300 },
    style: { background: 'var(--color-bg-surface)', color: 'var(--color-pastel-mint-text)', border: '1px solid var(--color-pastel-mint-text)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '11px', fontWeight: 'bold' }
  }
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: 'var(--color-pastel-blue-text)' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: 'var(--color-pastel-mint-text)' } }
];

const WorkflowCanvas = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [baselineFlow, setBaselineFlow] = useState(() => ({
    nodes: cloneSnapshot(initialNodes),
    edges: cloneSnapshot(initialEdges),
  }));
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: 'var(--color-pastel-blue-text)' } }, eds)), [setEdges]);

  const addNode = (type, label, color, border) => {
    const newNode = {
      id: `${Date.now()}`,
      data: { label },
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      style: { background: 'var(--color-bg-surface)', color, border: `1px solid ${border}`, borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '11px', fontWeight: 'bold' }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      setBaselineFlow({ nodes: cloneSnapshot(nodes), edges: cloneSnapshot(edges) });
      setSaving(false);
    }, 800);
  };

  const handleRunPipeline = async () => {
    setRunning(true);
    setTimeout(() => setRunning(false), 1200);
  };

  const hasFlowChanges = !stableJsonEqual({ nodes, edges }, baselineFlow);

  useUnsavedChanges({
    hasChanges: hasFlowChanges,
    onSave: handleSave,
    onCancel: () => {
      setNodes(cloneSnapshot(baselineFlow.nodes));
      setEdges(cloneSnapshot(baselineFlow.edges));
    },
    isSaving: saving,
  });

  return (
    <PageContainer className="!py-4 !space-y-4 !h-[90vh] flex flex-col">
      <PageHeader
        title="Workflow Builder"
        actions={
          <div className="flex items-center gap-2">
            <Button size="xs" variant="primary" onClick={handleRunPipeline} disabled title="Workflow execution is not connected to the server yet">
              <Play size={12} className="mr-1" /> Execute Workflow
            </Button>
          </div>
        }
      />

      <QueryErrorBanner
        message="Preview mode — workflow automation is not connected to the server yet. Canvas changes stay in this browser session only."
        className="!mb-0 border-amber-500/30 bg-amber-500/10 [&_span]:text-amber-800 dark:[&_span]:text-amber-200"
      />

      <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] p-2 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] overflow-x-auto custom-scrollbar">
        <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-wider px-2 flex items-center gap-1.5">
          <Layers size={14} className="text-[var(--color-action-primary)]" /> Toolbox:
        </span>
        <Button size="xs" variant="ghost" className="text-[var(--color-pastel-blue-text)] hover:bg-[var(--color-pastel-blue-bg)]" onClick={() => addNode('input', 'Event: Webhook / Realtime Trigger', 'var(--color-pastel-blue-text)', 'var(--color-pastel-blue-text)')}>
          <Zap size={12} className="mr-1" /> Add Trigger
        </Button>
        <Button size="xs" variant="ghost" className="text-[var(--color-pastel-apricot-text)] hover:bg-[var(--color-pastel-apricot-bg)]" onClick={() => addNode('default', 'Condition: Attribute Match', 'var(--color-pastel-apricot-text)', 'var(--color-pastel-apricot-text)')}>
          <Filter size={12} className="mr-1" /> Add Filter
        </Button>
        <Button size="xs" variant="ghost" className="text-[var(--color-pastel-mint-text)] hover:bg-[var(--color-pastel-mint-bg)]" onClick={() => addNode('output', 'Action: Run Background Task', 'var(--color-pastel-mint-text)', 'var(--color-pastel-mint-text)')}>
          <Send size={12} className="mr-1" /> Add Action
        </Button>
      </div>

      <div className="flex-1 w-full min-h-[min(70dvh,640px)] lg:min-h-[600px] bg-[var(--color-bg-secondary)]/30 rounded-[var(--radius-lg)] border border-[var(--color-bg-border)] overflow-hidden relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          className="bg-[var(--color-bg-primary)]"
        >
          <Controls className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]" />
          <MiniMap nodeStrokeColor="var(--color-action-primary)" nodeColor="var(--color-bg-secondary)" maskColor="rgba(8, 61, 58, 0.08)" className="bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]" />
          <Background variant="dots" gap={16} size={1} color="var(--color-bg-border)" />
        </ReactFlow>

        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-[var(--color-bg-surface)]/95 border border-[var(--color-bg-border)] px-3 py-1.5 rounded-[var(--radius-md)] text-[10px] font-mono text-[var(--color-text-muted)]">
          <Badge variant="slate" className="text-[9px]">Local preview</Badge>
          <span>Nodes: {nodes.length}</span>
          <span>•</span>
          <span>Edges: {edges.length}</span>
          <span>•</span>
          <span className="text-[var(--color-text-muted)] flex items-center gap-1">Local canvas only</span>
        </div>
      </div>
    </PageContainer>
  );
};

export default WorkflowCanvas;
