import { useEffect, useState } from "react";
import type { Observable } from "rxjs";

// Tiny reactive bridge for WatermelonDB observables: subscribes and holds the
// latest emitted value. Avoids pulling in @nozbe/watermelondb/react HOCs just
// to read a live collection. Unsubscribes on unmount.
export function useObservable<T>(observable: Observable<T> | null, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    if (!observable) return;
    const sub = observable.subscribe((v) => setValue(v));
    return () => sub.unsubscribe();
  }, [observable]);
  return value;
}
