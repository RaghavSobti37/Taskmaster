/** BroadcastChannel for coordinated SW updates across tabs. */
export const SW_UPDATE_CHANNEL = 'coreknot-sw-update';

export function postSwUpdateMessage(type, payload = {}) {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(SW_UPDATE_CHANNEL);
  channel.postMessage({ type, ...payload });
  channel.close();
}

export function subscribeSwUpdateMessages(handler) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(SW_UPDATE_CHANNEL);
  channel.onmessage = (event) => handler(event.data);
  return () => channel.close();
}
