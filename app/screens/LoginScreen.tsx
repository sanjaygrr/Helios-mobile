import React, { useState } from 'react';
import Logo from '../../assets/logo.svg';
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../theme/colors';

import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const DismissKeyboard = ({ children }: { children: React.ReactNode }) => {
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      {children}
    </TouchableWithoutFeedback>
  );
};

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (err) {
      const msg = (err && (err as any).message) || '';
      if (msg.includes('Network Error') || msg.includes('timeout')) {
        setError('No se pudo conectar al servidor. Verifique su red o la URL del backend en Ajustes.');
      } else {
        setError('Credenciales invalidas o error de conexion.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Background gradient effect */}
      <View style={styles.backgroundTop} />
      <View style={styles.backgroundCircle1} />
      <View style={styles.backgroundCircle2} />
      <View style={styles.backgroundCircle3} />

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <DismissKeyboard>
          <View>
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                {/* <Logo width={120} height={120} /> */}
                <Ionicons name="flame" size={100} color={colors.primary} />
              </View>
              <Text style={styles.logoText}>HELIOS</Text>
              <View style={styles.taglineContainer}>
                <View style={styles.taglineLine} />
                <Text style={styles.taglineText}>Sistema de Emergencias</Text>
                <View style={styles.taglineLine} />
              </View>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.welcomeText}>Bienvenido</Text>
                <Text style={styles.instructionText}>
                  Ingresa tus credenciales para continuar
                </Text>
              </View>

              {/* Error message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={[
                styles.inputContainer,
                focusedInput === 'email' && styles.inputContainerFocused
              ]}>
                <View style={[
                  styles.inputIcon,
                  focusedInput === 'email' && styles.inputIconFocused
                ]}>
                  <Ionicons
                    name="mail-outline"
                    size={22}
                    color={focusedInput === 'email' ? colors.primary : colors.gray[400]}
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Correo electronico"
                  placeholderTextColor={colors.gray[400]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError('');
                  }}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Input */}
              <View style={[
                styles.inputContainer,
                focusedInput === 'password' && styles.inputContainerFocused
              ]}>
                <View style={[
                  styles.inputIcon,
                  focusedInput === 'password' && styles.inputIconFocused
                ]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color={focusedInput === 'password' ? colors.primary : colors.gray[400]}
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Contrasena"
                  placeholderTextColor={colors.gray[400]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError('');
                  }}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.gray[400]}
                  />
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Iniciar Sesion</Text>
                    <View style={styles.loginButtonIconContainer}>
                      <Ionicons name="arrow-forward" size={20} color={colors.primary} />
                    </View>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>Lumbre v1.0</Text>
                <View style={styles.divider} />
              </View>
            </View>
            <View style={{ height: spacing.xl }} />
          </View>
        </DismissKeyboard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  backgroundTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
    backgroundColor: colors.primary,
  },
  backgroundCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.secondary,
    opacity: 0.15,
  },
  backgroundCircle2: {
    position: 'absolute',
    top: height * 0.25,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.secondary,
    opacity: 0.1,
  },
  backgroundCircle3: {
    position: 'absolute',
    bottom: height * 0.15,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.primary,
    opacity: 0.3,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 80 : 50,
    paddingBottom: spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  logoImage: {
    width: 90,
    height: 90,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  taglineLine: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  taglineText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    ...shadows.lg,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  instructionText: {
    fontSize: 15,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray[100],
  },
  inputContainerFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  inputIcon: {
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  inputIconFocused: {
    // Icon color is handled inline
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: colors.text,
  },
  passwordToggle: {
    padding: spacing.md,
  },
  loginButton: {
    backgroundColor: colors.primary,
    height: 58,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    ...shadows.md,
  },
  loginButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  loginButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loginButtonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[200],
  },
  dividerText: {
    fontSize: 12,
    color: colors.gray[400],
    fontWeight: '500',
  },
});
