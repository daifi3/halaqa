import { StyleSheet, View } from 'react-native';

/** Browsers have a built-in PDF viewer, so the web build just embeds the file. */
export function PdfViewer({ uri }: { uri: string; onError: () => void }) {
  return (
    <View style={styles.fill}>
      <iframe src={uri} title="PDF" style={{ border: 0, width: '100%', height: '100%', background: '#1b1a22' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
