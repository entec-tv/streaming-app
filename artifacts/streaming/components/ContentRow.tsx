import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { TVFocusable } from '@/components/TVFocusable';
import { useTranslation } from '@/hooks/useTranslation';

interface ContentRowProps {
  title: string;
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactElement;
  onSeeAll?: () => void;
}

const Separator = () => <View style={{ width: 12 }} />;

export const ContentRow = React.memo(function ContentRow({ title, data, renderItem, onSeeAll }: ContentRowProps) {
  const colors = useColors();
  const { t, isRTL } = useTranslation();

  if (!data || data.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, flex: 1, marginRight: isRTL ? 0 : 16, marginLeft: isRTL ? 16 : 0, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{title}</Text>
        {onSeeAll && (
          <TVFocusable 
            onPress={onSeeAll}
            style={({ focused }: any) => [
              { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
              focused && { backgroundColor: 'rgba(212,168,67,0.2)' }
            ]}
            disableBorder
            scaleAmount={1.05}
          >
            {({ focused }: any) => (
              <Text style={[styles.seeAll, { color: focused ? colors.gold : colors.mutedForeground }]}>{t('see_all')} {isRTL ? '←' : '→'}</Text>
            )}
          </TVFocusable>
        )}
      </View>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={3}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAll: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
  }
});