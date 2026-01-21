import React, { useEffect } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Alert } from 'react-native';

const TRACKING_INTERVAL = 60000; // 60 seconds

export default function TrackingService() {
    const { user, role } = useAuth();

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const startTracking = async () => {
            if (role === 'COMPANY_CHIEF') {
                // Request permissions first
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    console.log('Location permission not granted for tracking');
                    return;
                }

                // Send initial location
                sendLocation();

                // Start interval
                intervalId = setInterval(sendLocation, TRACKING_INTERVAL);
            }
        };

        const sendLocation = async () => {
            try {
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                await api.post('/tracking/history/', {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    // incident: null // Optional: if we want to link to active incident
                });
                console.log('Location sent for tracking');
            } catch (error) {
                console.error('Error sending location:', error);
            }
        };

        if (user) {
            startTracking();
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [user, role]);

    return null; // This component handles logic only
}
