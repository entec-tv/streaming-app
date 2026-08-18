import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/app-store';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AutoPlayScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  const autoPlayOnStartup = useAppStore(s => s.autoPlayOnStartup);
  const setAutoPlayOnStartup = useAppStore(s => s.setAutoPlayOnStartup);
  const [selectedStrategy, setSelectedStrategy] = useState(autoPlayOnStartup);

  const STRATEGIES = [
    {
      id: false,
      title: 'Do not Auto-play',
      description: 'Start the app normally and go to the Home screen.',
      icon: 'home-outline'
    },
    {
      id: true,
      title: 'Auto-play Last Watched',
      description: 'Automatically start playing the last watched TV channel or stream when you open the app.',
      icon: 'play-circle-outline'
    }
  ];

  const handleSelect = (id: boolean) => {
    setSelectedStrategy(id);
    setAutoPlayOnStartup(id);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TVFocusable 
          style={({ focused }: any) => [
            styles.backButton,
            focused && { backgroundColor: colors.card, borderColor: colors.gold }
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TVFocusable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('auto_play_title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cardsContainer}>
          {STRATEGIES.map((strategy) => {
            const isSelected = selectedStrategy === strategy.id;
            
            return (
              <TVFocusable
                key={strategy.id ? 'yes' : 'no'}
                style={({ focused }: any) => [
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && { borderColor: colors.gold, backgroundColor: colors.card },
                  focused && { 
                    transform: [{ scale: 1.02 }],
                    elevation: 8,
                    shadowColor: colors.gold,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8
                  }
                ]}
                onPress={() => handleSelect(strategy.id)}
              >
                <View style={[styles.iconContainer, { backgroundColor: isSelected ? colors.gold + '20' : colors.card }]}>
                  <Ionicons 
                    name={strategy.icon as any} 
                    size={28} 
                    color={isSelected ? colors.gold : colors.text} 
                  />
                </View>

                <View style={styles.textContainer}>
                  <Text style={[styles.title, { color: isSelected ? colors.gold : colors.text }]}>
                    {strategy.title}
                  </Text>
                  
                  <Text style={[styles.description, { color: colors.text + '90' }]}>
                    {strategy.description}
                  </Text>
                </View>

                <View style={[
                  styles.radio, 
                  { borderColor: isSelected ? colors.gold : colors.border },
                  isSelected && { backgroundColor: colors.gold }
                ]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#000" />}
                </View>
              </TVFocusable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  cardsContainer: {
    width: '100%',
    maxWidth: 800,
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

