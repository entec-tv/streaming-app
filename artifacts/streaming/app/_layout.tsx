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
import React, { useEffect, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import '../assets/global.css';
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { Platform, View, Text, Pressable, useWindowDimensions, StatusBar as RNStatusBar, AppState } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalAlert } from "@/components/GlobalAlert";
import { useAppStore } from "@/store/app-store";

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
  const playlists = useAppStore((s) => s.playlists);
  const initializeFromStorage = useAppStore((s) => s.initializeFromStorage);
  const checkAuthStatus = useAppStore((s) => s.checkAuthStatus);
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
      
      const interval = setInterval(() => {
        checkAuthStatus();
      }, 300000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isReady) return;
    const inAuthGroup = segments[0] === "activation";
    const inPlaylists = segments[0] === "playlists";

    const realPlaylists = playlists.filter(p => !p.isDemo);
    const hasPlaylists = realPlaylists.length > 0;

    let targetPath: string | null = null;

    if (!isLoggedIn && !inAuthGroup) {
      targetPath = "/activation";
    } else if (isLoggedIn) {
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
  }, [isLoggedIn, playlists, segments, isReady]);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: '#05070a' }} />;

  return <>{children}</>;
}

function RootLayoutNav() {
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });
  const appIsReady = useAppStore(s => s.appIsReady);

  useEffect(() => {
    if ((fontsLoaded || fontError) && appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, appIsReady]);

  useEffect(() => {
    let backgroundTime = Date.now();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState.match(/inactive|background/)) {
        backgroundTime = Date.now();
      } else if (nextAppState === 'active') {
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
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
