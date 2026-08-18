import { Ionicons } from "@expo/vector-icons";
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { TVFocusable } from '@/components/TVFocusable';
import { useAppStore } from '@/store/app-store';
import { Channel } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'live' | 'vod' | 'series';

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const favoriteItems = useAppStore((s) => s.favoriteItems) || [];
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const setPlaybackQueue = useAppStore((s) => s.setPlaybackQueue);

  const [activeTab, setActiveTab] = useState<TabType>('live');

  const filteredItems = favoriteItems.filter(item => item.type === activeTab);

  const handleItemPress = (item: Channel, index: number) => {
    if (item.type === 'live') {
      setPlaybackQueue(filteredItems, index);
      router.push({
        pathname: '/player',
        params: {
          id: item.id,
          streamUrl: item.streamUrl,
          title: item.name,
          isLive: 'true',
          current: item.current || '',
          next: item.next || '',
          quality: item.quality || 'HD',
          logo: item.logo || '',
          category: item.category || ''
        }
      });
    } else if (item.type === 'vod') {
      router.push({
        pathname: '/movie-detail',
        params: {
          id: item.id,
          title: item.name,
          poster: item.logo,
          backdrop: item.logo,
          quality: item.quality || 'HD',
          genres: item.category,
          description: '',
          streamUrl: item.streamUrl
        }
      });
    } else if (item.type === 'series') {
      router.push({
        pathname: '/series-detail',
        params: {
          id: item.id,
          title: item.name,
          poster: item.logo,
          backdrop: item.logo,
          genres: item.category,
          description: '',
          streamUrl: item.streamUrl
        }
      });
    }
  };

  const renderCard = ({ item, index }: { item: Channel; index: number }) => {
    const isLive = item.type === 'live';

    return (
      <View style={[styles.cardContainer, isLive ? styles.liveWidth : styles.vodWidth]}>
        <TVFocusable
          style={({ focused }: any) => [
            styles.card,
            { backgroundColor: focused ? 'rgba(255,255,255,0.05)' : colors.surface, borderColor: focused ? '#FFF' : colors.border },
            focused && { borderWidth: 4, transform: [{ scale: 1.05 }] }
          ]}
          onPress={() => handleItemPress(item, index)}
          focusable={true}
        >
          <View style={isLive ? styles.liveLogoWrapper : styles.posterWrapper}>
            <Image
              source={{ uri: item.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=1A1A1A&color=${colors.gold.replace('#', '')}&bold=true&size=150&format=svg` }}
              style={styles.cardImage}
              contentFit={isLive ? "contain" : "cover"}
            />

            <TVFocusable
              style={({ focused }: any) => [
                styles.removeFavBtn, 
                { backgroundColor: 'rgba(0,0,0,0.6)' },
                focused && { borderWidth: 3, borderColor: '#FFF', transform: [{ scale: 1.2 }] }
              ]}
              onPress={() => toggleFavorite(item)}
              focusable={true}
            >
              <Ionicons name="heart" size={16} color="#E53935" fill="#E53935" />
            </TVFocusable>

            {isLive && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t('live')}</Text>
              </View>
            )}
          </View>

          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.cardPackage, { color: colors.mutedForeground }]} numberOfLines={1}>
              {item.category}
            </Text>
          </View>
        </TVFocusable>
      </View>
    );
  };

  const tabs: { type: TabType; label: string }[] = [
    { type: 'live', label: 'Live TV' },
    { type: 'vod', label: 'Movies' },
    { type: 'series', label: 'TV Series' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TVFocusable 
          style={({ focused }: any) => [
            styles.backBtn,
            focused && { transform: [{ scale: 1.1 }], backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 3, borderColor: '#FFF' }
          ]} 
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); } }}
          focusable={true}
        >
          {({ focused }: any) => (
            <Ionicons name="chevron-back" size={24} color={focused ? colors.gold : colors.text} />
          )}
        </TVFocusable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('favorites')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.type;
          return (
            <TVFocusable
              key={tab.type}
              style={({ focused }: any) => [
                styles.tabItem,
                isSelected && { borderBottomColor: colors.gold },
                focused && { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, borderWidth: 3, borderColor: '#FFF' }
              ]}
              onPress={() => setActiveTab(tab.type)}
              focusable={true}
            >
              {({ focused }: any) => (
                <Text style={[
                  styles.tabLabel,
                  { color: isSelected || focused ? colors.gold : colors.text }
                ]}>
                  {tab.label}
                </Text>
              )}
            </TVFocusable>
          );
        })}
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        numColumns={activeTab === 'live' ? 2 : 3}
        key={activeTab} // rebuild layout when changing tabs (columns count changes)
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 20 }
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="heart" size={48} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No favorites added yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 8,
    flexGrow: 1,
  },
  cardContainer: {
    padding: 6,
  },
  liveWidth: {
    width: '50%',
  },
  vodWidth: {
    width: '33.33%',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  liveLogoWrapper: {
    aspectRatio: 16 / 10,
    width: '100%',
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 12,
  },
  posterWrapper: {
    aspectRatio: 2 / 3,
    width: '100%',
    position: 'relative',
    backgroundColor: '#151515',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  removeFavBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  liveIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  cardInfo: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  cardPackage: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 6,
  },
});
