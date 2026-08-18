import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, useWindowDimensions, Platform } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { HeartBulk, MonitorBulk, Trash3Bulk } from '@lineiconshq/free-icons';
import { MovieCard } from '@/components/MovieCard';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { useIsFocused } from '@react-navigation/native';

export default function FavoritesScreen() {
  const isFocused = useIsFocused();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 1024 || Platform.isTV;
  const numColumns = isLargeScreen ? 5 : Math.max(2, Math.floor((width - 40) / 130));

  const favoriteItems = useAppStore((s) => s.favoriteItems) || [];

  const toggleFavorite = useAppStore((s) => s.toggleFavorite);



  const handlePlayFav = (item: any) => {
    if (item.type === 'live') {
      router.push({
        pathname: '/player',
        params: {
          streamUrl: item.streamUrl || '',
          title: item.name || item.title || '',
          isLive: 'true',
          quality: item.quality || 'HD',
        }
      });
    } else if (item.type === 'series') {
      router.push({
        pathname: '/series-detail',
        params: {
          id: item.id,
          title: item.name || item.title || '',
          poster: item.logo || '',
          backdrop: item.logo || '',
          streamUrl: item.streamUrl || '',
        }
      });
    } else {
      router.push({
        pathname: '/movie-detail',
        params: {
          id: item.id,
          title: item.name || item.title || '',
          poster: item.logo || '',
          backdrop: item.logo || '',
          streamUrl: item.streamUrl || '',
        }
      });
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    return (
      <View style={{ flex: 1, margin: 8, maxWidth: isLargeScreen ? (width - 120 - 80) / numColumns : width / numColumns }}>
        <View style={{ position: 'relative' }}>
          <MovieCard
            movie={{
              id: item.id,
              title: item.name || item.title || '',
              poster: item.logo,
              backdrop: item.logo,
              rating: item.rating || 0,
              year: item.year || 0,
              duration: item.type === 'live' ? 'LIVE' : item.type === 'series' ? 'SERIES' : 'VOD',
              quality: item.quality || 'HD',
              genres: [item.category || 'Uncategorized'],
              description: item.current || item.description || '',
              streamUrl: item.streamUrl,
            }}
            onPress={() => handlePlayFav(item)}
            width={isLargeScreen ? (width - 120 - 80) / numColumns : (width - 40) / numColumns}
          />
          <TVFocusable
            style={({ focused }: any) => [
              { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8, zIndex: 10 },
              focused && { backgroundColor: colors.destructive, transform: [{ scale: 1.1 }] }
            ]}
            onPress={() => toggleFavorite(item)}
          >
            <Lineicons icon={Trash3Bulk} size={18} color="#FFF" />
          </TVFocusable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent', paddingLeft: isLargeScreen ? 32 : 0 , display: Platform.OS === 'web' && !isFocused ? 'none' : 'flex' }]}>
      <View style={[styles.header, { paddingTop: insets.top + 20, paddingHorizontal: isLargeScreen ? 40 : 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
            <Lineicons icon={HeartBulk} size={24} color={colors.gold} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('favorites')}</Text>
        </View>
      </View>

      <View nativeID="favorites-list" style={{ flex: 1 }}>
        {favoriteItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Lineicons icon={HeartBulk} size={64} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t('no_favorites')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={favoriteItems}
            keyExtractor={(item, index) => item.id || String(index)}
            numColumns={numColumns}
            renderItem={renderItem}
            key={numColumns}
            contentContainerStyle={{ padding: isLargeScreen ? 40 : 20, paddingBottom: insets.bottom + 80 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});
