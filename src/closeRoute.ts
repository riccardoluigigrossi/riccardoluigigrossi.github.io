// Closing an overlay (PDF viewer, games) must NOT navigate to the empty "#"
// fragment — that makes the browser jump to the top of the page, losing the
// visitor's scroll position (especially jarring on mobile). The underlying page
// is scroll-locked via overflow:hidden, so it stays put; we just clear the hash
// route in place and let the router react.
export function closeRoute() {
  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );
  window.dispatchEvent(new Event('hashchange'));
}
