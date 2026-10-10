import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_KEY = '@Lumbre:deviceId';
const LEGACY_DEVICE_KEY = '@Helios:deviceId';
let cachedId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedId) return cachedId;
  const stored = await AsyncStorage.getItem(DEVICE_KEY) || await AsyncStorage.getItem(LEGACY_DEVICE_KEY);
  if (stored) {
    cachedId = stored;
    await AsyncStorage.setItem(DEVICE_KEY, stored);
    return stored;
  }
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_KEY, created);
  cachedId = created;
  return created;
}
