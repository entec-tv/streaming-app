import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FeaturedHero } from '@/types';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { PlayBulk, MenuMeatballs1Bulk, QuestionMarkCircleBulk, PlusBulk } from '@lineiconshq/free-icons';
import { useAppStore } from '@/store/app-store';
import { useTranslation } from '@/hooks/useTranslation';

interface HeroCarouselProps {
  items: FeaturedHero[];
  onPlay: (item: FeaturedHero) => void;
  onInfo: (item: FeaturedHero) => void;
}

export function HeroCarousel({ items, onPlay, onInfo }: HeroCarouselProps) {
  const colors = useColors();
  const { t, isRTL } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const carouselHeight = isLandscape ? Math.min(Math.round(height * 0.48), 400) : Math.round(height * 0.55);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(width);
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedItemForActionSheet, setSelectedItemForActionSheet] = useState<FeaturedHero | null>(null);

  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  // Auto-scroll effect
  useEffect(() => {
    if (items.length <= 1 || isUserInteracting) return;

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % items.length;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * containerWidth,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentIndex, items.length, isUserInteracting, containerWidth]);

  // Snap to the correct slide when device rotates
  useEffect(() => {
    const t = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ x: currentIndex * containerWidth, animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, [containerWidth]);

  if (!items.length) return null;

  const handleToggleFavorite = (item: FeaturedHero) => {
    if (!item) return;
    if (item.originalItem) {
      toggleFavorite(item.originalItem);
    } else {
      toggleFavorite({
        id: item.id,
        name: item.title,
        logo: typeof item.backdrop === 'object' && 'uri' in item.backdrop ? item.backdrop.uri : '',
        category: item.genres[0] || 'Uncategorized',
        current: item.description || '',
        next: '',
        quality: item.duration === 'LIVE' ? 'HD' : 'FHD',
        isLive: item.duration === 'LIVE',
        streamUrl: item.streamUrl || '',
        type: item.duration === 'LIVE' ? 'live' : 'vod',
      } as any);
    }
  };

  return (
    <View
      style={[styles.container, { height: carouselHeight }]}
      onLayout={(e) => {
        const layoutWidth = e.nativeEvent.layout.width;
        if (layoutWidth > 0 && layoutWidth !== containerWidth) {
          setContainerWidth(layoutWidth);
        }
      }}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
          setCurrentIndex(index);
        }}
        onScrollBeginDrag={() => {
          setIsUserInteracting(true);
        }}
        onScrollEndDrag={() => {
          setIsUserInteracting(false);
        }}
        style={StyleSheet.absoluteFill}
      >
        {items.map((item) => {
          const isFav = favorites.includes(item.id);
          return (
            <View key={item.id} style={[styles.slide, { width: containerWidth }]}>
              <Image source={isLandscape ? item.backdrop : item.poster} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient
                colors={['rgba(17,22,32,0.8)', 'transparent', 'transparent', colors.background]}
                locations={[0, 0.2, 0.6, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.content, { bottom: isLandscape ? 10 : 40 }]}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

                <View style={styles.actions}>
                  <TVFocusable borderThickness={3}
                    style={({ focused }: any) => [
                      styles.playButton,
                      focused && { transform: [{ scale: 1.05 }], backgroundColor: '#EDC363' }
                    ]}
                    onPress={() => onPlay(item)}>
                    {({ focused }: any) => (
                      <>
                        <Lineicons icon={PlayBulk} size={20} color="#1A1A1A" style={{ marginLeft: 4 }} />
                        <Text style={styles.playButtonText}>{t('watch_now')}</Text>
                      </>
                    )}
                  </TVFocusable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.indicators}>
        {items.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === currentIndex ? colors.gold : colors.muted }
            ]}
          />
        ))}
      </View>

      <Modal
        visible={!!selectedItemForActionSheet}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedItemForActionSheet(null)}
      >
        <TVFocusable
          style={styles.modalOverlay}
          disableBorder
          focusable={false}
          onPress={() => setSelectedItemForActionSheet(null)}
        >
          {selectedItemForActionSheet && (
            <TVFocusable disableBorder focusable={false} style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.dragHandle} />

              <Image
                source={selectedItemForActionSheet.backdrop}
                style={styles.actionSheetImage}
                contentFit="cover"
              />

              <Text style={[styles.actionSheetGenres, { color: colors.mutedForeground }]}>
                {selectedItemForActionSheet.genres.join(' | ')}
              </Text>

              <Text style={[styles.actionSheetDesc, { color: colors.mutedForeground }]} numberOfLines={4}>
                {selectedItemForActionSheet.description}
              </Text>

              <View style={styles.actionSheetButtons}>
                <TVFocusable borderThickness={3}
                  style={styles.actionSheetBtn}
                  onPress={() => {
                    onPlay(selectedItemForActionSheet);
                    setSelectedItemForActionSheet(null);
                  }}
                >
                  <View style={styles.actionSheetIconWrapper}>
                    <Lineicons icon={PlayBulk} size={20} color="#FFF" />
                  </View>
                  <Text style={styles.actionSheetBtnText}>{t('watch_now')}</Text>
                </TVFocusable>

                <TVFocusable borderThickness={3}
                  style={styles.actionSheetBtn}
                  onPress={() => handleToggleFavorite(selectedItemForActionSheet)}
                >
                  <View style={styles.actionSheetIconWrapper}>
                    <Lineicons icon={favorites.includes(selectedItemForActionSheet.id) ? QuestionMarkCircleBulk : PlusBulk} size={20} color="#FFF" />
                  </View>
                  <Text style={styles.actionSheetBtnText}>{t('my_list')}</Text>
                </TVFocusable>

                {/* <TVFocusable borderThickness={3}
                  style={styles.actionSheetBtn}
                  onPress={() => {
                    onInfo(selectedItemForActionSheet);
                    setSelectedItemForActionSheet(null);
                  }}
                >
                  <View style={styles.actionSheetIconWrapper}>
                    <Lineicons icon={QuestionMarkCircleBulk} size={20} color="#FFF" />
                  </View>
                  <Text style={styles.actionSheetBtnText}>More Info</Text>
                </TVFocusable> */}
              </View>
            </TVFocusable>
          )}
        </TVFocusable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  slide: {
    height: '100%',
    position: 'relative',
  },
  content: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center', // Center content horizontally
  },
  subtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    textAlign: 'center', // Center text
  },
  meta: {
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center', // Center buttons horizontally
    width: '100%',
  },
  playButton: {
    backgroundColor: '#D4A843',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 48,
    maxWidth: 220,
    borderRadius: 24,
    gap: 8,
  },
  playButtonText: {
    color: '#1A1A1A',
    fontWeight: 'bold',
    fontSize: 16,
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  listButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    minHeight: 400,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  actionSheetImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
  },
  actionSheetGenres: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionSheetDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionSheetButtons: {
    gap: 16,
  },
  actionSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionSheetIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  indicators: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  }
});