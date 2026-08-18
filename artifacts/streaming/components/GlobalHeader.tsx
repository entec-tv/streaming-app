import { Ionicons } from "@expo/vector-icons";
import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';


import { router } from 'expo-router';
import { TVFocusable } from './TVFocusable';

export function GlobalHeader() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  return (
    <View 
      pointerEvents="box-none"
      style={[styles.headerContainer, { 
      paddingTop: Platform.OS === 'ios' ? Math.max(insets.top, 10) : isLandscape ? Math.max(insets.top, 10) : insets.top + 10,
      paddingBottom: isLandscape ? 4 : 10,
      backgroundColor: isLandscape ? undefined : colors.background,
      borderBottomWidth: isLandscape ? 0 : 1,
      borderBottomColor: colors.border
    }]}>
      <View style={styles.left} pointerEvents="box-none">
        {!isLandscape && (
          <Text style={[styles.logoText, { color: colors.gold }]}>
            EN<Text style={{ color: colors.text }}>-TEC</Text>
          </Text>
        )}
      </View>
      
      <View style={[styles.right, { gap: 12 }]} pointerEvents="box-none">
        <TVFocusable 
          onPress={() => router.push('/search')}
          style={({ focused }: any) => [
            styles.iconBtn,
            { backgroundColor: colors.surface },
            focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
          ]}
        >
          {({ focused }: any) => (
            <Ionicons name="search" size={22} color={focused ? "#000" : colors.text} />
          )}
        </TVFocusable>
        <TVFocusable 
          onPress={() => router.push('/settings')}
          style={({ focused }: any) => [
            styles.iconBtn,
            { backgroundColor: colors.surface },
            focused && { backgroundColor: colors.gold, transform: [{ scale: 1.1 }] }
          ]}
        >
          {({ focused }: any) => (
            <Ionicons name="person-circle-outline" size={22} color={focused ? "#000" : colors.text} />
          )}
        </TVFocusable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 100,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    transitionDuration: '200ms',
  }
});
