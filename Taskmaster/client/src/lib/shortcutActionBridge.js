/** Lets KeyboardShortcutsContext trigger QuickAdd without nesting providers */

let quickActionHandler = null;

export function setShortcutQuickActionHandler(handler) {
  quickActionHandler = handler;
}

export function invokeShortcutQuickAction(id) {
  if (quickActionHandler) quickActionHandler(id);
}
