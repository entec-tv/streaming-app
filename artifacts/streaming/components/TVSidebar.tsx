import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { TVFocusable } from '@/components/TVFocusable';
import { useAppStore } from '@/store/app-store';
// Lineicons removed in favor of Ionicons

const MAIN_TABS = [
  { name: 'home', path: '/', icon: 'home-outline', label: 'Home', iosIcon: 'house' },
  { name: 'live', path: '/live', icon: 'tv-outline', label: 'Live TV', iosIcon: 'tv' },
  { name: 'movies', path: '/movies', icon: 'film-outline', label: 'Movies', iosIcon: 'film' },
  { name: 'series', path: '/series', icon: 'layers-outline', label: 'Series', iosIcon: 'ticket' },
  { name: 'catchup', path: '/catchup', icon: 'time-outline', label: 'Replay', iosIcon: 'clock.arrow.circlepath' },
];

const GOLD = '#F4C542';

function SidebarItem({ icon, bulkIcon, iosIcon, isActive, onPress, isIOS, customContent, onFocus, nativeID }: any) {
  const { isRTL } = useTranslation();
  return (
    <TVFocusable nativeID={nativeID} {...(nativeID ? { id: nativeID } : {})} onPress={onPress} onFocus={onFocus} style={[styles.tabBtn]} disableBorder={true}>
      {({ focused }: any) => (
        <View style={StyleSheet.absoluteFill}>
          <View style={[
            StyleSheet.absoluteFillObject,
            styles.itemBase,
            isActive && styles.itemActive,
            focused && !isActive && styles.itemFocused,
            focused && isActive && styles.itemFocusedActive,
          ]} />
          <View style={[styles.iconContainer, isRTL && { transform: [{ scaleX: -1 }] }]}>
            {customContent ? customContent : (
              isIOS ? (
                <SymbolView
                  name={iosIcon}
                  tintColor={isActive ? GOLD : focused ? GOLD : 'rgba(255,255,255,0.55)'}
                  size={22}
                />
              ) : (
                <Ionicons
                  name={icon as any}
                  size={22}
                  color={isActive ? GOLD : focused ? GOLD : 'rgba(255,255,255,0.55)'}
                />
              )
            )}
          </View>
          {isActive && (
            <View style={styles.activeIndicator} />
          )}
        </View>
      )}
    </TVFocusable>
  );
}

