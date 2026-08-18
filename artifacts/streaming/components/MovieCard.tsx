import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Movie } from '@/types';
import { QualityBadge } from './QualityBadge';
import { useColors } from '@/hooks/useColors';
import { TVFocusable } from './TVFocusable';

interface MovieCardProps {
  movie: Movie;
  onPress: () => void;
  width?: number;
  autoFocus?: boolean;
}

export const MovieCard = React.memo(function MovieCard({
  movie,
  onPress,
  width = 128,
  autoFocus,
}: MovieCardProps) {
  const colors = useColors();
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(movie.title || 'Movie')}&background=1D222B&color=F4C542&bold=true&size=300&format=svg`;
  const [imgSource, setImgSource] = React.useState(movie.poster || fallbackUrl);

  React.useEffect(() => {
    setImgSource(movie.poster || fallbackUrl);
  }, [movie.poster]);

  const isNavigating = React.useRef(false);

  const handlePress = React.useCallback((e: any) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (onPress) onPress(e);
    setTimeout(() => { isNavigating.current = false; }, 1000);
  }, [onPress]);

  return (
    <TVFocusable 
      onPress={handlePress} 
      style={[{ width, marginBottom: 12 }]}
      scaleAmount={1.03}
      borderThickness={3}
      focusedBorderColor={colors.gold}
      hasTVPreferredFocus={autoFocus}
    >
      {({ focused }: any) => (
        <View style={[
          styles.container,
          focused && {
            shadowColor: colors.gold,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 8,
          }
        ]}>
          <View style={[styles.posterContainer, { backgroundColor: colors.surface }]}>
            <Image
              source={{ uri: imgSource, headers: { 'User-Agent': 'Mozilla/5.0' } }}
              style={styles.poster}
              contentFit="cover"
              onError={() => {
                if (imgSource !== fallbackUrl) setImgSource(fallbackUrl);
              }}
            />
            {focused && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(244,197,66,0.1)' }]} />
            )}
            {(movie as any).quality && (
              <View style={styles.badges}>
                <QualityBadge quality={(movie as any).quality} />
              </View>
            )}
          </View>
          <Text style={[styles.title, { color: colors.text, opacity: focused ? 1 : 0.8 }]} numberOfLines={2}>
            {movie.title}
          </Text>
          {((movie as any).year && String((movie as any).year) !== '0') ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {(movie as any).year}
            </Text>
          ) : null}
        </View>
      )}
    </TVFocusable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    transitionDuration: '200ms',
  },
  posterContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  badges: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
