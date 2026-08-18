import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, ScrollView, Linking } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import packageJson from '../../package.json';

export default function SettingsScreen() {
  const isFocused = useIsFocused();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const clearAppCache = useAppStore(s => s.clearAppCache);
  const showGlobalAlert = useAppStore(s => s.showGlobalAlert);
  const hideGlobalAlert = useAppStore(s => s.hideGlobalAlert);
  const deviceId = useAppStore(s => s.deviceId) || 'N/A';
  const deviceKey = useAppStore(s => s.deviceKey) || 'N/A';
  const activePlaylistId = useAppStore(s => s.activePlaylistId);
  const playlists = useAppStore(s => s.playlists);

  const SETTINGS_CATEGORIES = [
    // Row 1
    { id: 'network', title: t('network'), icon: 'globe-outline', color: '#FFE082', androidOnly: true },
    { id: 'parental', title: t('parental'), icon: 'lock-closed-outline', color: '#FFCCBC' },
    { id: 'updates', title: t('updates'), icon: 'sync-circle-outline', color: '#C8E6C9' },
    { id: 'language', title: t('language'), icon: 'language-outline', color: '#E1BEE7' },
    
    // Row 2
    { id: 'app_info', title: t('app_info'), icon: 'apps-outline', color: '#B3E5FC' },
    { id: 'clear_cache', title: t('clear_cache'), icon: 'trash-bin-outline', color: '#FFF9C4' },
    { id: 'manage_categories', title: t('manage_categories'), icon: 'options-outline', color: '#E1BEE7' },
    { id: 'live_player', title: t('live_player'), icon: 'play-circle-outline', color: '#FFF59D' },
    
    // Row 3
    { id: 'vod_player', title: t('vod_player'), icon: 'film-outline', color: '#C8E6C9' },
    { id: 'home_bg', title: t('home_bg'), icon: 'color-palette-outline', color: '#B2DFDB' },
    { id: 'strategy', title: t('strategy'), icon: 'folder-open-outline', color: '#D7CCC8' },
    { id: 'autoplay', title: t('autoplay'), icon: 'play-outline', color: '#FFCDD2' },
    { id: 'auto_boot', title: t('auto_boot'), icon: 'power-outline', color: '#EF9A9A', androidOnly: true },
    
    // Row 4
    { id: 'more_options', title: t('more_options'), icon: 'list-outline', color: '#B2EBF2' },
    { id: 'more_settings', title: t('more_settings'), icon: 'settings-outline', color: '#FFCDD2', androidOnly: true },
  ].filter(c => !c.androidOnly || Platform.OS === 'android');

  // Calculate columns based on screen width
  const isLargeScreen = width >= 1024 || Platform.isTV;
  const numColumns = isLargeScreen ? 4 : (width > 800 ? 4 : (width > 500 ? 3 : 2));
  
  const handleCategoryPress = (id: string) => {
    console.log('Settings category pressed:', id);
    if (id === 'network') {
      if (Platform.OS === 'ios') {
        Linking.openURL('App-Prefs:root=WIFI').catch(() => {});
      } else if (Platform.OS === 'android') {
        // Try standard settings intent
        Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() => {
          Linking.sendIntent('android.settings.SETTINGS').catch(() => {});
        });
      } else if (Platform.OS === 'web') {
        // Desktop app
        fetch('/open_network_settings').catch(() => {});
      }
    } else if (id === 'app_info') {
      const activePlaylist = playlists.find(p => p.id === activePlaylistId);
      const appExpiryRaw = useAppStore.getState().appExpiry;
      const appExpiry = appExpiryRaw ? new Date(appExpiryRaw).toLocaleDateString('ar-EG') : 'Lifetime';
      const playlistExpiry = activePlaylist?.updated || 'Active';

      showGlobalAlert(
        t('app_info'),
        `${t('version')}: ${packageJson.version}\n${t('platform')}: ${Platform.OS}\n${t('environment')}: ${__DEV__ ? 'Development' : 'Production'}\n\nDevice ID: ${deviceId}\nDevice Key: ${deviceKey}\nApp Expiry: ${appExpiry}\nPlaylist Expiry: ${playlistExpiry}`,
        t('close'),
        () => hideGlobalAlert()
      );
    } else if (id === 'clear_cache') {
      showGlobalAlert(
        t('clear_cache'),
        t('clear_cache_confirm'),
        t('clear_cache'),
        async () => {
          await clearAppCache();
          hideGlobalAlert();
          showGlobalAlert(t('success'), t('cache_cleared'), t('ok'), () => hideGlobalAlert());
        },
        {
          text: t('cancel'),
          onPress: () => hideGlobalAlert()
        }
      );
    } else if (id === 'manage_categories') {
      router.push('/manage-categories');
    } else if (id === 'strategy') {
      router.push('/content-strategy');
    } else if (id === 'autoplay') {
      router.push('/auto-play');
    } else if (id === 'language') {
      router.push('/language-selector' as any);
    } else if (id === 'more_settings') {
      if (Platform.OS === 'ios') {
        Linking.openURL('App-Prefs:root=General').catch(() => {});
      } else if (Platform.OS === 'android') {
        Linking.sendIntent('android.settings.SETTINGS').catch(() => {});
      } else if (Platform.OS === 'web') {
        fetch('/open_settings').catch(() => {});
      }
    } else if (id === 'more_options') {
      router.push('/more-options' as any);
    } else if (id === 'live_player') {
      router.push('/live-player-selector' as any);
    } else if (id === 'vod_player') {
      router.push('/vod-player-selector' as any);
    } else if (id === 'auto_boot') {
      router.push('/auto-boot' as any);
    } else if (id === 'home_bg') {
      router.push('/background-selector' as any);
    } else if (id === 'parental') {
      router.push('/parental-settings' as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top, display: isFocused ? 'flex' : 'none' }]}>
      <View style={styles.header}>
        <Ionicons name="settings-outline" size={32} color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>{t('settings')}</Text>
      </View>
      
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }}>
        <View style={styles.grid}>
          {SETTINGS_CATEGORIES.map((cat, index) => {
            const itemWidth = `${100 / numColumns}%` as any;
            return (
              <View key={cat.id} style={{ width: itemWidth, padding: 8 }}>
                <TVFocusable
                  style={({ focused }: any) => [
                    styles.card,
                    { 
                      backgroundColor: colors.surface, // Opaque background
                      borderColor: colors.border,
                    },
                    focused && { 
                      backgroundColor: colors.card,
                      borderColor: colors.gold, 
                      transform: [{ scale: 1.05 }],
                      elevation: 10,
                      shadowColor: colors.gold,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 10
                    }
                  ]}
                  onPress={() => handleCategoryPress(cat.id)}
                  focusable={true}
                >
                  <View style={styles.cardContent}>
                    <Ionicons name={cat.icon as any} size={36} color={cat.color} style={{ marginBottom: 12 }} />
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2} adjustsFontSizeToFit>
                      {cat.title}
                    </Text>
                  </View>
                </TVFocusable>
              </View>
            );
          })}
        </View>
      </ScrollView>
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
    justifyContent: 'center',
    marginVertical: 20,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8, // Compensate for item padding
  },
  card: {
    height: 110,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    width: '100%',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  }
});
