import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/app-store';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AutoBootScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 700;
  
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const [selected, setSelected] = useState(settings.autoBoot || false);

  const OPTIONS = [
    {
      id: true,
      title: 'Yes, Auto Boot',
    },
    {
      id: false,
      title: 'No, Dont Auto Boot',
    }
  ];

  const handleSave = () => {
    updateSettings({ autoBoot: selected });
    
    // Logic for Electron (Windows)
    if (Platform.OS === 'web') {
      fetch(`/set_auto_boot?enabled=${selected}`).catch(err => {
        console.error('Failed to set auto boot on desktop:', err);
      });
    }

    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <Text style={styles.headerTitle}>{t('auto_boot_title')}</Text>

      <View style={[styles.optionsContainer, !isLargeScreen && styles.optionsContainerMobile]}>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <TVFocusable
              key={opt.id ? 'yes' : 'no'}
              style={({ focused }: any) => [
                styles.optionButton,
                focused && styles.focusedOption
              ]}
              onPress={() => setSelected(opt.id)}
            >
              <View style={[
                styles.radio,
                { borderColor: '#FFF' },
                isSelected && { backgroundColor: '#FFF' }
              ]}>
                {isSelected && <Ionicons name="checkmark" size={16} color="#000" />}
              </View>
              <Text style={[styles.optionText, isSelected && styles.selectedText]}>
                {opt.title}
              </Text>
            </TVFocusable>
          );
        })}
      </View>

      <TVFocusable
        style={({ focused }: any) => [
          styles.saveButton,
          focused && styles.focusedSaveButton
        ]}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>{t('save')}</Text>
      </TVFocusable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 60,
  },
  optionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
    marginBottom: 60,
  },
  optionsContainerMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  focusedOption: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '500',
  },
  selectedText: {
    color: '#FFF',
  },
  saveButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    minWidth: 150,
  },
  focusedSaveButton: {
    backgroundColor: '#FFF',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
