import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Channel } from '@/types';
import { LiveBadge } from './LiveBadge';
import { useColors } from '@/hooks/useColors';
import { TVFocusable } from './TVFocusable';

interface ChannelCardProps {
  channel: Channel;
  onPress: () => void;
  width?: number;
  autoFocus?: boolean;
}

export const ChannelCard = React.memo(function ChannelCard({
  channel,
  onPress,
  width = 160,
  autoFocus
}: ChannelCardProps) {
  const colors = useColors();
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name || 'CH')}&background=1A1F2B&color=F4C542&bold=true&size=300&format=svg`;
  const [imgSource, setImgSource] = React.useState(channel.logo || fallbackUrl);

  React.useEffect(() => {
    setImgSource(channel.logo || fallbackUrl);
  }, [channel.logo]);

  const isNavigating = React.useRef(false);

  const handlePress = React.useCallback((e: any) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (onPress) (onPress as any)(e);
    setTimeout(() => { isNavigating.current = false; }, 1000);
  }, [onPress]);

  return (
    <TVFocusable 
      onPress={handlePress}
      disableBorder
      hasTVPreferredFocus={autoFocus}
      style={{ width }}
    >
      {({ focused, pressed }: { focused: boolean; pressed: boolean }) => (
        <View style={styles.container}>
          <View
            style={[
              styles.imageContainer,
              {
                backgroundColor: colors.surface,
                borderColor: focused || pressed ? colors.gold : colors.border,
                borderWidth: focused || pressed ? 2 : 1.5,
              },
            ]}
          >
            <Image
              source={{ uri: imgSource }}
              style={styles.logo}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={150}
              onError={() => {
                if (imgSource !== fallbackUrl) setImgSource(fallbackUrl);
              }}
            />
            {channel.isLive && (
              <View style={styles.badgeContainer}>
                <LiveBadge />
              </View>
            )}
          </View>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {channel.name}
          </Text>
        </View>
      )}
    </TVFocusable>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  imageContainer: {
    aspectRatio: 16 / 9,
    width: '100%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '55%',
    height: '55%',
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
});
