import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme';

// Web build of the call route (Metro picks this over `[id].tsx` on web): LiveKit's
// React Native SDK can't load in a browser — see classroom/[id].web.tsx. Calls on
// the web go through the separate web app in web/.
export default function CallScreen() {
  return (
    <View style={styles.center}>
      <Text variant="heading" color={colors.stageText}>Calls open in the Halaqa app</Text>
      <Text color={colors.stageMuted} style={{ textAlign: 'center' }}>Use the phone app or the Halaqa website to make audio calls.</Text>
      <Button title="Go back" variant="secondary" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, backgroundColor: colors.stage },
});
