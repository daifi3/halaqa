import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BiometricGate } from '@/components/biometric-gate';
import { useSecurityPrefs } from '@/store/security-prefs';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

// WebRTC globals for LiveKit. Native only — the app targets iOS & Android.
// Uses a runtime-guarded require() instead of a static import: a static
// `import { registerGlobals } from '@livekit/react-native'` is evaluated
// unconditionally when this module loads, pulling in @livekit/react-native-webrtc,
// whose RTCView.js calls requireNativeComponent() at the top level — which crashes
// under react-native-web ("requireNativeComponent is not a function"). Wrapping it
// in require() means that module graph is never touched when Platform.OS === 'web'.
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@livekit/react-native').registerGlobals();
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const hydrated = useSession((s) => s.hydrated);
  // Wait for the lock settings too, so a locked app never flashes its content.
  const prefsHydrated = useSecurityPrefs((s) => s.hydrated);
  const signedIn = useSession((s) => !!s.user);
  const ready = fontsLoaded && hydrated && prefsHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="log-in" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="room/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="join" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.62], sheetCornerRadius: 28, sheetGrabberVisible: true }} />
            <Stack.Screen name="room/[id]" />
            <Stack.Screen name="room/students/[id]" />
            <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="course/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="course/join" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.62], sheetCornerRadius: 28, sheetGrabberVisible: true }} />
            <Stack.Screen name="course/[id]" />
            <Stack.Screen name="classroom/[id]" options={{ animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: colors.stage } }} />
            <Stack.Screen name="recording/[id]" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="vault/index" />
            <Stack.Screen name="vault/[id]" />
            <Stack.Screen name="vault/upload" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="change-password" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="homework/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="homework/[id]" />
            <Stack.Screen name="exam/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="exam/[id]" />
            <Stack.Screen name="exam/take/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="exam/attempt/[id]" />
            <Stack.Screen name="notifications" />
          </Stack.Protected>
        </Stack>
        <BiometricGate />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
