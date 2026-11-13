import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Text } from '@/components/ui/text';

/** Pinned pdf.js build. The legacy build carries polyfills for older Android System WebViews. */
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build';

type Message = { type: 'loaded'; pages: number } | { type: 'page'; page: number } | { type: 'error'; message: string };

/**
 * Android's WebView can't display PDFs by itself, so the pages are drawn with pdf.js.
 * The page is loaded with the file's own origin as base URL, so pdf.js can fetch the
 * file without the backend needing CORS headers. Pages are drawn as they scroll into
 * view and dropped again far off-screen, so long documents stay light on memory.
 */
function pdfJsPage(url: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes">
<style>
  html, body { margin: 0; background: #1b1a22; }
  #pages { display: flex; flex-direction: column; gap: 10px; padding: 10px 8px 40px; }
  .page { position: relative; width: 100%; background: #fff; border-radius: 4px; overflow: hidden; }
  .page canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="pages"></div>
<script type="module">
  const post = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  try {
    const pdfjsLib = await import('${PDFJS}/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.mjs';
    // isEvalSupported: false — never compile code out of a (possibly hostile) PDF's fonts.
    const pdf = await pdfjsLib.getDocument({ url: ${JSON.stringify(url)}, isEvalSupported: false }).promise;
    const container = document.getElementById('pages');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const slots = [];

    const draw = (slot) => {
      if (slot.canvas) return;
      // Render sharper than the screen so pinch-zoom stays readable.
      const scale = (slot.div.clientWidth * dpr * 1.5) / slot.vp.width;
      const viewport = slot.page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      slot.div.appendChild(canvas);
      slot.canvas = canvas;
      slot.task = slot.page.render({ canvasContext: canvas.getContext('2d'), viewport });
      slot.task.promise.catch(() => {});
    };
    const drop = (slot) => {
      if (!slot.canvas) return;
      slot.task?.cancel();
      slot.canvas.remove();
      slot.canvas = null;
      slot.task = null;
    };

    const bySlot = new Map();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const slot = bySlot.get(e.target);
        if (e.isIntersecting) draw(slot); else drop(slot);
      }
    }, { rootMargin: '150% 0px' });

    // Lay pages out one by one, so the first one shows before the rest are measured.
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const div = document.createElement('div');
      div.className = 'page';
      div.style.aspectRatio = vp.width + ' / ' + vp.height;
      container.appendChild(div);
      const slot = { n, page, vp, div, canvas: null, task: null };
      slots.push(slot);
      bySlot.set(div, slot);
      observer.observe(div);
      if (n === 1) post({ type: 'loaded', pages: pdf.numPages });
    }

    let current = 0;
    const report = () => {
      const probe = window.scrollY + window.innerHeight / 3;
      let page = 1;
      for (const s of slots) if (s.div.offsetTop <= probe) page = s.n;
      if (page !== current) { current = page; post({ type: 'page', page }); }
    };
    window.addEventListener('scroll', report, { passive: true });
    report();
  } catch (e) {
    post({ type: 'error', message: String(e && e.message || e) });
  }
</script>
</body>
</html>`;
}

/** The scheme + host + port of a URL (React Native's URL polyfill has no `origin`). */
const originOf = (url: string) => url.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i)?.[0] ?? url;

export function PdfViewer({ uri, onError }: { uri: string; onError: () => void }) {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);

  // iOS renders PDFs natively, with zoom and smooth scrolling.
  const source = useMemo(
    () => (Platform.OS === 'ios' ? { uri } : { html: pdfJsPage(uri), baseUrl: originOf(uri) }),
    [uri],
  );

  function onMessage(e: WebViewMessageEvent) {
    let msg: Message;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'loaded') { setPages(msg.pages); setLoading(false); }
    else if (msg.type === 'page') setPage(msg.page);
    else if (msg.type === 'error') { setLoading(false); onError(); }
  }

  return (
    <View style={styles.fill}>
      <WebView
        source={source}
        originWhitelist={['*']}
        style={styles.web}
        onMessage={onMessage}
        onLoadEnd={Platform.OS === 'ios' ? () => setLoading(false) : undefined}
        onError={() => { setLoading(false); onError(); }}
        onHttpError={() => { setLoading(false); onError(); }}
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        javaScriptEnabled
      />
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" size="large" />}
      {pages > 1 && (
        <View style={styles.counter} pointerEvents="none">
          <Text variant="small" color="#fff">{page} / {pages}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  web: { flex: 1, backgroundColor: '#1b1a22' },
  counter: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
});
