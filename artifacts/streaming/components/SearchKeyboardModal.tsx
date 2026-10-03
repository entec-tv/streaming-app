import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet, TextInput, useWindowDimensions, Platform } from 'react-native';
import { TVKeyboard } from './TVKeyboard';
import QRCode from 'react-native-qrcode-svg';
import { listenToRemoteKeyboard } from '@/store/firebase';
import { useColors } from '@/hooks/useColors';
import { TVFocusable } from './TVFocusable';
import { useTranslation } from '@/hooks/useTranslation';

interface SearchKeyboardModalProps {
  visible: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  placeholder?: string;
  inline?: boolean;
}

export function SearchKeyboardModal({ visible, value, onChangeText, onClose, placeholder, inline = false }: SearchKeyboardModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const remoteSessionId = useRef(Math.random().toString(36).substring(2, 6).toUpperCase()).current;
  const [internalValue, setInternalValue] = useState(value);
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768 && !Platform.isTV;
  const isWindowsWeb = Platform.OS === 'web';

  // Sync internal value when prop changes (if it changes from outside)
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    if (!visible || isWindowsWeb) return;
    
    return listenToRemoteKeyboard(remoteSessionId, (text) => {
      setInternalValue(text);
      onChangeText(text);
    });
  }, [visible, remoteSessionId, onChangeText, isWindowsWeb]);

  const handleChangeText = (t: string) => {
    setInternalValue(t);
    onChangeText(t);
  };

  if (!visible) return null;

  const content = (
    <View style={[inline ? styles.inlineContainer : styles.overlay, !inline && { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
      <View style={[styles.contentRow, inline && { flexDirection: 'column', gap: 16 }, !inline && !isSmallScreen && { transform: [{ scale: 0.75 }] }]}>
        
        {/* Keyboard Section */}
        <View style={{ width: inline || isSmallScreen || isWindowsWeb ? '100%' : 480, maxWidth: isSmallScreen || isWindowsWeb ? 600 : 480, paddingHorizontal: inline || isSmallScreen || isWindowsWeb ? 16 : 0, alignSelf: 'center', gap: 12 }}>
          <TextInput
            value={internalValue}
            onChangeText={handleChangeText}
            placeholder={placeholder || 'search'}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.placeholder, { color: colors.text, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.border }]}
            autoFocus={true}
            showSoftInputOnFocus={isSmallScreen || isWindowsWeb}
            onSubmitEditing={onClose}
            returnKeyType="search"
          />
          {isWindowsWeb && (
            <TVFocusable 
              onPress={onClose}
              style={({ focused }: any) => [
                styles.closeBtn,
                { backgroundColor: focused ? colors.gold : colors.surface, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }
              ]}
            >
              {({ focused }: any) => (
                <Text style={[styles.closeBtnText, { color: focused ? '#000' : colors.text }]}>{t('close') || 'Close'}</Text>
              )}
            </TVFocusable>
          )}
          {!isSmallScreen && !isWindowsWeb && (
            <TVKeyboard 
              value={internalValue}
              onChangeText={handleChangeText}
              onSubmit={onClose}
              autoFocus={true}
              suggestions={[]}
            />
          )}
        </View>
        
        {/* QR Code Section - Hidden on small screens and Windows */}
        {!isSmallScreen && !isWindowsWeb && (
          <View style={[styles.qrContainer, inline && { flexDirection: 'row', padding: 16, width: '100%', maxWidth: 480, justifyContent: 'space-between', alignItems: 'center' }, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14 }]}>
            {inline ? (
              <>
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Text style={[styles.qrTitle, { color: colors.text, marginBottom: 4 }]}>{t('remote_search')}</Text>
                  <Text style={[styles.qrSessionId, { color: colors.gold, marginBottom: 12, fontSize: 20 }]}>{remoteSessionId}</Text>
                  
                  <TVFocusable 
                    onPress={onClose}
                    style={({ focused }: any) => [
                      styles.closeBtn,
                      { backgroundColor: focused ? colors.gold : colors.card, paddingVertical: 8, paddingHorizontal: 24, borderWidth: 1, borderColor: colors.border }
                    ]}
                  >
                    {({ focused }: any) => (
                      <Text style={[styles.closeBtnText, { color: focused ? '#000' : colors.text }]}>Close</Text>
                    )}
                  </TVFocusable>
                </View>
                <View style={[styles.qrCodeWrapper, { marginBottom: 0, padding: 8 }]}>
                  <QRCode 
                    value={`https://entec-keyboard.web.app/?session=${remoteSessionId}`} 
                    size={90} 
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.qrTitle, { color: colors.text }]}>{t('remote_search')}</Text>
                <View style={styles.qrCodeWrapper}>
                  <QRCode 
                    value={`https://entec-keyboard.web.app/?session=${remoteSessionId}`} 
                    size={140} 
                  />
                </View>
                <Text style={[styles.qrSessionId, { color: colors.gold }]}>{remoteSessionId}</Text>
                
                <TVFocusable 
                  onPress={onClose}
                  style={({ focused }: any) => [
                    styles.closeBtn,
                    { backgroundColor: focused ? colors.gold : colors.card, borderWidth: 1, borderColor: colors.border }
                  ]}
                >
                  {({ focused }: any) => (
                    <Text style={[styles.closeBtnText, { color: focused ? '#000' : colors.text }]}>Close</Text>
                  )}
                </TVFocusable>
              </>
            )}
          </View>
        )}

      </View>

      {/* Close button for small screens */}
      {isSmallScreen && !inline && (
        <TVFocusable 
          onPress={onClose}
          style={({ focused }: any) => [
            styles.closeBtn,
            { backgroundColor: focused ? colors.gold : colors.card, borderWidth: 1, borderColor: colors.border, marginTop: 24 }
          ]}
        >
          {({ focused }: any) => (
            <Text style={[styles.closeBtnText, { color: focused ? '#000' : colors.text }]}>Close</Text>
          )}
        </TVFocusable>
      )}
    </View>
  );

  if (inline) {
    return content;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    width: '100%',
  },
  placeholder: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  qrCodeWrapper: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  qrSessionId: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 24,
  },
  closeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  closeBtnText: {
    fontWeight: 'bold',
  }
});
