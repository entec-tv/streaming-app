import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/app-store';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ContentStrategyScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  
  // Read current value from store
  const lazyLoadContent = useAppStore(s => s.lazyLoadContent);
  const setLazyLoadContent = useAppStore(s => s.setLazyLoadContent);
  
  // Local state for the selected option before saving
  const [selectedStrategy, setSelectedStrategy] = useState<'runtime' | 'all'>(
    lazyLoadContent ? 'runtime' : 'all'
  );

  const handleSave = () => {
    setLazyLoadContent(selectedStrategy === 'runtime');
    router.back();
  };

  const isSmallScreen = width < 600;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('content_strategy_title')}</Text>

      <View style={[styles.optionsContainer, isSmallScreen && styles.optionsContainerMobile]}>
        {/* Runtime Strategy */}
        <TVFocusable
          style={({ focused }: any) => [
            styles.optionButton,
            focused && styles.focusedOption
          ]}
          onPress={() => setSelectedStrategy('runtime')}
        >
          {({ focused }: any) => (
            <>
              <Ionicons 
                name={selectedStrategy === 'runtime' ? "checkmark-circle" : "ellipse-outline"} 
                size={28} 
                color={selectedStrategy === 'runtime' ? "#FFF" : "#888"} 
              />
              <Text style={[styles.optionText, selectedStrategy === 'runtime' && styles.selectedText]}>
                Load Data On Runtime
              </Text>
            </>
          )}
        </TVFocusable>

        {/* All at Once Strategy */}
        <TVFocusable
          style={({ focused }: any) => [
            styles.optionButton,
            focused && styles.focusedOption
          ]}
          onPress={() => setSelectedStrategy('all')}
        >
          {({ focused }: any) => (
            <>
              <Ionicons 
                name={selectedStrategy === 'all' ? "checkmark-circle" : "ellipse-outline"} 
                size={28} 
                color={selectedStrategy === 'all' ? "#FFF" : "#888"} 
              />
              <Text style={[styles.optionText, selectedStrategy === 'all' && styles.selectedText]}>
                Load All Data At One Time
              </Text>
            </>
          )}
        </TVFocusable>
      </View>

      <TVFocusable
        style={({ focused }: any) => [
          styles.saveButton,
          focused && styles.focusedSaveButton
        ]}
        onPress={handleSave}
      >
        {({ focused }: any) => (
          <Text style={[styles.saveButtonText, focused && { color: '#000' }]}>{t('save')}</Text>
        )}
      </TVFocusable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focusedOption: {
    borderColor: '#333',
    backgroundColor: '#111',
  },
  optionText: {
    color: '#888',
    fontSize: 18,
    marginLeft: 12,
    fontWeight: '500',
  },
  selectedText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#333',
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focusedSaveButton: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  }
});
