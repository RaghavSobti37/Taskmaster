import { createContext } from 'react';

/** Singleton context — separate module so lazy chunks share the same provider instance. */
export const KeyboardShortcutsContext = createContext(null);
