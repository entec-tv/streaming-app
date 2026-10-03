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
  compact?: boolean;
}

export function PlanCard({ title, price, duration, features, isPopular, onPress, compact = false }: PlanCardProps) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <TVFocusable
      onPress={onPress}
      style={({ focused }: any) => [
        styles.container,
        compact && styles.containerCompact,
        {
          backgroundColor: focused ? 'rgba(212,168,67,0.15)' : 'rgba(26,26,26,0.6)',
          borderColor: focused ? colors.gold : (isPopular ? colors.gold : colors.border),
          transform: [{ scale: focused ? (compact ? 1.02 : 1.05) : 1 }]
        }
      ]}
    >
      {/* Background Gradient */}
      <LinearGradient
        colors={isPopular ? ['rgba(212,168,67,0.2)', 'transparent'] : ['transparent', 'transparent']}
        style={[StyleSheet.absoluteFill, { borderRadius: compact ? 16 : 24 }]}
      />

      {isPopular && (
        <View style={[styles.popularBadge, compact && styles.popularBadgeCompact, { backgroundColor: colors.gold }]}>
          <Text style={[styles.popularText, compact && styles.popularTextCompact]}>{t('most_popular')}</Text>
        </View>
      )}

      <Text style={[styles.title, compact && styles.titleCompact, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={[styles.priceContainer, compact && styles.priceContainerCompact]}>
        <Text style={[styles.price, compact && styles.priceCompact, { color: colors.gold }]}>{price}</Text>
        <Text style={[styles.duration, compact && styles.durationCompact, { color: colors.mutedForeground }]}>
          / {duration}
        </Text>
      </View>

      <View style={[styles.featuresContainer, compact && styles.featuresContainerCompact]}>
        {features.slice(0, compact ? 2 : features.length).map((feature, idx) => (
          <View key={idx} style={[styles.featureRow, compact && styles.featureRowCompact]}>
            <Ionicons name="checkmark-circle" size={compact ? 13 : 18} color={colors.gold} />
            <Text style={[styles.featureText, compact && styles.featureTextCompact, { color: colors.mutedForeground }]} numberOfLines={1}>
              {feature}
            </Text>
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
  containerCompact: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 0,
    marginTop: 8,
    width: '100%',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeCompact: {
    top: -8,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  popularTextCompact: {
    fontSize: 9,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 13,
    marginBottom: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
    gap: 4,
  },
  priceContainerCompact: {
    marginBottom: 6,
    gap: 2,
  },
  price: {
    fontSize: 32,
    fontWeight: '900',
  },
  priceCompact: {
    fontSize: 18,
    fontWeight: '800',
  },
  duration: {
    fontSize: 14,
  },
  durationCompact: {
    fontSize: 10,
  },
  featuresContainer: {
    width: '100%',
    gap: 12,
  },
  featuresContainerCompact: {
    gap: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureRowCompact: {
    gap: 4,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
  },
  featureTextCompact: {
    fontSize: 10,
  },
});
