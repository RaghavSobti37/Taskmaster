import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/primitives';
import { hardReloadApp } from '../utils/chunkRecovery';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    void hardReloadApp();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-4">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-lg font-black text-[var(--color-text-primary)] mb-2">Something went wrong</h1>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mb-6">
            This page hit an unexpected error. Reload to recover. If it keeps happening, contact your admin.
          </p>
          <Button onClick={this.handleReload} className="gap-2">
            <RefreshCw size={14} />
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
