import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@Helios:locationSharing';
let enabled: boolean | null = null;

export async function isLocationSharingEnabled(): Promise<boolean> {
  if (enabled === null) enabled = (await AsyncStorage.getItem(KEY)) !== 'false';
  return enabled;
}

export async function setLocationSharingEnabled(value: boolean) {
  enabled = value;
  await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
}
