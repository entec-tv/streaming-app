import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/app-store';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function BackgroundSelectorScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  
  const currentThemeId = useAppStore(s => s.currentThemeId);
  const setTheme = useAppStore(s => s.setTheme);
  
  const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId);

  const themesList = [
    { id: 'default', name: 'Classic ENTEC', color: '#0F1115' },
    { id: 'ocean', name: 'Ocean Abyss', color: '#070E1A' },
    { id: 'crimson', name: 'Crimson Silk', color: '#160707' },
    { id: 'forest', name: 'Emerald Forest', color: '#07160B' },
    { id: 'light', name: 'Pure Light', color: '#F8F9FA' },
  ];

  const handleSave = () => {
    setTheme(selectedThemeId);
    router.back();
  };

  const isSmallScreen = width < 700;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('home_bg_title')}</Text>

      <View style={[styles.optionsContainer, isSmallScreen && styles.optionsContainerMobile]}>
        {themesList.map((theme) => (
          <TVFocusable
            key={theme.id}
            style={({ focused }: any) => [
              styles.optionButton,
              { borderColor: 'transparent' },
              focused && [styles.focusedOption, { borderColor: colors.gold, backgroundColor: colors.surface2 }],
              selectedThemeId === theme.id && { borderColor: colors.gold }
            ]}
            onPress={() => setSelectedThemeId(theme.id)}
          >
            {({ focused }: any) => (
              <View style={styles.optionContent}>
                <View style={[styles.colorPreview, { backgroundColor: theme.color, borderColor: colors.border }]} />
                <View style={styles.textContainer}>
                  <Ionicons 
                    name={selectedThemeId === theme.id ? "checkmark-circle" : "ellipse-outline"} 
                    size={24} 
                    color={selectedThemeId === theme.id ? colors.gold : colors.muted} 
                  />
                  <Text style={[
                    styles.optionText, 
                    { color: colors.mutedForeground },
                    selectedThemeId === theme.id && [styles.selectedText, { color: colors.text }]
                  ]}>
                    {theme.name}
                  </Text>
                </View>
              </View>
            )}
          </TVFocusable>
        ))}
      </View>

      <TVFocusable
        style={({ focused }: any) => [
          styles.saveButton,
          { backgroundColor: colors.surface2 },
          focused && [styles.focusedSaveButton, { backgroundColor: colors.gold }]
        ]}
        onPress={handleSave}
      >
        {({ focused }: any) => (
          <Text style={[
            styles.saveButtonText, 
            { color: colors.text },
            focused && { color: colors.background }
          ]}>
            Save
          </Text>
        )}
      </TVFocusable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 50,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 60,
    maxWidth: 1000,
  },
  optionsContainerMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  optionButton: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    minWidth: 150,
    flex: 1,
    maxWidth: 180,
  },
  optionContent: {
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focusedOption: {
    elevation: 5,
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedText: {
    fontWeight: 'bold',
  },
  saveButton: {
    paddingVertical: 14,
    paddingHorizontal: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focusedSaveButton: {
    borderColor: 'transparent',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  }
});
