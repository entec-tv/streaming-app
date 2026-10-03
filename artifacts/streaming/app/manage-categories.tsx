import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, FlatList } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useTranslation } from '@/hooks/useTranslation';
import { useColors } from '@/hooks/useColors';
import { useAppStore } from '@/store/app-store';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_PREFS = { hiddenIds: [], liveOrder: [], vodOrder: [], seriesOrder: [] };

export default function ManageCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const isLargeScreen = width >= 1024 || Platform.isTV;

  const activePlaylistId = useAppStore(s => s.activePlaylistId);
  const activeCategories = useAppStore(s => s.activeCategories);
  const prefs = useAppStore(s => s.categoryPreferences[activePlaylistId] || DEFAULT_PREFS);
  const updatePrefs = useAppStore(s => s.updateCategoryPreferences);

  const [localLive, setLocalLive] = useState<{ id: string; name: string }[]>([]);
  const [localVod, setLocalVod] = useState<{ id: string; name: string }[]>([]);
  const [localSeries, setLocalSeries] = useState<{ id: string; name: string }[]>([]);
  
  const [activeTab, setActiveTab] = useState<'live' | 'vod' | 'series'>('live');

  // Initialize ordered arrays
  useEffect(() => {
    if (!activeCategories) return;

    const sortWithOrder = (cats: any[], orderList: string[]) => {
      const copy = [...cats];
      if (orderList && orderList.length > 0) {
        const orderMap = new Map(orderList.map((id, index) => [id, index]));
        copy.sort((a, b) => {
          const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
          const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
          return idxA - idxB;
        });
      }
      return copy;
    };

    setLocalLive(sortWithOrder(activeCategories.live || [], prefs.liveOrder));
    setLocalVod(sortWithOrder(activeCategories.vod || [], prefs.vodOrder));
    setLocalSeries(sortWithOrder(activeCategories.series || [], prefs.seriesOrder));
  }, [activeCategories, activePlaylistId, prefs.liveOrder, prefs.vodOrder, prefs.seriesOrder]);

  const toggleVisibility = (id: string) => {
    const isHidden = prefs.hiddenIds.includes(id);
    const newHidden = isHidden ? prefs.hiddenIds.filter(x => x !== id) : [...prefs.hiddenIds, id];
    updatePrefs(activePlaylistId, { hiddenIds: newHidden });
  };

  const moveItem = (type: 'live' | 'vod' | 'series', index: number, direction: 'up' | 'down') => {
    const listMap = { live: localLive, vod: localVod, series: localSeries };
    const currentList = [...listMap[type]];
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentList[index];
    currentList[index] = currentList[swapIndex];
    currentList[swapIndex] = temp;

    const newOrder = currentList.map(c => c.id);
    
    if (type === 'live') {
      setLocalLive(currentList);
      updatePrefs(activePlaylistId, { liveOrder: newOrder });
    } else if (type === 'vod') {
      setLocalVod(currentList);
      updatePrefs(activePlaylistId, { vodOrder: newOrder });
    } else {
      setLocalSeries(currentList);
      updatePrefs(activePlaylistId, { seriesOrder: newOrder });
    }
  };

  const renderCategoryItem = (item: { id: string; name: string }, index: number, type: 'live' | 'vod' | 'series', listLength: number) => {
    const isHidden = prefs.hiddenIds.includes(item.id);
    
    return (
      <View key={item.id} style={styles.itemRow}>
        <TVFocusable 
          style={({ focused }: any) => [
            styles.toggleBtn, 
            focused && styles.focusedBtn,
            !isHidden && styles.visibleBtn
          ]}
          onPress={() => toggleVisibility(item.id)}
        >
          {({ focused }: any) => (
            <Ionicons 
              name="checkmark" 
              size={18} 
              color={isHidden ? "transparent" : (focused ? "#000" : "#FFF")} 
            />
          )}
        </TVFocusable>
        
        <Text style={[styles.itemText, isHidden && styles.hiddenText]} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.moveActions}>
          <TVFocusable 
            style={({ focused }: any) => [styles.moveBtn, focused && { backgroundColor: '#333' }, index === 0 && { opacity: 0.3 }]}
            onPress={() => moveItem(type, index, 'up')}
            disabled={index === 0}
          >
            {({ focused }: any) => (
               <Ionicons name="chevron-up" size={20} color={focused ? "#FFF" : "#888"} />
            )}
          </TVFocusable>
          <TVFocusable 
            style={({ focused }: any) => [styles.moveBtn, focused && { backgroundColor: '#333' }, index === listLength - 1 && { opacity: 0.3 }]}
            onPress={() => moveItem(type, index, 'down')}
            disabled={index === listLength - 1}
          >
            {({ focused }: any) => (
               <Ionicons name="chevron-down" size={20} color={focused ? "#FFF" : "#888"} />
            )}
          </TVFocusable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TVFocusable 
          style={({ focused }: any) => [styles.backBtn, focused && styles.focusedBtn]}
          onPress={() => router.back()}
        >
          {({ focused }: any) => (
             <Ionicons name="arrow-back" size={24} color={focused ? "#000" : "#FFF"} />
          )}
        </TVFocusable>
        <Text style={styles.headerTitle}>{t('manage_categories')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {!isLargeScreen && (
        <View style={styles.tabContainer}>
          <TVFocusable 
            style={({ focused }: any) => [styles.tabBtn, activeTab === 'live' && styles.activeTabBtn, focused && styles.focusedTabBtn]}
            onPress={() => setActiveTab('live')}
          >
            <Text style={[styles.tabText, activeTab === 'live' && styles.activeTabText]}>{t('live_categories')}</Text>
          </TVFocusable>
          <TVFocusable 
            style={({ focused }: any) => [styles.tabBtn, activeTab === 'vod' && styles.activeTabBtn, focused && styles.focusedTabBtn]}
            onPress={() => setActiveTab('vod')}
          >
            <Text style={[styles.tabText, activeTab === 'vod' && styles.activeTabText]}>{t('movie_categories')}</Text>
          </TVFocusable>
          <TVFocusable 
            style={({ focused }: any) => [styles.tabBtn, activeTab === 'series' && styles.activeTabBtn, focused && styles.focusedTabBtn]}
            onPress={() => setActiveTab('series')}
          >
            <Text style={[styles.tabText, activeTab === 'series' && styles.activeTabText]}>{t('series_categories')}</Text>
          </TVFocusable>
        </View>
      )}

      <View style={isLargeScreen ? styles.gridContainer : styles.columnContainer}>
        {/* Live TV */}
        {(isLargeScreen || activeTab === 'live') && (
          <View style={isLargeScreen ? styles.column : styles.fullColumn}>
            {isLargeScreen && <Text style={styles.columnTitle}>{t('live_categories')}</Text>}
            <FlatList
              data={localLive}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => renderCategoryItem(item, index, 'live', localLive.length)}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS !== 'web'}
            />
          </View>
        )}

        {/* Movies */}
        {(isLargeScreen || activeTab === 'vod') && (
          <View style={isLargeScreen ? styles.column : styles.fullColumn}>
            {isLargeScreen && <Text style={styles.columnTitle}>{t('movie_categories')}</Text>}
            <FlatList
              data={localVod}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => renderCategoryItem(item, index, 'vod', localVod.length)}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS !== 'web'}
            />
          </View>
        )}

        {/* Series */}
        {(isLargeScreen || activeTab === 'series') && (
          <View style={isLargeScreen ? styles.column : styles.fullColumn}>
            {isLargeScreen && <Text style={styles.columnTitle}>{t('series_categories')}</Text>}
            <FlatList
              data={localSeries}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => renderCategoryItem(item, index, 'series', localSeries.length)}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS !== 'web'}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusedBtn: {
    backgroundColor: '#FFF',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 20,
    gap: 40,
  },
  columnContainer: {
    flex: 1,
    padding: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabBtn: {
    borderBottomColor: '#02b875',
  },
  focusedTabBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFF',
  },
  column: {
    flex: 1,
  },
  fullColumn: {
    width: '100%',
    flex: 1,
  },
  columnTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  toggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#02b875',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    backgroundColor: 'transparent',
  },
  visibleBtn: {
    backgroundColor: '#02b875',
  },
  itemText: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    textAlign: 'right', // match the screenshot RTL aesthetic
  },
  hiddenText: {
    color: '#666',
    textDecorationLine: 'line-through',
  },
  moveActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 16,
  },
  moveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
