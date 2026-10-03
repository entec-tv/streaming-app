import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useAppStore } from '@/store/app-store';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function LanguageSelectorScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  
  const currentLanguage = useAppStore(s => s.settings.language);
  const setLanguage = useAppStore(s => s.setLanguage);
  
  const [selectedLang, setSelectedLang] = useState(currentLanguage);

  const languages = [
    { id: 'en', name: t('english'), icon: '🇬🇧' },
    { id: 'ar', name: t('arabic'), icon: '🇸🇦' },
  ];

  const handleSave = () => {
    setLanguage(selectedLang as 'en' | 'ar');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  };

  const isSmallScreen = width < 600;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('choose_language')}</Text>

      <View style={[styles.optionsContainer, isSmallScreen && styles.optionsContainerMobile]}>
        {languages.map((lang) => (
          <TVFocusable
            key={lang.id}
            style={({ focused }: any) => [
              styles.optionButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              focused && [styles.focusedOption, { borderColor: colors.gold, backgroundColor: colors.surface2 }],
              selectedLang === lang.id && { borderColor: colors.gold }
            ]}
            onPress={() => setSelectedLang(lang.id as 'en' | 'ar')}
          >
            {({ focused }: any) => (
              <>
                <Text style={styles.langIcon}>{lang.icon}</Text>
                <View style={styles.textContainer}>
                  <Ionicons 
                    name={selectedLang === lang.id ? "checkmark-circle" : "ellipse-outline"} 
                    size={28} 
                    color={selectedLang === lang.id ? colors.gold : colors.muted} 
                  />
                  <Text style={[
                    styles.optionText, 
                    { color: colors.mutedForeground },
                    selectedLang === lang.id && [styles.selectedText, { color: colors.text }]
                  ]}>
                    {lang.name}
                  </Text>
                </View>
              </>
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
            {t('save')}
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 60,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 80,
  },
  optionsContainerMobile: {
    flexDirection: 'column',
    gap: 20,
  },
  optionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    width: 200,
  },
  focusedOption: {
    elevation: 8,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  langIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  }
});
