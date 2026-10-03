import { I18nManager } from 'react-native';

// Prevent React Native from automatically applying RTL layout when Android system language is Arabic
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch (e) {
  console.warn('Failed to configure I18nManager in index.js:', e);
}

import 'expo-router/entry';
