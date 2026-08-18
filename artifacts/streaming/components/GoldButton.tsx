import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { TVFocusable } from './TVFocusable';

interface GoldButtonProps {
  title: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
  style?: any;
  disabled?: boolean;
}

export function GoldButton({ title, icon, onPress, variant = 'primary', style, disabled }: GoldButtonProps) {
  const colors = useColors();

  if (variant === 'outline') {
    return (
      <TVFocusable
        onPress={onPress}
        disabled={disabled}
        focusedBorderColor="#FFF"
        style={style}
        disableBorder={true}
      >
        {({ focused }) => (
          <View style={[
            styles.outlineButton, 
            { 
              borderColor: focused ? '#FFF' : colors.gold, 
              backgroundColor: colors.goldDim 
            }
          ]}>
            {icon && <View style={styles.iconWrap}>{icon}</View>}
            <Text style={[styles.outlineTitle, { color: colors.gold }]}>{title}</Text>
          </View>
        )}
      </TVFocusable>
    );
  }

  return (
    <TVFocusable
      onPress={onPress}
      disabled={disabled}
      focusedBorderColor="#FFF"
      style={style}
      disableBorder={true}
    >
      {({ focused }) => (
        <LinearGradient
          colors={[colors.gold, colors.gold, colors.gold]}
          style={[styles.gradient, focused && { borderWidth: 2, borderColor: '#FFF' }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={styles.primaryTitle}>{title}</Text>
        </LinearGradient>
      )}
    </TVFocusable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryTitle: {
    color: '#1A1200',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  outlineButton: {
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
  },
  outlineTitle: {
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
