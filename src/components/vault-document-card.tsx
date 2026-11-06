import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { formatBytes, formatDay } from '@/lib/format';
import type { VaultDocument } from '@/lib/types';
import { colors, radius, shadow } from '@/theme';
import { Chip } from './ui/misc';
import { PressableScale } from './ui/pressable-scale';
import { Text } from './ui/text';

export function iconForMime(mime: string | null): keyof typeof Ionicons.glyphMap {
  if (!mime) return 'document-outline';
  if (mime.startsWith('image/')) return 'image-outline';
  if (mime.startsWith('video/')) return 'videocam-outline';
  if (mime.startsWith('audio/')) return 'musical-notes-outline';
  if (mime === 'application/pdf') return 'document-text-outline';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'grid-outline';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'easel-outline';
  return 'document-outline';
}

export function VaultDocumentCard({ document, index, onPress }: { document: VaultDocument; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 50)} layout={LinearTransition.springify()}>
      <PressableScale onPress={onPress} scaleTo={0.97} style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name={iconForMime(document.mimeType)} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{document.title}</Text>
          <View style={styles.meta}>
            <Text variant="small" color={colors.muted}>{formatBytes(document.sizeBytes)} · {formatDay(document.createdAt)}</Text>
            {document.folder && <Chip label={document.folder} icon="folder-outline" />}
            {document.canManage && document.sharedEmails.length > 0 && (
              <Chip label={`Shared · ${document.sharedEmails.length}`} icon="people-outline" color={colors.primary} bg={colors.primarySoft} />
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14, ...shadow.card,
  },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
