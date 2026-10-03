import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { Image } from 'expo-image';
import { WatchedItem } from '@/store/app-store';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';

function formatDuration(sec: number) {
  if (typeof sec !== 'number' || isNaN(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface ContinueWatchingCardProps {
  item: WatchedItem;
  onPress: () => void;
  width?: number;
}

import { base64Decode } from '@/lib/base64';

function decodeIfNeeded(str?: string) {
  if (!str) return '';
  if (str.startsWith('http') || str.startsWith('data:') || str.startsWith('file:')) return str;
  try {
    const decoded = base64Decode(str);
    if (decoded.startsWith('http')) return decoded;
    return str;
  } catch {
    return str;
  }
}

export const ContinueWatchingCard = React.memo(function ContinueWatchingCard({ item, onPress, width = 180 }: ContinueWatchingCardProps) {
  const colors = useColors();

  const isValidDuration = typeof item.duration === 'number' && !isNaN(item.duration) && item.duration > 0;
  const percent = isValidDuration ? Math.min(100, Math.max(0, (item.progress / item.duration) * 100)) : 0;

  const titleFromItem = (item as any).title || (item as any).name;
  const displayTitle = titleFromItem && titleFromItem.trim() !== '' ? titleFromItem : 'Unknown Title';
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayTitle)}&background=1A1A1A&color=${colors.gold.replace('#', '')}&bold=true&size=300&format=svg`;
  
  const decodedBackdrop = decodeIfNeeded(item.backdrop);
  const decodedPoster = decodeIfNeeded(item.poster || (item as any).logo || (item as any).thumbnail);
  const initialImage = decodedBackdrop || decodedPoster || fallbackUrl;
  const [imgSource, setImgSource] = React.useState(initialImage);

  React.useEffect(() => {
    setImgSource(decodedBackdrop || decodedPoster || fallbackUrl);
  }, [decodedBackdrop, decodedPoster, fallbackUrl]);

  return (
    <TVFocusable onPress={onPress} style={{ width }} disableBorder={true}>
      {({ focused }: any) => (
        <View style={[
          styles.posterContainer,
          { borderColor: focused ? colors.gold : 'transparent', borderWidth: 2 }
        ]}>
          <Image 
            source={{ uri: imgSource }} 
            style={styles.poster} 
            contentFit="cover" 
            cachePolicy="memory-disk"
            transition={150}
            onError={() => {
              if (imgSource !== fallbackUrl) setImgSource(fallbackUrl);
            }}
          />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.gradient}>
            <View style={styles.infoRow}>
              <Text style={styles.title} numberOfLines={1}>{displayTitle}</Text>
              {isValidDuration && <Text style={styles.time}>{formatDuration(item.duration)}</Text>}
            </View>
            {isValidDuration && (
              <View style={styles.progressContainer}>
                 <View style={[styles.progressBar, { width: `${percent}%`, backgroundColor: colors.gold }]} />
              </View>
            )}
          </LinearGradient>
        </View>
      )}
    </TVFocusable>
  );
});

const styles = StyleSheet.create({
  posterContainer: {
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    marginBottom: 6,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    paddingTop: 24,
    justifyContent: 'flex-end',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  title: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 6,
  },
  time: {
    color: '#DDD',
    fontSize: 11,
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  }
});
