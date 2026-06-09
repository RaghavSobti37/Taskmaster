import { Agentation } from 'agentation';

export default function AgentationDev() {
  if (!import.meta.env.DEV) return null;

  return (
    <Agentation
      endpoint="http://localhost:4747"
      onSessionCreated={(sessionId) => {
        console.info('[Agentation] session started:', sessionId);
      }}
    />
  );
}
