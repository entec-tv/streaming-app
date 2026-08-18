import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useAppStore } from '@/store/app-store';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LiveClock } from '@/components/LiveClock';

export default function DashboardScreen() {
  const isFocused = useIsFocused();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const playlists = useAppStore(s => s.playlists);
  const activePlaylistId = useAppStore(s => s.activePlaylistId);
  const deviceId = useAppStore(s => s.deviceId);
  const deviceKey = useAppStore(s => s.deviceKey);
  
  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const appExpiryRaw = useAppStore(s => s.appExpiry);
  const appExpiry = appExpiryRaw ? new Date(appExpiryRaw).toLocaleDateString('ar-EG') : 'Lifetime';
  const playlistExpiry = activePlaylist?.updated || 'Active';
  const refreshPlaylist = useAppStore(s => s.refreshPlaylist);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const checkAuthStatus = useAppStore(s => s.checkAuthStatus);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await checkAuthStatus();
      if (activePlaylistId) {
        await refreshPlaylist(activePlaylistId);
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const LargeCard = ({ title, imageSource, path }: { title: string, imageSource: any, path: string }) => (
    <TVFocusable 
      style={({ focused }: any) => [
        styles.largeCard,
        { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.08)' },
        focused && { backgroundColor: 'rgba(0,0,0,0.8)', borderColor: colors.gold, transform: [{ scale: 1.05 }], shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20 }
      ]}
      onPress={() => router.push(path as any)}
    >
      {({ focused }: any) => (
        <View style={styles.largeCardContent}>
          <Image 
            source={imageSource} 
            style={{ width: 120, height: 120, marginBottom: 20, opacity: focused ? 1 : 0.8 }} 
            contentFit="contain"
          />
          <Text style={[styles.largeCardTitle, { color: focused ? '#FFF' : colors.text }]}>{title}</Text>
        </View>
      )}
    </TVFocusable>
  );

  const SmallCard = ({ title, icon, onPress }: { title: string, icon: any, onPress: () => void }) => (
    <TVFocusable 
      style={({ focused }: any) => [
        styles.smallCard,
        { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.05)' },
        focused && { backgroundColor: 'rgba(0,0,0,0.8)', borderColor: colors.gold, transform: [{ scale: 1.05 }], shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10 }
      ]}
      onPress={onPress}
    >
      {({ focused }: any) => (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={[styles.smallCardIconWrapper, focused && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <Ionicons name={icon} size={28} color={focused ? colors.gold : '#FFF'} />
          </View>
          <Text style={[styles.smallCardTitle, { color: focused ? '#FFF' : colors.text }]}>{title}</Text>
        </View>
      )}
    </TVFocusable>
  );

  const IconButton = ({ icon, onPress, loading }: { icon: any, onPress: () => void, loading?: boolean }) => (
    <TVFocusable
      style={({ focused }: any) => [
        styles.iconButton,
        { backgroundColor: 'rgba(0,0,0,0.5)' },
        focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {({ focused }: any) => (
        loading ? (
          <ActivityIndicator size="small" color={focused ? '#000' : colors.text} />
        ) : (
          <Ionicons name={icon} size={22} color={focused ? '#000' : colors.text} />
        )
      )}
    </TVFocusable>
  );

  if (!isFocused && Platform.OS === 'web') return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <Text style={[styles.logoText, { color: colors.gold }]}>EN</Text>
            <Text style={[styles.logoText, { color: colors.text }]}>-TEC</Text>
            <Text style={[styles.logoSub, { color: colors.text }]}>Streaming</Text>
          </View>
        </View>
        <View style={styles.headerCenter}>
          <LiveClock />
        </View>
        <View style={styles.headerRight}>
          <View style={styles.actionsContainer}>
            <IconButton icon="refresh" onPress={handleRefresh} loading={isRefreshing} />
            <IconButton icon="settings-outline" onPress={() => router.push('/settings')} />
          </View>
        </View>
      </View>

      <View style={styles.contentLayout}>
        {/* Large Cards Row */}
        <View style={styles.largeCardsRow}>
          <LargeCard title="Live TV" imageSource={require('@/assets/images/live_tv_3d.png')} path="/live" />
          <LargeCard title="Movies" imageSource={require('@/assets/images/movies_3d.png')} path="/movies" />
          <LargeCard title="Series" imageSource={require('@/assets/images/series_3d.png')} path="/series" />
        </View>

        {/* Small Cards Row */}
        <View style={styles.smallCardsRow}>
          <SmallCard title="Catch Up" icon="time-outline" onPress={() => router.push('/catchup')} />
          <SmallCard title="Playlists" icon="list-outline" onPress={() => router.push('/playlists')} />
        </View>

        {/* Info Footer */}
        <View style={styles.infoWrapper}>
          <View style={styles.infoGroup}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Device ID</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{deviceId}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoGroup}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Device Key</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{deviceKey}</Text>
          </View>
          <View style={{flex: 1}} />
          <View style={styles.infoGroupRight}>
            <Text style={[styles.infoLabel, { color: colors.gold }]}>App Expiry</Text>
            <Text style={[styles.infoValue, { color: colors.gold }]}>{appExpiry}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoGroupRight}>
            <Text style={[styles.infoLabel, { color: colors.gold }]}>Playlist Expiry</Text>
            <Text style={[styles.infoValue, { color: colors.gold }]}>{playlistExpiry}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 50,
    paddingTop: 30,
    paddingBottom: 40,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  logoSub: {
    fontSize: 32,
    fontWeight: '300',
    opacity: 0.8,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  contentLayout: {
    flex: 1,
    gap: 30,
  },
  largeCardsRow: {
    flex: 3,
    flexDirection: 'row',
    gap: 30,
  },
  largeCard: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeCardTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  smallCardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginTop: 10,
    marginBottom: 20,
  },
  smallCard: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallCardIconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  smallCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  infoGroup: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  infoGroupRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 30,
  },
});
