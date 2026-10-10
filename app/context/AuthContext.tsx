import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin } from '../services/api';

interface User {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'COMPANY_CHIEF' | 'FIREFIGHTER';
    fire_department: number | null;
    company: number | null;
}

interface AuthContextData {
    user: User | null;
    role: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (next: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStorageData();
    }, []);

    async function loadStorageData() {
        try {
            const storedUser = await AsyncStorage.getItem('@Auth:user');
            const storedToken = await AsyncStorage.getItem('@Auth:token');

            if (storedUser && storedToken) {
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error('Failed to load auth data', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function login(email: string, password: string) {
        try {
            const response = await apiLogin(email, password);

            // Assuming API returns { token: '...', user: { ... } }
            // If API format is different, we adjust here.
            // Based on typical JWT Auth:
            // The API response is wrapped in an axios object, so we need response.data
            const { access, refresh, user } = response.data;

            // If backend only returns access token, we might need to decode it or fetch me endpoint.
            // For now, let's assume login returns user info or we modify backend to return it.
            // Actually standard SimpleJWT return only tokens.
            // We might need to fetch user profile after login.
            // Let's check api.ts to see what login does.

            // If apiLogin maps to Custom obtain_pair_view with user data, great.
            // If not, we fix it or fetch me.

            // Store data FIRST before updating state to prevent race conditions with child components
            await AsyncStorage.setItem('@Auth:token', access);
            await AsyncStorage.setItem('@Auth:refresh', refresh);
            await AsyncStorage.setItem('@Auth:user', JSON.stringify(user));

            // Now update state, triggering re-renders
            setUser(user);

        } catch (error) {
            throw error;
        }
    }

    async function logout() {
        setUser(null);
        await AsyncStorage.removeItem('@Auth:token');
        await AsyncStorage.removeItem('@Auth:refresh');
        await AsyncStorage.removeItem('@Auth:user');
    }

    async function updateUser(next: User) {
        setUser(next);
        await AsyncStorage.setItem('@Auth:user', JSON.stringify(next));
    }

    return (
        <AuthContext.Provider value={{ user, role: user?.role || null, login, logout, updateUser, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
