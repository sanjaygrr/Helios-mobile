import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { login as apiLogin, setUnauthorizedHandler } from '../services/api';
import { esVista, puedePrevisualizar, rolDeVista, type Vista } from '../utils/vistas';

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
    vista: Vista | null;
    puedeCambiarVista: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (next: User) => Promise<void>;
    setVista: (next: Vista | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [vista, setVistaState] = useState<Vista | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setUnauthorizedHandler(() => {
            setUser(null);
            setVistaState(null);
        });
        return () => setUnauthorizedHandler(null);
    }, []);

    useEffect(() => {
        loadStorageData();
    }, []);

    async function loadStorageData() {
        try {
            const storedUser = await AsyncStorage.getItem('@Auth:user');
            const storedToken = await AsyncStorage.getItem('@Auth:token');

            if (storedUser && storedToken) {
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
                const guardada = await AsyncStorage.getItem('@Auth:vista');
                if (puedePrevisualizar(parsed) && esVista(guardada)) {
                    setVistaState(guardada);
                }
                try {
                    const { data } = await api.get('/users/me/');
                    setUser(data);
                    await AsyncStorage.setItem('@Auth:user', JSON.stringify(data));
                } catch {
                    // El interceptor cierra la sesión sólo si el refresh expiró.
                    // Un corte de red no borra una sesión que todavía puede servir.
                }
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
        setVistaState(null);
        await AsyncStorage.removeItem('@Auth:token');
        await AsyncStorage.removeItem('@Auth:refresh');
        await AsyncStorage.removeItem('@Auth:user');
        await AsyncStorage.removeItem('@Auth:vista');
    }

    async function setVista(next: Vista | null) {
        if (!puedePrevisualizar(user)) return;
        setVistaState(next);
        if (next) await AsyncStorage.setItem('@Auth:vista', next);
        else await AsyncStorage.removeItem('@Auth:vista');
    }

    async function updateUser(next: User) {
        setUser(next);
        await AsyncStorage.setItem('@Auth:user', JSON.stringify(next));
    }

    return (
        <AuthContext.Provider value={{
            user,
            role: (puedePrevisualizar(user) && vista) ? rolDeVista(vista) : (user?.role || null),
            vista: puedePrevisualizar(user) ? vista : null,
            puedeCambiarVista: puedePrevisualizar(user),
            login,
            logout,
            updateUser,
            setVista,
            isLoading,
        }}>
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
