import { useEffect, useState } from 'react';

/**
 * Agentation floating annotate button — local dev only.
 * Loaded via React.lazy from main.jsx when __AGENTATION_ENABLED__ is true.
 */
export default function AgentationDev() {
  const [Agentation, setAgentation] = useState(null);

  useEffect(() => {
    if (!__AGENTATION_ENABLED__) return;
    import('agentation').then((mod) => setAgentation(() => mod.Agentation));
  }, []);

  if (!Agentation) return null;

  // localStorage-only by default — no :4747 MCP server required for normal dev.
  // Set VITE_AGENTATION_ENDPOINT=http://localhost:4747 when agentation-mcp is running.
  const endpoint = import.meta.env.VITE_AGENTATION_ENDPOINT?.trim();

  return (
    <Agentation
      {...(endpoint
        ? {
            endpoint,
            onSessionCreated: (sessionId) => {
              console.info('[Agentation] session started:', sessionId);
            },
          }
        : {})}
    />
  );
}
