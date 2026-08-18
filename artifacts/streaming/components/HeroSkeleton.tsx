import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';

export function HeroSkeleton() {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 1024 || Platform.isTV;
  
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  if (isLargeScreen) {
    return (
      <View style={{ width: '100%', height: height * 0.75, backgroundColor: 'transparent' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card, opacity, borderRadius: 16 }]} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', (colors as any).overlay || colors.background]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[(colors as any).overlay || colors.background, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ position: 'absolute', bottom: 120, left: 32, width: '40%' }}>
          <Animated.View style={{ height: 20, width: 100, backgroundColor: colors.border, opacity, borderRadius: 4, marginBottom: 12 }} />
          <Animated.View style={{ height: 48, width: '80%', backgroundColor: colors.border, opacity, borderRadius: 8, marginBottom: 16 }} />
          <Animated.View style={{ height: 20, width: 200, backgroundColor: colors.border, opacity, borderRadius: 4, marginBottom: 24 }} />
          <Animated.View style={{ height: 60, width: '100%', backgroundColor: colors.border, opacity, borderRadius: 8, marginBottom: 40 }} />
          <View style={{ flexDirection: 'row', gap: 16 }}>
             <Animated.View style={{ height: 50, width: 140, backgroundColor: colors.border, opacity, borderRadius: 25 }} />
             <Animated.View style={{ height: 50, width: 140, backgroundColor: colors.border, opacity, borderRadius: 25 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: '100%', height: height * 0.55, backgroundColor: 'transparent' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card, opacity, borderRadius: 16 }]} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', (colors as any).overlay || colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center' }}>
        <Animated.View style={{ height: 16, width: 80, backgroundColor: colors.border, opacity, borderRadius: 4, marginBottom: 12 }} />
        <Animated.View style={{ height: 32, width: 250, backgroundColor: colors.border, opacity, borderRadius: 8, marginBottom: 16 }} />
        <Animated.View style={{ height: 16, width: 150, backgroundColor: colors.border, opacity, borderRadius: 4, marginBottom: 24 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Animated.View style={{ height: 44, width: 120, backgroundColor: colors.border, opacity, borderRadius: 22 }} />
          <Animated.View style={{ height: 44, width: 120, backgroundColor: colors.border, opacity, borderRadius: 22 }} />
        </View>
      </View>
    </View>
  );
}
