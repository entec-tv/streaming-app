import { Ionicons } from "@expo/vector-icons";
import React from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { useColors } from '@/hooks/useColors';
import { TVFocusable } from '@/components/TVFocusable';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';

export default function DownloadsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const downloads = useAppStore(s => s.downloads);
  const pauseDownload = useAppStore(s => s.pauseDownload);
  const resumeDownload = useAppStore(s => s.resumeDownload);
  const cancelDownload = useAppStore(s => s.cancelDownload);
  const removeDownload = useAppStore(s => s.removeDownload);

  const handleDelete = (item: any) => {
    Alert.alert(
      "Delete Download",
      "Are you sure you want to delete this downloaded item? It will be removed from your device.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            cancelDownload(item.id);
          }
        }
      ]
    );
  };

  const handlePlay = (item: any) => {
    router.push({
      pathname: '/player',
      params: {
        streamUrl: item.localUri,
        title: item.title,
        poster: item.poster,
        backdrop: item.backdrop,
        quality: item.quality,
        isLive: 'false',
        id: item.id,
      }
    });
  };

  if (downloads.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('my_downloads')}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="download-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.text }]}>{t('no_downloads')}</Text>
          <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
            Movies and episodes you download will appear here for offline viewing.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('my_downloads')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View nativeID="downloads-list" style={{ flex: 1 }}>
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
          <View style={[styles.downloadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TVFocusable 
              style={({ focused }: any) => [
                styles.cardMain,
                focused && { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 3, borderColor: '#FFF', borderRadius: 16 }
              ]} 
              onPress={() => item.status === 'completed' ? handlePlay(item) : null}
              focusable={true}
            >
              <Image source={{ uri: item.poster || item.backdrop }} style={styles.thumbnail} contentFit="cover" />
              <View style={styles.info}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                
                {item.status === 'completed' && (
                  <>
                    <View style={styles.badgeRow}>
                      {item.type === 'series' && (
                        <Text style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.1)', color: colors.mutedForeground }]}>{t('episode')}</Text>
                      )}
                      <Text style={[styles.badge, { backgroundColor: colors.gold, color: '#000' }]}>{item.quality}</Text>
                    </View>
                    <Text style={[styles.status, { color: colors.primary }]}>{t('downloaded')}</Text>
                  </>
                )}

                {(item.status === 'downloading' || item.status === 'paused') && (
                  <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                      <View style={[styles.progressFill, { backgroundColor: colors.gold, width: `${(item.progress || 0) * 100}%` }]} />
                    </View>
                    <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                      {Math.round((item.progress || 0) * 100)}% {item.status === 'paused' ? '(Paused)' : ''}
                    </Text>
                  </View>
                )}

                {item.status === 'error' && (
                  <Text style={[styles.status, { color: colors.destructive }]}>{t('download_failed')}</Text>
                )}
              </View>
            </TVFocusable>
            
            <View style={styles.actionsColumn}>
              {item.status === 'downloading' && (
                <TVFocusable 
                  style={({ focused }: any) => [styles.actionBtn, focused && { borderWidth: 3, borderColor: '#FFF', transform: [{ scale: 1.1 }] }]} 
                  onPress={() => pauseDownload(item.id)} hitSlop={10} focusable={true}
                >
                  <Ionicons name="pause" size={20} color={colors.text} />
                </TVFocusable>
              )}
              {(item.status === 'paused' || item.status === 'error') && (
                <TVFocusable 
                  style={({ focused }: any) => [styles.actionBtn, focused && { borderWidth: 3, borderColor: '#FFF', transform: [{ scale: 1.1 }] }]} 
                  onPress={() => resumeDownload(item.id)} hitSlop={10} focusable={true}
                >
                  <Ionicons name={item.status === 'error'  ? "refresh-outline" : "play"} size={20} color={item.status === 'error' ? colors.gold : colors.primary} />
                </TVFocusable>
              )}
              <TVFocusable 
                style={({ focused }: any) => [styles.deleteBtn, focused && { borderWidth: 3, borderColor: '#FFF', transform: [{ scale: 1.1 }] }]} 
                onPress={() => handleDelete(item)} hitSlop={10} focusable={true}
              >
                <Ionicons name={item.status === 'completed'  ? "trash-outline" : "close"} size={20} color={colors.destructive} />
              </TVFocusable>
            </View>
          </View>
        )}
      />
      </View>
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  downloadCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    height: 100,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
  },
  thumbnail: {
    width: 70,
    height: '100%',
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  status: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionsColumn: {
    width: 60,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.05)',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  deleteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
  }
});
