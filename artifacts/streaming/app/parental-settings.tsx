import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, ScrollView } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { PinModal } from '@/components/PinModal';

export default function ParentalSettingsScreen() {
  const colors = useColors();
  const { t, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const isLargeScreen = width >= 1024 || Platform.isTV;
  
  const parentalPin = useAppStore(s => s.parentalPin);
  const setParentalPin = useAppStore(s => s.setParentalPin);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'verify' | 'create'>('verify');
  const [pendingAction, setPendingAction] = useState<'disable' | 'change' | null>(null);

  const isEnabled = parentalPin !== null;

  const handleToggle = () => {
    if (isEnabled) {
      setPendingAction('disable');
      setModalMode('verify');
      setModalVisible(true);
    } else {
      setModalMode('create');
      setModalVisible(true);
    }
  };

  const handleChangePin = () => {
    setPendingAction('change');
    setModalMode('verify');
    setModalVisible(true);
  };

  const handlePinSuccess = () => {
    if (modalMode === 'verify') {
      if (pendingAction === 'disable') {
        setParentalPin(null);
        setModalVisible(false);
        setPendingAction(null);
      } else if (pendingAction === 'change') {
        setModalMode('create');
        setPendingAction(null);
      }
    } else if (modalMode === 'create') {
      // The pin is set in onPinCreated, so just close
      setModalVisible(false);
    }
  };

  const handlePinCreated = (pin: string) => {
    setParentalPin(pin);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TVFocusable 
          style={({ focused }: any) => [
            styles.backBtn,
            focused && { backgroundColor: 'rgba(255,255,255,0.2)' }
          ]} 
          onPress={() => router.back()}
        >
          <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={28} color={colors.text} />
        </TVFocusable>
        <Text style={[styles.title, { color: colors.text }]}>{t('parental_control') || 'Parental Control'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.content,
          isLargeScreen && { maxWidth: 800, alignSelf: 'center', width: '100%' }
        ]}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.textContainer, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
              <Text style={[styles.cardTitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}>{t('enable_parental_control') || 'Enable Parental Control'}</Text>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('parental_desc') || 'Require a PIN code to access adult channels and content.'}
              </Text>
            </View>
            <TVFocusable 
              style={({ focused }: any) => [
                styles.toggleBtn, 
                { backgroundColor: isEnabled ? colors.gold : 'rgba(255,255,255,0.1)' },
                focused && { transform: [{ scale: 1.05 }], borderWidth: 2, borderColor: colors.text }
              ]} 
              onPress={handleToggle}
            >
              <Text style={[styles.toggleText, { color: isEnabled ? '#000' : colors.text }]}>
                {isEnabled ? (t('enabled') || 'Enabled') : (t('disabled') || 'Disabled')}
              </Text>
            </TVFocusable>
          </View>
        </View>

        {isEnabled && (
          <TVFocusable 
            style={({ focused }: any) => [
              styles.card, 
              { backgroundColor: colors.surface, borderColor: colors.border },
              focused && { borderColor: colors.gold, backgroundColor: colors.card, transform: [{ scale: 1.02 }] }
            ]}
            onPress={handleChangePin}
            scaleAmount={1.02}
          >
            <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.textContainer, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('change_pin') || 'Change PIN Code'}</Text>
              </View>
              <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={24} color={colors.mutedForeground} />
            </View>
          </TVFocusable>
        )}
      </ScrollView>

      <PinModal
        visible={modalVisible}
        mode={modalMode}
        expectedPin={parentalPin}
        onSuccess={handlePinSuccess}
        onCancel={() => {
          setModalVisible(false);
          setPendingAction(null);
        }}
        onPinCreated={handlePinCreated}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  content: {
    padding: 24,
    gap: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  textContainer: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toggleText: {
    fontWeight: 'bold',
    fontSize: 14,
  }
});
