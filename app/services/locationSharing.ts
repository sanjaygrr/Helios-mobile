import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@Lumbre:locationSharing';
const LEGACY_KEY = '@Helios:locationSharing';
let enabled: boolean | null = null;

export async function isLocationSharingEnabled(): Promise<boolean> {
  if (enabled === null) {
    const stored = await AsyncStorage.getItem(KEY) || await AsyncStorage.getItem(LEGACY_KEY);
    enabled = stored !== 'false';
  }
  return enabled;
}

export async function setLocationSharingEnabled(value: boolean) {
  enabled = value;
  await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
}
