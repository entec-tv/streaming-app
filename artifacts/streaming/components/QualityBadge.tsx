import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const QUALITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '4K': { bg: '#F4C542', text: '#000', border: '#F4C542' },
  'FHD': { bg: '#60B4FF', text: '#000', border: '#60B4FF' },
  'HD': { bg: 'rgba(255,255,255,0.9)', text: '#000', border: 'rgba(255,255,255,0.9)' },
  'SD': { bg: 'rgba(0,0,0,0.6)', text: 'rgba(255,255,255,0.8)', border: 'rgba(255,255,255,0.2)' },
};

export function QualityBadge({ quality }: { quality: '4K' | 'FHD' | 'HD' | 'SD' }) {
  const c = QUALITY_COLORS[quality] ?? QUALITY_COLORS['HD'];

  return (
    <View style={[styles.container, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{quality}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
