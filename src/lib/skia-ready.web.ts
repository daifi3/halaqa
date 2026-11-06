import { useEffect, useState } from 'react';

/**
 * Skia on web needs its CanvasKit WASM binary loaded before any <Canvas>
 * renders, or it throws "CanvasKit is not defined". Native Skia has no such
 * step (see the .ts sibling of this file). A dynamic import isn't enough to
 * keep canvaskit-wasm out of the native bundle — Metro still statically
 * resolves `import()` targets at bundle time — so this web-only loader lives
 * in its own `.web.ts` file, which Metro's native bundler never even parses.
 */
export function useSkiaReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    import('@shopify/react-native-skia/lib/module/web')
      .then(({ LoadSkiaWeb }) => LoadSkiaWeb())
      .catch((e) => console.warn('Could not load CanvasKit for the web whiteboard', e))
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}
