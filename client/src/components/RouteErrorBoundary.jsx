import React from 'react';
import AppErrorPage from './AppErrorPage';
import { buildRouteErrorReference } from '../utils/routeErrorPresentation';
import { hardReloadApp } from '../utils/chunkRecovery';

export { canGoBackInHistory } from '../utils/historyNavigation';

export function RouteErrorFallback({ error, errorRef, onReload, capturedAt }) {
  return (
    <AppErrorPage
      error={error}
      errorRef={errorRef}
      capturedAt={capturedAt}
      onRetry={onReload}
      className="min-h-[calc(100dvh-6rem)]"
    />
  );
}

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorRef: null, capturedAt: null };
  }

  static getDerivedStateFromError(error) {
    const capturedAt = Date.now();
    return {
      error,
      errorRef: buildRouteErrorReference(error, capturedAt),
      capturedAt,
    };
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null, errorRef: null, capturedAt: null });
    void hardReloadApp();
  };

  render() {
    if (this.state.error) {
      return (
        <RouteErrorFallback
          error={this.state.error}
          errorRef={this.state.errorRef}
          capturedAt={this.state.capturedAt}
          onReload={this.handleReload}
        />
      );
    }
    return this.props.children;
  }
}
