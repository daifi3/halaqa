import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(v, min), max);
};

/** Full-screen image with pinch-to-zoom, drag while zoomed, and double-tap to zoom in/out. */
export function ImageViewer({ uri, onError }: { uri: string; onError: () => void }) {
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  /** Keeps the zoomed image covering the screen instead of sliding off it. */
  const settle = (s: number) => {
    'worklet';
    const maxX = ((s - 1) * width) / 2;
    const maxY = ((s - 1) * height) / 2;
    const nx = clamp(x.get(), -maxX, maxX);
    const ny = clamp(y.get(), -maxY, maxY);
    x.set(withTiming(nx));
    y.set(withTiming(ny));
    savedX.set(nx);
    savedY.set(ny);
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      // Allow a little overshoot past the limits while pinching; it springs back on release.
      scale.set(clamp(savedScale.get() * e.scale, 0.8, MAX_SCALE * 1.2));
    },
    onDeactivate: () => {
      'worklet';
      const s = clamp(scale.get(), 1, MAX_SCALE);
      scale.set(withTiming(s));
      savedScale.set(s);
      settle(s);
    },
  });

  const pan = usePanGesture({
    maxPointers: 2,
    onUpdate: (e) => {
      'worklet';
      if (savedScale.get() <= 1 && scale.get() <= 1) return;
      x.set(savedX.get() + e.translationX);
      y.set(savedY.get() + e.translationY);
    },
    onDeactivate: () => {
      'worklet';
      settle(savedScale.get());
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (e) => {
      'worklet';
      if (savedScale.get() > 1) {
        scale.set(withTiming(1));
        savedScale.set(1);
        x.set(withTiming(0));
        y.set(withTiming(0));
        savedX.set(0);
        savedY.set(0);
        return;
      }
      // Zoom towards the tapped point.
      const s = DOUBLE_TAP_SCALE;
      const maxX = ((s - 1) * width) / 2;
      const maxY = ((s - 1) * height) / 2;
      const nx = clamp((width / 2 - e.x) * (s - 1), -maxX, maxX);
      const ny = clamp((height / 2 - e.y) * (s - 1), -maxY, maxY);
      scale.set(withTiming(s));
      savedScale.set(s);
      x.set(withTiming(nx));
      y.set(withTiming(ny));
      savedX.set(nx);
      savedY.set(ny);
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill} collapsable={false}>
        <Animated.View style={[styles.fill, style]}>
          <Image
            source={{ uri }}
            style={styles.fill}
            contentFit="contain"
            transition={150}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); onError(); }}
          />
        </Animated.View>
        {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" size="large" />}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
});
