import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TVFocusable } from './TVFocusable';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';

interface PlanCardProps {
  title: string;
  price: string;
  duration: string;
  features: string[];
  isPopular?: boolean;
  onPress: () => void;
}

export function PlanCard({ title, price, duration, features, isPopular, onPress }: PlanCardProps) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <TVFocusable
      onPress={onPress}
      style={({ focused }: any) => [
        styles.container,
        {
          backgroundColor: focused ? 'rgba(212,168,67,0.15)' : 'rgba(26,26,26,0.6)',
          borderColor: focused ? colors.gold : (isPopular ? colors.gold : colors.border),
          transform: [{ scale: focused ? 1.05 : 1 }]
        }
      ]}
    >
      {/* Background Gradient */}
      <LinearGradient
        colors={isPopular ? ['rgba(212,168,67,0.2)', 'transparent'] : ['transparent', 'transparent']}
        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
      />

      {isPopular && (
        <View style={[styles.popularBadge, { backgroundColor: colors.gold }]}>
          <Text style={styles.popularText}>{t('most_popular')}</Text>
        </View>
      )}

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      <View style={styles.priceContainer}>
        <Text style={[styles.price, { color: colors.gold }]}>{price}</Text>
        <Text style={[styles.duration, { color: colors.mutedForeground }]}>/ {duration}</Text>
      </View>

      <View style={styles.featuresContainer}>
        {features.map((feature, idx) => (
          <View key={idx} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{feature}</Text>
          </View>
        ))}
      </View>
    </TVFocusable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 16,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
    gap: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: '900',
  },
  duration: {
    fontSize: 14,
  },
  featuresContainer: {
    width: '100%',
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
  }
});
