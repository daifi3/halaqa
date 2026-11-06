import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/misc';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { parseJoinLink } from '@/lib/join-link';
import { colors, radius } from '@/theme';

const FRAME = 240;

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The camera fires many callbacks per second for the same code; a ref blocks re-entry synchronously.
  const busy = useRef(false);
  const lastBad = useRef<string | null>(null);

  async function onScanned({ data }: BarcodeScanningResult) {
    if (busy.current || data === lastBad.current) return;
    const link = parseJoinLink(data);
    if (!link) {
      lastBad.current = data;
      setError("That QR code isn't a Halaqa invite.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    busy.current = true;
    setJoining(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      if (link.kind === 'course') {
        const course = await api.joinCourseByCode(link.code);
        router.replace(`/course/${course.id}`);
      } else {
        const room = await api.joinByCode(link.code);
        router.replace(`/room/${room.id}`);
      }
    } catch (e) {
      lastBad.current = data;
      setError(e instanceof Error ? e.message : 'Could not join');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      busy.current = false;
      setJoining(false);
    }
  }

  return (
    <View style={styles.root}>
      {permission?.granted && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={joining ? undefined : onScanned}
        />
      )}

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton icon="close" onPress={() => router.back()} bg="rgba(0,0,0,0.45)" color="#fff" />
        </View>

        {!permission ? (
          <View style={styles.center}><ActivityIndicator color="#fff" /></View>
        ) : !permission.granted ? (
          <Animated.View entering={FadeInDown} style={styles.center}>
            <View style={styles.permIcon}>
              <Ionicons name="camera-outline" size={28} color="#fff" />
            </View>
            <Text variant="heading" color="#fff" style={{ textAlign: 'center' }}>Camera access needed</Text>
            <Text color={colors.stageMuted} style={{ textAlign: 'center', maxWidth: 280 }}>
              Halaqa uses the camera to scan your teacher&apos;s QR code.
            </Text>
            <Button
              title={permission.canAskAgain ? 'Allow camera' : 'Enable it in Settings'}
              icon="camera"
              accent={colors.student}
              disabled={!permission.canAskAgain}
              onPress={requestPermission}
              style={{ alignSelf: 'stretch' }}
            />
          </Animated.View>
        ) : (
          <>
            <View style={styles.center}>
              <View style={styles.frame}>
                {joining && (
                  <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.joining}>
                    <ActivityIndicator color="#fff" />
                  </Animated.View>
                )}
              </View>
            </View>
            <View style={styles.footer}>
              <Text variant="heading" color="#fff" style={{ textAlign: 'center' }}>
                {joining ? 'Joining…' : 'Scan the class QR code'}
              </Text>
              {error ? (
                <Animated.View entering={FadeInDown} style={styles.error}>
                  <Ionicons name="alert-circle" size={16} color="#fff" />
                  <Text variant="small" color="#fff" style={{ flexShrink: 1 }}>{error}</Text>
                </Animated.View>
              ) : (
                <Text variant="small" color="rgba(255,255,255,0.7)" style={{ textAlign: 'center' }}>
                  Ask your teacher to show it from the class or course page.
                </Text>
              )}
              <Button title="Type the code instead" variant="secondary" icon="keypad-outline" onPress={() => router.replace('/join')} />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1 },
  header: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  permIcon: {
    width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  frame: { width: FRAME, height: FRAME, borderRadius: radius.xl, borderWidth: 3, borderColor: '#fff', overflow: 'hidden' },
  joining: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 24, gap: 12 },
  error: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center',
    backgroundColor: colors.danger, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
  },
});
