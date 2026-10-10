import axios from 'axios';

// La app publicada siempre usa producción. La URL guardada queda disponible
// sólo en desarrollo para que una prueba local no pueda dejar la app real
// apuntando a un backend viejo o sin /api.
const PROD_URL = 'https://backend-production-0413.up.railway.app/api';
const ENV_URL = (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL) || undefined;
const DEFAULT_URL = (ENV_URL || PROD_URL).replace(/\/$/, '');

import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
    baseURL: DEFAULT_URL,
    timeout: 10000,
});

api.interceptors.request.use(
    async (config) => {
        if (__DEV__) {
            const storedBase = await AsyncStorage.getItem('@Api:baseURL');
            if (storedBase) {
                config.baseURL = storedBase.replace(/\/$/, '');
            }
        }
        const token = await AsyncStorage.getItem('@Auth:token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(response => response, async error => {
    const original = error.config;
    if (error.response?.status !== 401 || !original || original._retried || original.url?.includes('/token/')) {
        return Promise.reject(error);
    }
    original._retried = true;
    const refresh = await AsyncStorage.getItem('@Auth:refresh');
    if (!refresh) return Promise.reject(error);
    try {
        const storedBase = __DEV__ ? await AsyncStorage.getItem('@Api:baseURL') : null;
        const refreshBase = (storedBase || DEFAULT_URL).replace(/\/$/, '');
        const response = await axios.post(`${refreshBase}/token/refresh/`, { refresh });
        const access = response.data.access;
        await AsyncStorage.setItem('@Auth:token', access);
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
    } catch {
        return Promise.reject(error);
    }
});

export const login = async (email: string, password: string) => {
    return api.post('/token/', { email, password });
};

export const updatePosition = async (unitId: number, lat: number, lon: number) => {
    return api.post('/tracking/', {
        unit: unitId,
        latitude: lat,
        longitude: lon
    });
};

export default api;

export function asList(data: unknown): any[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
        return (data as { results: any[] }).results;
    }
    return [];
}

export async function setApiBaseURL(url: string) {
    await AsyncStorage.setItem('@Api:baseURL', url);
}
