import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { TVFocusable } from './TVFocusable';

interface CategoryPillProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export function CategoryPill({ label, isActive, onPress }: CategoryPillProps) {
  const colors = useColors();

  return (
    <TVFocusable
      onPress={onPress}
      disableBorder={true}
      style={{ marginRight: 8 }}
    >
      {({ focused, pressed }: { focused: boolean; pressed: boolean }) => (
        <Text
          style={[
            styles.label,
            styles.container,
            {
              backgroundColor: isActive ? colors.gold : colors.surface,
              borderColor: focused || pressed ? colors.gold : (isActive ? colors.gold : colors.border),
              borderWidth: focused || pressed ? 2 : 1,
              color: isActive ? colors.accentForeground : colors.mutedForeground,
            }
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </TVFocusable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
