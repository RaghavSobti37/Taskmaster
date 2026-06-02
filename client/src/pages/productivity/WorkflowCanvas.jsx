import React, { useState, useCallback } from 'react';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Plus, Zap, Filter, Send, Settings, RefreshCw, Layers } from 'lucide-react';
import { PageContainer, PageHeader, Button, Card, Badge } from '../../components/ui';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Event: New Lead Captured' },
    position: { x: 250, y: 50 },
    style: { background: '#111827', color: '#60A5FA', border: '1px solid #3B82F6', borderRadius: '8px', padding: '12px', fontSize: '11px', fontWeight: 'bold' }
  },
  {
    id: '2',
    data: { label: 'Filter: High Intent / Campaign Lead' },
    position: { x: 250, y: 175 },
    style: { background: '#111827', color: '#FBBF24', border: '1px solid #F59E0B', borderRadius: '8px', padding: '12px', fontSize: '11px', fontWeight: 'bold' }
  },
  {
    id: '3',
    type: 'output',
    data: { label: 'Action: Send Email Campaign' },
    position: { x: 250, y: 300 },
    style: { background: '#111827', color: '#34D399', border: '1px solid #10B981', borderRadius: '8px', padding: '12px', fontSize: '11px', fontWeight: 'bold' }
  }
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#60A5FA' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#34D399' } }
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

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#60A5FA' } }, eds)), [setEdges]);

  const addNode = (type, label, color, border) => {
    const newNode = {
      id: `${Date.now()}`,
      data: { label },
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      style: { background: '#111827', color, border: `1px solid ${border}`, borderRadius: '8px', padding: '12px', fontSize: '11px', fontWeight: 'bold' }
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
        subtitle="Build automated background workflows and email campaigns."
        actions={
          <div className="flex items-center gap-2">
            <Button size="xs" variant="primary" onClick={handleRunPipeline} disabled={running}>
              {running ? <RefreshCw size={12} className="animate-spin mr-1" /> : <Play size={12} className="mr-1" />} Execute Workflow
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] p-2 rounded-xl border border-[var(--color-bg-border)] shadow-md">
        <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-wider px-2 flex items-center gap-1.5">
          <Layers size={14} className="text-blue-500" /> Toolbox:
        </span>
        <Button size="xs" variant="ghost" className="text-blue-400 hover:bg-blue-500/10" onClick={() => addNode('input', 'Event: Webhook / Realtime Trigger', '#60A5FA', '#3B82F6')}>
          <Zap size={12} className="mr-1" /> Add Trigger
        </Button>
        <Button size="xs" variant="ghost" className="text-amber-400 hover:bg-amber-500/10" onClick={() => addNode('default', 'Condition: Attribute Match', '#FBBF24', '#F59E0B')}>
          <Filter size={12} className="mr-1" /> Add Filter
        </Button>
        <Button size="xs" variant="ghost" className="text-emerald-400 hover:bg-emerald-500/10" onClick={() => addNode('output', 'Action: Run Background Task', '#34D399', '#10B981')}>
          <Send size={12} className="mr-1" /> Add Action
        </Button>
      </div>

      <div className="flex-1 w-full bg-[var(--color-bg-secondary)]/30 rounded-2xl border border-[var(--color-bg-border)] overflow-hidden relative shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          className="bg-slate-950/80"
        >
          <Controls className="bg-slate-900 border border-white/10 fill-white text-white" />
          <MiniMap nodeStrokeColor="#3B82F6" nodeColor="#1E293B" maskColor="rgba(15, 23, 42, 0.8)" className="bg-slate-900 border border-white/10" />
          <Background variant="dots" gap={16} size={1} color="rgba(255,255,255,0.15)" />
        </ReactFlow>

        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-slate-900/90 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-mono text-slate-400 backdrop-blur-sm">
          <Badge variant="slate" className="text-[9px]">Active Canvas</Badge>
          <span>Nodes: {nodes.length}</span>
          <span>•</span>
          <span>Edges: {edges.length}</span>
          <span>•</span>
          <span className="text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Realtime Active</span>
        </div>
      </div>
    </PageContainer>
  );
};

export default WorkflowCanvas;
