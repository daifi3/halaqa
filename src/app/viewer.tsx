import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { ImageViewer } from '@/components/viewer/image-viewer';
import { PdfViewer } from '@/components/viewer/pdf-viewer';
import type { ViewerKind } from '@/lib/viewer';

const DARK_BUTTON = 'rgba(255,255,255,0.14)';
/** Close button (44) + header bottom padding (10). */
const HEADER_HEIGHT = 54;

/** Full-screen viewer for PDFs and images. Open it with `openViewer()` from '@/lib/viewer'. */
export default function Viewer() {
  const { url, title, kind } = useLocalSearchParams<{ url: string; title?: string; kind: ViewerKind }>();
  const [failed, setFailed] = useState(false);
  const insets = useSafeAreaInsets();

  const openOutside = () => Linking.openURL(url).catch(() => Alert.alert('Could not open this file'));

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* Images use the whole screen under the header; PDF pages start below it. */}
      <View style={[styles.body, kind === 'pdf' && { paddingTop: insets.top + HEADER_HEIGHT }]}>
        {failed ? (
          <View style={styles.failed}>
            <Text variant="heading" color="#fff">Couldn’t show this file</Text>
            <Text color="rgba(255,255,255,0.7)" style={{ textAlign: 'center' }}>
              It may be damaged, or your connection dropped. You can still open it in another app.
            </Text>
            <Button title="Open in another app" icon="open-outline" onPress={openOutside} />
          </View>
        ) : kind === 'pdf' ? (
          <PdfViewer uri={url} onError={() => setFailed(true)} />
        ) : (
          <ImageViewer uri={url} onError={() => setFailed(true)} />
        )}
      </View>

      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
        <IconButton icon="close" onPress={() => router.back()} color="#fff" bg={DARK_BUTTON} />
        <Text variant="bodyStrong" color="#fff" numberOfLines={1} style={styles.title}>{title ?? ''}</Text>
        <IconButton icon="open-outline" onPress={openOutside} color="#fff" bg={DARK_BUTTON} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  body: { flex: 1 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  title: { flex: 1, textAlign: 'center' },
  failed: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
});
