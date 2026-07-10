/** When true, global shortcut handler ignores keys (settings recorder active). */
let recordingActive = false;

export function setShortcutRecordingActive(active) {
  recordingActive = active;
}

export function isShortcutRecordingActive() {
  return recordingActive;
}
