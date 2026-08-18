import AsyncStorageOriginal from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { readCacheString, writeCacheString } from '../lib/storage';

const AsyncStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return await readCacheString(key);
    return await AsyncStorageOriginal.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') return await writeCacheString(key, value);
    return await AsyncStorageOriginal.setItem(key, value);
  }
};

const MAC_KEY = 'ENTEC_DEVICE_MAC';
const DEVICE_KEY_KEY = 'ENTEC_DEVICE_KEY';

function generateRandomHex(length: number) {
  let result = '';
  const characters = '0123456789ABCDEF';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function generateMacAddress() {
  const hex = generateRandomHex(12);
  const pairs = hex.match(/.{1,2}/g);
  return pairs ? pairs.join(':') : '00:11:22:33:44:55';
}

function generateDeviceKey() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

export async function getOrCreateDeviceData() {
  try {
    let mac = await AsyncStorage.getItem(MAC_KEY);
    let key = await AsyncStorage.getItem(DEVICE_KEY_KEY);

    if (!mac || !key) {
      mac = generateMacAddress();
      key = generateDeviceKey();
      await AsyncStorage.setItem(MAC_KEY, mac);
      await AsyncStorage.setItem(DEVICE_KEY_KEY, key);
    }

    return { macAddress: mac, deviceKey: key };
  } catch (error) {
    console.error('Error getting device data', error);
    return { macAddress: '00:00:00:00:00:00', deviceKey: '123456' };
  }
}
