import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_KEY = '@Helios:deviceId';
let cachedId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedId) return cachedId;
  const stored = await AsyncStorage.getItem(DEVICE_KEY);
  if (stored) {
    cachedId = stored;
    return stored;
  }
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_KEY, created);
  cachedId = created;
  return created;
}