export function TVSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useColors();
  const { isRTL, t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 1024 || Platform.isTV;
  const isWeb = Platform.OS === 'web';

  const [isRefreshing, setIsRefreshing] = useState(false);
  const checkAuthStatus = useAppStore(s => s.checkAuthStatus);
  const refreshPlaylist = useAppStore(s => s.refreshPlaylist);
  const activePlaylistId = useAppStore(s => s.activePlaylistId);
  const showGlobalAlert = useAppStore(s => s.showGlobalAlert);
  const hideGlobalAlert = useAppStore(s => s.hideGlobalAlert);

  const handleSidebarRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await checkAuthStatus();
      if (activePlaylistId) {
        await refreshPlaylist(activePlaylistId);
      }
      showGlobalAlert(
        t('success') || 'Success',
        t('refresh_success') || 'Data refreshed successfully',
        t('ok') || 'OK',
        () => hideGlobalAlert()
      );
    } catch (error) {
      console.error('Failed to refresh data from sidebar:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isLargeScreen) return null;

  const renderLogo = () => (
    <View style={[styles.logoContainer, isRTL && { transform: [{ scaleX: -1 }] }]}>
      <Text style={styles.logoEN}>EN</Text>
      <View style={styles.logoDivider} />
      <Text style={styles.logoTEC}>TEC</Text>
    </View>
  );

  const sidebarBg: any = isWeb
    ? {
        backgroundColor: 'rgba(14,16,21,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.04)',
      }
    : {
        backgroundColor: 'rgba(14,16,21,0.95)',
        borderRightWidth: isRTL ? 0 : 1,
        borderLeftWidth: isRTL ? 1 : 0,
        borderRightColor: colors.border,
        borderLeftColor: colors.border,
      };

  const mainTabs = [
    { name: 'home', path: '/', icon: 'home-outline', label: t('home') || 'Home', iosIcon: 'house' },
    { name: 'live', path: '/live', icon: 'tv-outline', label: t('live_tv') || 'Live TV', iosIcon: 'tv' },
    { name: 'movies', path: '/movies', icon: 'film-outline', label: t('movies') || 'Movies', iosIcon: 'film' },
    { name: 'series', path: '/series', icon: 'layers-outline', label: t('series') || 'Series', iosIcon: 'ticket' },
    { name: 'catchup', path: '/catchup', icon: 'time-outline', label: t('catchup') || 'Replay', iosIcon: 'clock.arrow.circlepath' },
  ];

  return (
    <View
      nativeID="tour-sidebar-nav"
      data-focus-zone="sidebar"
      {...({ id: 'tour-sidebar-nav' } as any)}
      style={[
        styles.sidebar,
        {
          paddingTop: insets.top > 0 ? insets.top + 12 : 16,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 24,
          ...(isRTL ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' })
        },
        sidebarBg,
      ]}
    >
      <View style={styles.navGroup}>
        <SidebarItem
          customContent={renderLogo()}
          onPress={() => router.navigate('/')}
          isIOS={isIOS}
        />

        <SidebarItem
          nativeID="tour-search-btn"
          icon="search-outline"
          iosIcon="magnifyingglass"
          isActive={pathname === '/search'}
          onPress={() => router.navigate({ pathname: '/search', params: { tab: 'all' } })}
          isIOS={isIOS}
        />

        <View style={styles.divider} />

        {mainTabs.map((tab: any) => {
          const isActive =
            tab.path === '/'
              ? pathname === '/'
              : pathname === tab.path || pathname.startsWith(tab.path);

          return (
            <SidebarItem
              key={tab.name}
              icon={tab.icon}
              bulkIcon={tab.bulkIcon}
              iosIcon={tab.iosIcon}
              isActive={isActive}
              onPress={() => router.navigate(tab.path as any)}
              isIOS={isIOS}
            />
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.navGroup}>
        <SidebarItem
          nativeID="tour-refresh-btn"
          icon="refresh-outline"
          iosIcon="arrow.clockwise"
          isActive={false}
          onPress={handleSidebarRefresh}
          isIOS={isIOS}
          customContent={
            isRefreshing ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : null
          }
        />
        <SidebarItem
          icon="settings-outline"
          iosIcon="gear"
          isActive={pathname === '/settings'}
          onPress={() => router.navigate('/settings' as any)}
          isIOS={isIOS}
        />
        <SidebarItem
          icon="person-outline"
          iosIcon="person"
          isActive={pathname === '/profile'}
          onPress={() => router.navigate('/profile' as any)}
          isIOS={isIOS}
        />
        {isWeb && (
          <SidebarItem
            icon="power-outline"
            iosIcon="power"
            isActive={false}
            onPress={() => {
              fetch('/exit_app').catch(() => {});
            }}
            isIOS={isIOS}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 76,
    zIndex: 100,
    alignItems: 'center',
  },
  navGroup: {
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 6,
    borderRadius: 1,
  },
  tabBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  itemBase: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  itemActive: {
    backgroundColor: 'rgba(244,197,66,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244,197,66,0.25)',
  },
  itemFocused: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  itemFocusedActive: {
    backgroundColor: 'rgba(244,197,66,0.18)',
  },
  iconContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '25%',
    bottom: '25%',
    width: 3,
    borderRadius: 2,
    backgroundColor: '#F4C542',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  logoEN: {
    color: '#F4C542',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  logoDivider: {
    width: 18,
    height: 1,
    backgroundColor: 'rgba(244,197,66,0.3)',
    borderRadius: 1,
  },
  logoTEC: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
});
