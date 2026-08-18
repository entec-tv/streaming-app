import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Platform, useWindowDimensions } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useAppStore } from '@/store/app-store';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TranslationKey } from '@/constants/translations';

type OptionKey = 'streamUrlRedirectionCheck' | 'liveTvEpg' | 'useExtensionInStreamUrl' | 'useM3uFormatInStreamUrl' | 'useRuntimeFunctionInMovies' | 'useRuntimeFunctionInSeries' | 'useUtf8Decode';

const OPTIONS_CONFIG: Array<{
  key: OptionKey;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ComponentProps<typeof import('@expo/vector-icons').Ionicons>['name'];
  color: string;
}> = [
  {
    key: 'streamUrlRedirectionCheck',
    titleKey: 'stream_url_check',
    descKey: 'stream_url_check_desc',
    icon: 'git-branch-outline',
    color: '#80DEEA',
  },
  {
    key: 'liveTvEpg',
    titleKey: 'live_tv_epg',
    descKey: 'live_tv_epg_desc',
    icon: 'tv-outline',
    color: '#CE93D8',
  },
  {
    key: 'useExtensionInStreamUrl',
    titleKey: 'use_extension',
    descKey: 'use_extension_desc',
    icon: 'link-outline',
    color: '#A5D6A7',
  },
  {
    key: 'useM3uFormatInStreamUrl',
    titleKey: 'use_m3u',
    descKey: 'use_m3u_desc',
    icon: 'radio-outline',
    color: '#FFCC80',
  },
  {
    key: 'useRuntimeFunctionInMovies',
    titleKey: 'use_runtime_movies',
    descKey: 'use_runtime_movies_desc',
    icon: 'film-outline',
    color: '#EF9A9A',
  },
  {
    key: 'useRuntimeFunctionInSeries',
    titleKey: 'use_runtime_series',
    descKey: 'use_runtime_series_desc',
    icon: 'library-outline',
    color: '#F48FB1',
  },
  {
    key: 'useUtf8Decode',
    titleKey: 'use_utf8',
    descKey: 'use_utf8_desc',
    icon: 'text-outline',
    color: '#80CBC4',
  },
];


export default function MoreOptionsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const moreOptions = useAppStore((s) => s.moreOptions);
  const updateMoreOptions = useAppStore((s) => s.updateMoreOptions);
  const isSmallScreen = width < 600 && !Platform.isTV;

  const handleToggle = (key: OptionKey) => {
    updateMoreOptions({ [key]: !moreOptions[key] });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TVFocusable
          style={() => styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TVFocusable>
        <Ionicons name="list-outline" size={28} color={colors.gold} style={{ marginLeft: 8 }} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('more_options')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
      >
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t('more_options_desc')}
        </Text>

        {OPTIONS_CONFIG.map((opt, idx) => {
          const isOn = moreOptions[opt.key];
          return (
            <TVFocusable
              key={opt.key}
              style={({ focused }: any) => [
                styles.row,
                {
                  backgroundColor: focused ? colors.card : colors.surface,
                  borderColor: focused ? colors.gold : colors.border,
                  marginBottom: idx === OPTIONS_CONFIG.length - 1 ? 0 : 12,
                },
              ]}
              onPress={() => handleToggle(opt.key)}
            >
              {({ focused }: any) => (
                <View style={styles.rowInner}>
                  {/* Icon bubble */}
                  <View style={[styles.iconBubble, { backgroundColor: opt.color + '22' }]}>
                    <Ionicons name={opt.icon} size={22} color={opt.color} />
                  </View>

                  {/* Text */}
                  <View style={styles.textBlock}>
                    <Text style={[styles.optTitle, { color: colors.text }]}>
                      {t(opt.titleKey)}
                    </Text>
                    <Text style={[styles.optDesc, { color: colors.mutedForeground }]}>
                      {t(opt.descKey)}
                    </Text>
                  </View>

                  {/* Toggle */}
                  {Platform.isTV ? (
                    <View
                      style={[
                        styles.tvToggle,
                        { backgroundColor: isOn ? colors.gold : colors.border },
                      ]}
                    >
                      <View
                        style={[
                          styles.tvThumb,
                          {
                            backgroundColor: '#fff',
                            transform: [{ translateX: isOn ? 20 : 2 }],
                          },
                        ]}
                      />
                    </View>
                  ) : (
                    <Switch
                      value={isOn}
                      onValueChange={() => handleToggle(opt.key)}
                      thumbColor={isOn ? colors.gold : '#ccc'}
                      trackColor={{ false: colors.border, true: colors.gold + '66' }}
                    />
                  )}
                </View>
              )}
            </TVFocusable>
          );
        })}
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 13,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  optTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  optDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  tvToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    flexShrink: 0,
  },
  tvThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
