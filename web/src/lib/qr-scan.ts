import jsQR from 'jsqr';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from './api';
import { parseJoinLink, type JoinKind } from './links';

/** Native BarcodeDetector where the browser has one (Chrome, Edge, Android), jsQR everywhere else. */
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const NativeDetector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;

export type CameraState = 'idle' | 'asking' | 'on' | 'denied' | 'none';

/** Reads a QR code from whatever is drawn on the canvas. */
function readCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, invert: boolean) {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: invert ? 'attemptBoth' : 'dontInvert' })?.data ?? null;
}

/**
 * Turns the camera on into `video` while `active`, and calls `onResult` with every QR
 * payload it sees (many times a second while one is in view — callers ignore repeats).
 */
export function useQrScanner(video: RefObject<HTMLVideoElement | null>, active: boolean, onResult: (data: string) => void) {
  const [camera, setCamera] = useState<CameraState>(active ? 'asking' : 'idle');
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  useEffect(() => {
    if (!active) {
      setCamera('idle');
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const detector = NativeDetector ? new NativeDetector({ formats: ['qr_code'] }) : null;
    let detecting = false;

    async function tick() {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && !detecting) {
        detecting = true;
        try {
          if (detector) {
            const [hit] = await detector.detect(v);
            if (hit) onResultRef.current(hit.rawValue);
          } else if (ctx) {
            // Scan a downscaled frame: plenty for a QR held up to the camera, and cheap.
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = v.videoWidth * scale;
            canvas.height = v.videoHeight * scale;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const hit = readCanvas(canvas, ctx, false);
            if (hit) onResultRef.current(hit);
          }
        } catch {
          // A frame that can't be read — try the next one.
        }
        detecting = false;
      }
      raf = requestAnimationFrame(() => void tick());
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('none');
      return;
    }
    setCamera('asking');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => {});
        }
        setCamera('on');
        void tick();
      })
      .catch((e: unknown) => setCamera(e instanceof DOMException && e.name === 'NotFoundError' ? 'none' : 'denied'));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, video]);

  return camera;
}

/** Reads a QR code from a picture (a screenshot or a photo of the teacher's screen). */
export async function decodeQrImage(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    if (NativeDetector) {
      const [hit] = await new NativeDetector({ formats: ['qr_code'] }).detect(bitmap);
      if (hit) return hit.rawValue;
    }
    // Large photos are scaled down: QR finders work best around 1000px.
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return readCanvas(canvas, ctx, true);
  } finally {
    bitmap.close();
  }
}

export class NotAnInvite extends Error {
  constructor() {
    super('That QR code isn’t a Halaqa invite.');
  }
}

/** Joins the class or course a scanned QR points to, and returns the page to open. */
export async function joinScanned(data: string): Promise<{ kind: JoinKind; path: string }> {
  const link = parseJoinLink(data);
  if (!link) throw new NotAnInvite();
  if (link.kind === 'course') return { kind: 'course', path: `/course/${(await api.joinCourseByCode(link.code)).id}` };
  return { kind: 'room', path: `/room/${(await api.joinByCode(link.code)).id}` };
}
