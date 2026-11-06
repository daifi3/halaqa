import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, Path } from '@shopify/react-native-skia';
import qrcodeGenerator from 'qrcode-generator';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { joinLink, type JoinKind } from '@/lib/join-link';
import { useSkiaReady } from '@/lib/skia-ready';
import { colors, radius, shadow } from '@/theme';

/** Modules of white border the QR spec asks for so scanners can find the code. */
const QUIET = 4;

/** Crisp QR code drawn with Skia — one path, horizontal runs merged so no seams show between modules. */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const ready = useSkiaReady();
  const d = useMemo(() => {
    const qr = qrcodeGenerator(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    // Whole-pixel modules keep edges sharp; leftover space is split evenly as margin.
    const cell = Math.max(1, Math.floor(size / (n + QUIET * 2)));
    const offset = Math.floor((size - cell * n) / 2);
    let path = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        let run = 1;
        while (c + run < n && qr.isDark(r, c + run)) run++;
        path += `M${offset + c * cell} ${offset + r * cell}h${run * cell}v${cell}h${-run * cell}z`;
        c += run - 1;
      }
    }
    return path;
  }, [value, size]);

  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff' }}>
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={d} color={colors.ink} antiAlias={false} />
        </Canvas>
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.muted} />
        </View>
      )}
    </View>
  );
}

/** The card a teacher shows the class: QR of the join deep link, plus the code as a fallback. */
export function JoinQrPanel({ kind, code }: { kind: JoinKind; code: string }) {
  return (
    <Animated.View entering={FadeInDown.springify()} exiting={FadeOut.duration(150)} style={styles.panel}>
      <QrCode value={joinLink(kind, code)} />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text variant="heading">Scan to join</Text>
        <Text variant="small" color={colors.muted} style={{ textAlign: 'center', maxWidth: 260 }}>
          Students scan this from the Join screen in Halaqa, or with their phone camera.
        </Text>
      </View>
      <View style={styles.codeRow}>
        <Ionicons name="keypad-outline" size={14} color={colors.muted} />
        <Text variant="small" color={colors.muted}>or type</Text>
        <Text variant="bodyStrong" style={{ letterSpacing: 3 }}>{code}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, ...shadow.card },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
});
