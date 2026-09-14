import axios from 'axios';

// Base URL: env override -> persisted override -> production default
const PROD_URL = 'https://backend-production-0413.up.railway.app/api';
const ENV_URL = (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL) || undefined;

import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
    baseURL: ENV_URL || PROD_URL,
    timeout: 10000,
});

api.interceptors.request.use(
    async (config) => {
        // Dynamic baseURL from storage
        const storedBase = await AsyncStorage.getItem('@Api:baseURL');
        if (storedBase) {
            config.baseURL = storedBase;
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
        const storedBase = await AsyncStorage.getItem('@Api:baseURL');
        const response = await axios.post(`${storedBase || ENV_URL || PROD_URL}/token/refresh/`, { refresh });
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

export async function setApiBaseURL(url: string) {
    await AsyncStorage.setItem('@Api:baseURL', url);
}
