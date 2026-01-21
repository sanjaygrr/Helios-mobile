import axios from 'axios';

const API_URL = 'https://backend-production-0413.up.railway.app/api';

import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

api.interceptors.request.use(
    async (config) => {
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

export const login = async (email, password) => {
    // Mock login for now or implement JWT
    return api.post('/token/', { email, password });
};

export const updatePosition = async (unitId, lat, lon) => {
    return api.post('/tracking/', {
        unit: unitId,
        location: {
            type: "Point",
            coordinates: [lon, lat]
        }
    });
};

export default api;
