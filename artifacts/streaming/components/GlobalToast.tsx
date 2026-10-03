import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/app-store';
import { useColors } from '@/hooks/useColors';

export function GlobalToast() {
  const globalToast = useAppStore((s) => s.globalToast);
  const hideToast = useAppStore((s) => s.hideToast);
  const colors = useColors();

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (globalToast) {
      if (timerRef.current) clearTimeout(timerRef.current);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 20,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        dismiss();
      }, 4000);
    } else {
      dismiss();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [globalToast]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (globalToast) {
        hideToast();
      }
    });
  };

  if (!globalToast) return null;

  const isSuccess = globalToast.type === 'success' || !globalToast.type;
  const isWarning = globalToast.type === 'warning';
  const iconName = isSuccess ? 'checkmark-circle' : isWarning ? 'warning' : 'information-circle';
  const iconColor = isSuccess ? '#4ADE80' : isWarning ? '#FACC15' : colors.gold;
  const borderColor = isSuccess ? 'rgba(74, 222, 128, 0.4)' : isWarning ? 'rgba(250, 204, 21, 0.4)' : 'rgba(212, 168, 67, 0.4)';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable onPress={dismiss} style={styles.pressable}>
        <View style={[styles.toastBox, { borderColor }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} style={StyleSheet.absoluteFillObject} tint="dark" />
          <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
            <Ionicons name={iconName as any} size={24} color={iconColor} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: colors.text }]}>{globalToast.title}</Text>
            <Text style={[styles.message, { color: colors.mutedForeground }]}>{globalToast.message}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999999,
    elevation: 999999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    maxWidth: '90%',
    width: 420,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'right',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
});
