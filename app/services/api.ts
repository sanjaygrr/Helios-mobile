import axios from 'axios';

const API_URL = 'http://172.20.10.4:8000/api'; // Replace with actual machine IP in device

const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

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
