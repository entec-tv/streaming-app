---
name: tv-remote-navigation
description: Guidelines and patterns for implementing TV remote (D-pad/spatial navigation) friendly components in the EN-TEC Streaming application.
---

# TV Remote Navigation & Accessibility Skill

This skill provides the mandatory guidelines for building interactive UI elements compatible with Smart TVs (Android TV, Apple TV, webOS, Tizen) and PC keyboard navigation.

## Core Rule
**Never use `<Pressable>`, `<TouchableOpacity>`, or `<TouchableWithoutFeedback>` for interactive elements in `artifacts/streaming/`.**  
Always use `<TVFocusable>` from `@/components/TVFocusable`.

## Implementation Pattern

```tsx
import { TVFocusable } from '@/components/TVFocusable';
import { StyleSheet, Text, View } from 'react-native';

export function ActionCard({ title, onPress, isSelected }: { title: string; onPress: () => void; isSelected?: boolean }) {
  return (
    <TVFocusable
      onPress={onPress}
      style={({ focused }: { focused: boolean }) => [
        styles.card,
        isSelected && styles.cardSelected,
        focused && styles.cardFocused,
      ]}
    >
      {({ focused }: { focused: boolean }) => (
        <View style={styles.content}>
          <Text style={[styles.text, focused && styles.textFocused]}>
            {title}
          </Text>
        </View>
      )}
    </TVFocusable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#151B28',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: 'rgba(244, 197, 66, 0.5)',
  },
  cardFocused: {
    borderColor: '#F4C542', // Golden accent
    backgroundColor: '#1E2638',
    transform: [{ scale: 1.05 }],
  },
  text: {
    color: '#FFF',
    fontSize: 14,
  },
  textFocused: {
    color: '#F4C542',
    fontWeight: 'bold',
  },
});
```

## Critical Focus Trapping Rules
1. **Modal Overlays**: When creating backdrop overlays to dismiss modals, use:
   ```tsx
   <TVFocusable disableBorder onPress={dismissModal} style={styles.backdropOverlay}>
     {() => <View style={{ flex: 1 }} />}
   </TVFocusable>
   ```
   Or ensure regular `<View>` containers have `focusable={false}` so the user does not get stuck in an invisible element with the D-Pad.
2. **Text Inputs (`<TextInput>`)**: Must always be wrapped inside `<TVFocusable>` or provide an on-screen TV keyboard (such as `@/components/TVKeyboard`).
3. **Scrollable Lists (`FlatList` / `ScrollView`)**: Ensure `showsVerticalScrollIndicator={false}` and that items pass focus sequentially without jumping out of the viewport.
