import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Platform, Dimensions } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';

interface PinModalProps {
  visible: boolean;
  title?: string;
  onSuccess: () => void;
  onCancel: () => void;
  expectedPin: string | null;
  mode?: 'verify' | 'create';
  onPinCreated?: (pin: string) => void;
}

export const PinModal: React.FC<PinModalProps> = ({ 
  visible, 
  title, 
  onSuccess, 
  onCancel, 
  expectedPin,
  mode = 'verify',
  onPinCreated
}) => {
  const colors = useColors();
  const { t, isRTL } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [step, setStep] = useState(1);
  const [firstPin, setFirstPin] = useState('');

  useEffect(() => {
    if (visible) {
      setPin('');
      setError(false);
      setStep(1);
      setFirstPin('');
    }
  }, [visible]);

  const lastPress = useRef(0);

  const handleKeyPress = (num: string) => {
    const now = Date.now();
    if (now - lastPress.current < 200) return; // Ignore if pressed within 200ms
    lastPress.current = now;

    setError(false);
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        // Evaluate PIN
        setTimeout(() => {
          if (mode === 'verify') {
            if (newPin === expectedPin || expectedPin === null) {
              onSuccess();
            } else {
              setError(true);
              setPin('');
            }
          } else if (mode === 'create') {
            if (step === 1) {
              setFirstPin(newPin);
              setPin('');
              setStep(2);
            } else {
              if (newPin === firstPin) {
                if (onPinCreated) onPinCreated(newPin);
                onSuccess();
              } else {
                setError(true);
                setPin('');
                setFirstPin('');
                setStep(1);
              }
            }
          }
        }, 300);
      }
    }
  };

  const handleClear = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
    setError(false);
  };

  const renderDot = (index: number) => {
    const isFilled = pin.length > index;
    return (
      <View 
        key={`dot-${index}`}
        style={[
          styles.dot, 
          { 
            borderColor: error ? '#ef4444' : colors.text,
            backgroundColor: isFilled ? (error ? '#ef4444' : colors.text) : 'transparent'
          }
        ]} 
      />
    );
  };

  if (!visible) return null;

  const numPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['Cancel', '0', 'Delete']
  ];

  let displayTitle = title || t('parental_pin_required');
  if (mode === 'create') {
    displayTitle = step === 1 ? t('enter_new_pin') || 'Enter new PIN' : t('confirm_new_pin') || 'Confirm new PIN';
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{displayTitle}</Text>
          
          <View style={styles.dotsContainer}>
            {[0, 1, 2, 3].map(renderDot)}
          </View>
          
          {error && (
            <Text style={styles.errorText}>
              {mode === 'verify' ? (t('incorrect_pin') || 'Incorrect PIN') : (t('pins_do_not_match') || 'PINs do not match')}
            </Text>
          )}

          <View style={[styles.numpad, { direction: isRTL ? 'ltr' : 'inherit' }]}>
            {numPad.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={[styles.numpadRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {row.map((btn) => {
                  if (btn === 'Cancel') {
                    return (
                      <TVFocusable
                        key="cancel"
                        style={({ focused }: any) => [
                          styles.numpadBtn,
                          focused && { backgroundColor: colors.gold, transform: [{ scale: 1.05 }] }
                        ]}
                        onPress={onCancel}
                      >
                        <Text style={[styles.btnText, { color: colors.primary }]}>{t('cancel') || 'Cancel'}</Text>
                      </TVFocusable>
                    );
                  }
                  if (btn === 'Delete') {
                    return (
                      <TVFocusable
                        key="delete"
                        style={({ focused }: any) => [
                          styles.numpadBtn,
                          focused && { backgroundColor: colors.gold, transform: [{ scale: 1.05 }] }
                        ]}
                        onPress={handleClear}
                      >
                        <Ionicons name="backspace-outline" size={24} color={colors.text} />
                      </TVFocusable>
                    );
                  }
                  
                  return (
                    <TVFocusable
                      key={btn}
                      style={({ focused }: any) => [
                        styles.numpadBtn,
                        focused && { backgroundColor: colors.gold, transform: [{ scale: 1.05 }] }
                      ]}
                      onPress={() => handleKeyPress(btn)}
                    >
                      <Text style={[styles.btnText, { color: colors.text }]}>{btn}</Text>
                    </TVFocusable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: Math.min(Dimensions.get('window').width * 0.9, 400),
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
    minHeight: 30,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
    minHeight: 20,
  },
  numpad: {
    marginTop: 24,
    width: '100%',
    gap: 12,
  },
  numpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  numpadBtn: {
    flex: 1,
    aspectRatio: 1.5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 24,
    fontWeight: '600',
  }
});
