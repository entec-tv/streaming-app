import { Ionicons } from "@expo/vector-icons";
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TVFocusable } from './TVFocusable';
import { useColors } from '@/hooks/useColors';


import { useVoiceSearch } from '@/hooks/useVoiceSearch';

interface TVKeyboardProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  suggestions?: string[];
  onSuggestionPress?: (suggestion: string) => void;
  autoFocus?: boolean;
  style?: any;
}

const EN_LAYOUT_LOWER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '['],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\''],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '@']
];

const EN_LAYOUT_UPPER = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', '"'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?', '+']
];

const AR_LAYOUT = [
  ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '٠', '-'],
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ']
];

export function TVKeyboard({ value, onChangeText, onSubmit, suggestions = [], onSuggestionPress, autoFocus, style }: TVKeyboardProps) {
  const colors = useColors();
  const [language, setLanguage] = useState<'EN' | 'AR'>('EN');
  const [isShift, setIsShift] = useState(false);

  const { isListening, toggleListening, isSupported } = useVoiceSearch((text) => {
    onChangeText(value ? `${value} ${text}` : text);
  });

  const currentLayout = useMemo(() => {
    if (language === 'AR') return AR_LAYOUT;
    return isShift ? EN_LAYOUT_UPPER : EN_LAYOUT_LOWER;
  }, [language, isShift]);

  const handleKeyPress = (key: string) => {
    onChangeText(value + key);
  };

  const handleBackspace = () => {
    onChangeText(value.slice(0, -1));
  };

  const handleClear = () => {
    onChangeText('');
  };

  const handleSpace = () => {
    onChangeText(value + ' ');
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'EN' ? 'AR' : 'EN');
  };

  const toggleShift = () => {
    if (language === 'EN') {
      setIsShift(prev => !prev);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }, style]}>
      {/* Suggestions Row */}
      {suggestions.length > 0 && (
        <ScrollView 
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: 20 }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 4 }}
        >
          {suggestions.map((suggestion, index) => (
            <TVFocusable
              key={`sug_${index}`}
              onPress={() => {
                if (onSuggestionPress) {
                  onSuggestionPress(suggestion);
                } else {
                  onChangeText(suggestion);
                  onSubmit();
                }
              }}
              style={({ focused }: any) => [
                styles.suggestionChip,
                { backgroundColor: focused ? colors.gold : colors.surface2, borderColor: focused ? colors.gold : colors.border }
              ]}
            >
              {({ focused }: any) => (
                <Text style={[styles.suggestionText, { color: focused ? '#000' : colors.text }]} numberOfLines={1}>
                  {suggestion}
                </Text>
              )}
            </TVFocusable>
          ))}
        </ScrollView>
      )}

      {/* Keyboard Grid */}
      <View style={styles.keyboardGrid}>
        {currentLayout.map((row, rowIndex) => (
          <View key={`row_${rowIndex}`} style={styles.row}>
            {row.map((key, colIndex) => (
              <TVFocusable
                key={`key_${rowIndex}_${key}`}
                hasTVPreferredFocus={autoFocus && rowIndex === 1 && colIndex === 0}
                onPress={() => handleKeyPress(key)}
                style={({ focused }: any) => [
                  styles.keyButton,
                  { backgroundColor: focused ? colors.gold : colors.surface2, borderColor: focused ? colors.gold : colors.border }
                ]}
              >
                {({ focused }: any) => (
                  <Text style={[styles.keyText, { color: focused ? '#000' : colors.text }]}>
                    {key}
                  </Text>
                )}
              </TVFocusable>
            ))}
          </View>
        ))}

        {/* Action Row */}
        <View style={[styles.row, { marginTop: 8 }]}>
          {/* Language Toggle */}
          <TVFocusable
            onPress={toggleLanguage}
            style={({ focused }: any) => [
              styles.actionButton,
              { flex: 1, backgroundColor: focused ? colors.gold : colors.surface2, borderColor: focused ? colors.gold : colors.border }
            ]}
          >
            {({ focused }: any) => (
              <View style={styles.actionInner}>
                <Text style={[styles.actionText, { color: focused ? '#000' : colors.text }]}>{language === 'EN' ? 'ع' : 'E'}</Text>
              </View>
            )}
          </TVFocusable>

          {/* Shift (only for EN) */}
          {language === 'EN' && (
            <TVFocusable
              onPress={toggleShift}
              style={({ focused }: any) => [
                styles.actionButton,
                { flex: 1.5, backgroundColor: isShift ? (focused ? '#B88B2A' : colors.gold) : (focused ? colors.gold : colors.surface2), borderColor: focused ? '#FFF' : colors.border }
              ]}
            >
              {({ focused }: any) => (
                <Text style={[styles.actionText, { color: (focused || isShift) ? '#000' : colors.text }]}>Caps</Text>
              )}
            </TVFocusable>
          )}

          {/* Mic Button */}
          {isSupported && (
            <TVFocusable
              onPress={toggleListening}
              style={({ focused }: any) => [
                styles.actionButton,
                { flex: 1.5, backgroundColor: isListening ? colors.destructive : (focused ? colors.gold : colors.surface2), borderColor: isListening ? colors.destructive : (focused ? colors.gold : colors.border) }
              ]}
            >
              {({ focused }: any) => (
                <View style={styles.actionInner}>
                  <Ionicons name="mic-outline" size={20} color={isListening ? '#FFF' : (focused ? '#000' : colors.text)} />
                </View>
              )}
            </TVFocusable>
          )}

          {/* Space */}
          <TVFocusable
            onPress={handleSpace}
            style={({ focused }: any) => [
              styles.actionButton,
              { flex: 4, backgroundColor: focused ? colors.gold : colors.surface2, borderColor: focused ? colors.gold : colors.border }
            ]}
          >
             {({ focused }: any) => (
               <Text style={[styles.actionText, { color: focused ? '#000' : colors.mutedForeground }]}>Space</Text>
             )}
          </TVFocusable>

          {/* Backspace */}
          <TVFocusable
            onPress={handleBackspace}
            style={({ focused }: any) => [
              styles.actionButton,
              { flex: 1.5, backgroundColor: focused ? colors.destructive : colors.surface2, borderColor: focused ? colors.destructive : colors.border }
            ]}
          >
            {({ focused }: any) => (
              <View style={styles.actionInner}>
                <Ionicons name="chevron-back" size={20} color={focused ? '#FFF' : colors.text} />
              </View>
            )}
          </TVFocusable>

          {/* Clear */}
          <TVFocusable
            onPress={handleClear}
            style={({ focused }: any) => [
              styles.actionButton,
              { flex: 1.5, backgroundColor: focused ? colors.destructive : colors.surface2, borderColor: focused ? colors.destructive : colors.border }
            ]}
          >
            {({ focused }: any) => (
              <View style={styles.actionInner}>
                <Ionicons name="close" size={20} color={focused ? '#FFF' : colors.text} />
              </View>
            )}
          </TVFocusable>

          {/* Search/Enter */}
          <TVFocusable
            onPress={onSubmit}
            style={({ focused }: any) => [
              styles.actionButton,
              { flex: 2, backgroundColor: focused ? colors.gold : colors.surface2, borderColor: focused ? colors.gold : colors.border }
            ]}
          >
            {({ focused }: any) => (
              <View style={styles.actionInner}>
                <Ionicons name="search" size={20} color={focused ? '#000' : colors.text} />
              </View>
            )}
          </TVFocusable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  suggestionsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 200,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  keyboardGrid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  keyButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 60,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '500',
  },
  actionButton: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
