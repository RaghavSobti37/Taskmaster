/**
 * Barrel re-export — domain hooks live in ./queries/*.js
 * @see client/src/hooks/queries/
 */
export * from './queries';
export { useStatusCounts } from './useStatusCounts';
export { useShortcutPreferences, SHORTCUT_PREFERENCES_QUERY_KEY } from './useShortcutPreferences';
