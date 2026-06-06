/**
 * Where loading copy (random phrases) is shown vs spinner-only.
 * Boot/login: AppBootFallback. Dashboard: widget LoadingPhrase / DataLoading with showPhrase.
 * Heavy pages: opt in via showPhrase on LoadingState / DataLoading.
 */

const LOADING_SHOW_PHRASE_BOOT = true;
export const LOADING_SHOW_PHRASE_DASHBOARD = true;
const LOADING_SHOW_PHRASE_HEAVY_PAGE = true;
