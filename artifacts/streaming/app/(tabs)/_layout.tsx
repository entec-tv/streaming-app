import { Ionicons } from '@expo/vector-icons';
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, router } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { Search1Bulk, User4Bulk } from '@lineiconshq/free-icons';
import { TVFocusable } from '@/components/TVFocusable';
import { Platform, StyleSheet, View, Text, useWindowDimensions, ActivityIndicator } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";
import { usePathname } from "expo-router";
import { TVSidebar } from "@/components/TVSidebar";
import { GlobalHeader } from "@/components/GlobalHeader";
import { useAppStore } from "@/store/app-store";



function ClassicTabLayout() {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 1024 || Platform.isTV;
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const isLandscape = width > height;
  const subscriptionExpired = useAppStore((s) => s.subscriptionExpired);
  const isFullscreen = useAppStore((s) => s.isFullscreen);
  const { isRTL, t, language } = useTranslation();
  const pathname = usePathname();

  const [isMobileRefreshing, setIsMobileRefreshing] = React.useState(false);
  const checkAuthStatus = useAppStore((s) => s.checkAuthStatus);
  const refreshPlaylist = useAppStore((s) => s.refreshPlaylist);
  const showGlobalAlert = useAppStore((s) => s.showGlobalAlert);
  const hideGlobalAlert = useAppStore((s) => s.hideGlobalAlert);

  const handleMobileRefresh = async () => {
    if (isMobileRefreshing) return;
    setIsMobileRefreshing(true);
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
      console.error('Failed to refresh data from mobile header:', error);
    } finally {
      setIsMobileRefreshing(false);
    }
  };

  // Background search index preloading
  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const searchIndexReady = useAppStore((s) => s.searchIndexReady);
  const loadingSearchIndex = useAppStore((s) => s.loadingSearchIndex);
  const loadSearchIndex = useAppStore((s) => s.loadSearchIndex);

  React.useEffect(() => {
    if (activePlaylistId && !searchIndexReady && !loadingSearchIndex) {
      loadSearchIndex(activePlaylistId).catch(() => {});
    }
  }, [activePlaylistId, searchIndexReady, loadingSearchIndex]);

  return (
    <View key={`tab-layout-${language}`} style={[styles.layoutContainer, { backgroundColor: '#05070a' }]}>
      <LinearGradient
        colors={['rgba(5,7,10,1)', 'rgba(5,7,10,1)', 'rgba(5,7,10,1)', 'rgba(28,49,89,0.35)']}
        locations={[0, 0.45, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: '#05070a' }]}
      />
      {(!subscriptionExpired && !isFullscreen) && <TVSidebar />}
      <View style={[styles.contentContainer, { backgroundColor: '#05070a' }, (isLargeScreen && !subscriptionExpired && !isFullscreen) && (isRTL ? { paddingRight: 76 } : { paddingLeft: 76 })]}>
        <Tabs
          key={`tabs-${language}`}
          screenOptions={{
            sceneStyle: { backgroundColor: '#05070a' },
            lazy: true,
            headerShown: !isLargeScreen,
            headerTransparent: isLandscape,
            headerTitle: '',
            headerLeft: () => !isLandscape ? (
              <View style={{ paddingLeft: 20 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 1, color: colors.gold }}>
                  EN<Text style={{ color: colors.text }}>-TEC</Text>
                </Text>
              </View>
            ) : null,
            headerRight: () => (
              <View style={{ flexDirection: 'row', gap: 12, paddingRight: 20, paddingTop: isLandscape ? Math.max(Platform.OS === 'ios' ? 10 : 0, 10) : 0 }}>
                <TVFocusable 
                  onPress={handleMobileRefresh}
                  disabled={isMobileRefreshing}
                  style={({ focused }: any) => [
                    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
                    focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                  ]}
                >
                  {({ focused }: any) => (
                    isMobileRefreshing ? (
                      <ActivityIndicator size="small" color={colors.gold} />
                    ) : (
                      <Ionicons name="refresh" size={20} color={focused ? "#000" : colors.text} />
                    )
                  )}
                </TVFocusable>
                <TVFocusable 
                  onPress={() => router.push('/downloads')}
                  style={({ focused }: any) => [
                    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
                    focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                  ]}
                >
                  {({ focused }: any) => <Ionicons name="download-outline" size={22} color={focused ? "#000" : colors.text} />}
                </TVFocusable>
                <TVFocusable 
                  onPress={() => router.push('/search')}
                  style={({ focused }: any) => [
                    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
                    focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                  ]}
                >
                  {({ focused }: any) => <Lineicons icon={Search1Bulk} size={22} color={focused ? "#000" : colors.text} />}
                </TVFocusable>
                <TVFocusable 
                  onPress={() => router.push('/settings')}
                  style={({ focused }: any) => [
                    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
                    focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
                  ]}
                >
                  {({ focused }: any) => <Lineicons icon={User4Bulk} size={22} color={focused ? "#000" : colors.text} />}
                </TVFocusable>
              </View>
            ),
            headerStyle: {
              backgroundColor: isLandscape ? 'transparent' : colors.background,
              borderBottomWidth: isLandscape ? 0 : 1,
              borderBottomColor: colors.border,
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarActiveTintColor: colors.tint,
            tabBarInactiveTintColor: colors.mutedForeground,
            tabBarStyle: {
              display: isLargeScreen ? 'none' : 'flex',
              position: "absolute",
              backgroundColor: isIOS ? "transparent" : 'rgba(17,22,32,0.95)',
              borderTopWidth: 0,
              elevation: 0,
              height: isWeb ? 84 : (isLandscape ? 56 : 70),
              paddingBottom: isWeb ? 34 : (isLandscape ? 6 : 10),
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '500',
            },
            tabBarBackground: () =>
              isIOS ? (
                <BlurView
                  intensity={95}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
              ) : isWeb ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: 'rgba(17,22,32,0.95)' },
                  ]}
                />
              ) : null,
          }}
        >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home') || "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ paddingTop: 4 }}>
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: t('live_tv') || "Live TV",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ paddingTop: 4 }}>
              <Ionicons name={focused ? "tv" : "tv-outline"} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: t('movies') || "Movies",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ paddingTop: 4 }}>
              <Ionicons name={focused ? "film" : "film-outline"} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: t('series') || "Series",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ paddingTop: 4 }}>
              <Ionicons name={focused ? "albums" : "albums-outline"} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="catchup"
        options={{
          title: t('catchup') || "Catch Up",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ paddingTop: 4 }}>
              <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          href: null,
          title: t('favorites') || "Favorites",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: t('profile') || "Profile",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: t('settings') || "Settings",
        }}
      />
      
      
      
    </Tabs>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  layoutContainer: {
    flex: 1,
    backgroundColor: '#05070a',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#05070a',
  }
});
