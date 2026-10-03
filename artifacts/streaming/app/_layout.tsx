import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as NavigationBar from "expo-navigation-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import '../assets/global.css';
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { Platform, View, Text, Pressable, useWindowDimensions, StatusBar as RNStatusBar, AppState, I18nManager } from "react-native";
import { useKeepAwake, activateKeepAwakeAsync } from "expo-keep-awake";

// Globally disable Android automatic RTL layout flipping
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch (e) {
  console.warn('Failed to set I18nManager in _layout:', e);
}

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalAlert } from "@/components/GlobalAlert";
import { GlobalToast } from "@/components/GlobalToast";
import { useAppStore } from "@/store/app-store";
import { useSpatialNavigationWeb } from "@/hooks/useSpatialNavigationWeb";

const DesktopTitleBar = () => {
  if (Platform.OS !== 'web') return null;

  const { width, height } = useWindowDimensions();
  const [isMaximized, setIsMaximized] = useState(true);

  const checkMaximized = () => {
    fetch('/is_maximized')
      .then(res => res.json())
      .then(data => setIsMaximized(data.isMaximized))
      .catch(() => { });
  };

  useEffect(() => {
    checkMaximized();
    // Poll just in case, but resize will also trigger it
    const interval = setInterval(checkMaximized, 1000);
    return () => clearInterval(interval);
  }, [width, height]);

  return (
    <View style={{ height: 32, backgroundColor: '#000', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', WebkitAppRegion: 'drag' } as any}>
      <View style={{ paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: 'bold', fontFamily: 'Inter_900Black' }}>EN</Text>
        <Text style={{ color: '#d4a843', fontSize: 13, fontWeight: 'bold', fontFamily: 'Inter_900Black' }}>TEC</Text>
      </View>
      <View style={{ flexDirection: 'row', height: '100%', WebkitAppRegion: 'no-drag' } as any}>
        <Pressable
          onPress={() => fetch('/minimize_app').catch(() => { })}
          style={({ hovered }: any) => ({ paddingHorizontal: 16, justifyContent: 'center', backgroundColor: hovered ? '#333' : 'transparent' })}
        >
          <Text style={{ color: '#FFF', fontSize: 10 }}>—</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            fetch('/maximize_app').catch(() => { });
            setTimeout(checkMaximized, 100);
          }}
          style={({ hovered }: any) => ({ paddingHorizontal: 16, justifyContent: 'center', backgroundColor: hovered ? '#333' : 'transparent' })}
        >
          {({ hovered }: any) => (
            isMaximized ? (
              <View style={{ width: 10, height: 10, position: 'relative' }}>
                <View style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderWidth: 1, borderColor: '#FFF' }} />
                <View style={{ position: 'absolute', bottom: 0, left: 0, width: 8, height: 8, borderWidth: 1, borderColor: '#FFF', backgroundColor: hovered ? '#333' : '#000' }} />
              </View>
            ) : (
              <View style={{ width: 10, height: 10, borderWidth: 1, borderColor: '#FFF' }} />
            )
          )}
        </Pressable>
        <Pressable
          onPress={() => fetch('/exit_app').catch(() => { })}
          style={({ hovered }: any) => ({ paddingHorizontal: 16, justifyContent: 'center', backgroundColor: hovered ? '#E81123' : 'transparent' })}
        >
          <Text style={{ color: '#FFF', fontSize: 12 }}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const isAppLocked = useAppStore((s) => s.isAppLocked);
  const subscriptionExpired = useAppStore((s) => s.subscriptionExpired);
  const playlists = useAppStore((s) => s.playlists);
  const initializeFromStorage = useAppStore((s) => s.initializeFromStorage);
  const checkAuthStatus = useAppStore((s) => s.checkAuthStatus);
  const sendHeartbeatPing = useAppStore((s) => s.sendHeartbeatPing);
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const lastRedirectPath = useRef<string | null>(null);

  useEffect(() => {
    initializeFromStorage().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      // Check auth status immediately on login/mount
      checkAuthStatus();
      
      // Periodic heartbeat ping every 60 seconds (lightweight, updates lastActive without reloading playlists)
      const interval = setInterval(() => {
        sendHeartbeatPing();
      }, 60000);

      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          checkAuthStatus();
        }
      });

      return () => {
        clearInterval(interval);
        subscription.remove();
      };
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isReady) return;
    const inAuthGroup = segments[0] === "activation";
    const inPlaylists = segments[0] === "playlists";

    const realPlaylists = playlists.filter(p => !p.isDemo);
    const hasPlaylists = realPlaylists.length > 0;

    let targetPath: string | null = null;

    if ((!isLoggedIn || isAppLocked || subscriptionExpired) && !inAuthGroup) {
      targetPath = "/activation";
    } else if (isLoggedIn && !isAppLocked && !subscriptionExpired) {
      if (!hasPlaylists && !inPlaylists) {
        targetPath = "/playlists";
      } else if (hasPlaylists && inAuthGroup) {
        targetPath = "/(tabs)";
      }
    }

    if (targetPath) {
      if (lastRedirectPath.current !== targetPath) {
        lastRedirectPath.current = targetPath;
        router.replace(targetPath as any);
      }
    } else {
      lastRedirectPath.current = null;
    }
  }, [isLoggedIn, isAppLocked, subscriptionExpired, playlists, segments, isReady]);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: '#05070a' }} />;

  return <>{children}</>;
}

function RootLayoutNav() {
  useSpatialNavigationWeb();

  return (
    <ThemeProvider value={DarkTheme}>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="activation" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="player"
            options={{
              headerShown: false,
              presentation: "transparentModal",
              animation: "fade",
              autoHideHomeIndicator: true,
              navigationBarHidden: true,
            }}
          />
          <Stack.Screen name="playlists" options={{ headerShown: false }} />
        </Stack>
      </AuthGuard>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useKeepAwake();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });
  const appIsReady = useAppStore((s) => s.appIsReady);
  const { width, height } = useWindowDimensions();
  const isPlayerOpen = useAppStore((s) => s.isPlayerOpen);
  const setLastNonPlayerOrientation = useAppStore((s) => s.setLastNonPlayerOrientation);

  useEffect(() => {
    if (!isPlayerOpen && Platform.OS !== 'web') {
      const isPortrait = height > width;
      setLastNonPlayerOrientation(isPortrait ? 'portrait' : 'landscape');
    }
  }, [width, height, isPlayerOpen]);

  useEffect(() => {
    activateKeepAwakeAsync().catch(() => {});
    if (Platform.OS !== 'web') {
      ScreenOrientation.unlockAsync().catch(() => {});
    }
    if ((fontsLoaded || fontError) && appIsReady) {
      SplashScreen.hideAsync();
      
      // Enforce immersive mode globally
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      }
      RNStatusBar.setHidden(true, 'none');
    }
  }, [fontsLoaded, fontError, appIsReady]);

  useEffect(() => {
    let backgroundTime = Date.now();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState.match(/inactive|background/)) {
        backgroundTime = Date.now();
      } else if (nextAppState === 'active') {
        activateKeepAwakeAsync().catch(() => {});
        useAppStore.getState().setupSseConnection();
        const timeElapsed = Date.now() - backgroundTime;
        // If more than 30 minutes in background, refresh active playlist to renew tokens
        if (timeElapsed > 30 * 60 * 1000) {
          const store = useAppStore.getState();
          if (store.activePlaylistId && store.appIsReady) {
            store.refreshPlaylist(store.activePlaylistId).catch(() => { });
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: '#05070a' }} />;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="light" hidden={true} />
            <DesktopTitleBar />
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
            <GlobalAlert />
            <GlobalToast />
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
