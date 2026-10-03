import { Ionicons } from "@expo/vector-icons";
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';


import { router } from 'expo-router';
import { TVFocusable } from '@/components/TVFocusable';
import { useAppStore } from '@/store/app-store';
import { ContinueWatchingCard } from '@/components/ContinueWatchingCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ContinueWatchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const rawContinueWatching = useAppStore((s) => s.continueWatching) || [];
  const continueWatching = React.useMemo(() => {
    return rawContinueWatching.filter(item => 
      item && item.title && (item.type === 'live' || (item.duration > 0 && !isNaN(item.duration)))
    );
  }, [rawContinueWatching]);
  const { width } = useWindowDimensions();

  const minCardWidth = 160;
  // Calculate how many columns can fit (padding 20 on each side = 40, gap is 20)
  const numColumns = Math.max(1, Math.floor((width - 40 + 20) / (minCardWidth + 20)));
  const cardWidth = (width - 40 - (numColumns - 1) * 20) / numColumns;

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TVFocusable
          style={({ focused }: any) => [
            styles.backBtn,
            focused && { transform: [{ scale: 1.1 }], backgroundColor: 'rgba(255,255,255,0.15)' }
          ]}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); } }}
          focusable={true}
        >
          {({ focused }: any) => (
            <Ionicons name="chevron-back" size={24} color={focused ? colors.gold : colors.text} />
          )}
        </TVFocusable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('continue_watching')}</Text>
      </View>

      {continueWatching.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="play" size={64} color={colors.text + '40'} />
          <Text style={[styles.emptyText, { color: colors.text + '80' }]}>
            No continue watching history
          </Text>
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={continueWatching}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
          renderItem={({ item }) => (
            <ContinueWatchingCard
              item={item}
              width={cardWidth}
              onPress={() => {
                const lowerStream = (item.streamUrl || '').toLowerCase();
                const isLiveStream = item.type === 'live' || Boolean(lowerStream && (
                  lowerStream.includes('/live/') || 
                  lowerStream.endsWith('.ts') || 
                  lowerStream.includes('.ts?')
                ));
                router.push({
                  pathname: '/player',
                  params: {
                    id: item.id,
                    streamUrl: item.streamUrl,
                    title: item.title,
                    isLive: isLiveStream ? 'true' : 'false',
                    current: '',
                    next: '',
                    quality: item.quality,
                    logo: item.poster || item.backdrop || '',
                    category: item.category || '',
                    autoResume: isLiveStream ? 'false' : 'true'
                  }
                });
              }}
            />
          )}
        />
      )}
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 20,
  },
  columnWrapper: {
    gap: 20,
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
});
