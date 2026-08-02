import { useSyncExternalStore } from "react";

// `navigator.onLine` only knows whether the machine has *a* network, not
// whether the API is reachable — a captive wifi reports online. It is still the
// right signal for the banner: it catches the common case instantly and costs
// nothing, and a genuinely unreachable API surfaces as a request error, which
// the views already render.

function subscribe(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
