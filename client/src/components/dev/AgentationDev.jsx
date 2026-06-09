import { useEffect, useState } from 'react';

/**
 * Agentation floating annotate button — local dev only.
 * Loaded via React.lazy from main.jsx when import.meta.env.DEV is true.
 */
export default function AgentationDev() {
  const [Agentation, setAgentation] = useState(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import('agentation').then((mod) => setAgentation(() => mod.Agentation));
  }, []);

  if (!Agentation) return null;

  return (
    <Agentation
      endpoint="http://localhost:4747"
      onSessionCreated={(sessionId) => {
        console.info('[Agentation] session started:', sessionId);
      }}
    />
  );
}
