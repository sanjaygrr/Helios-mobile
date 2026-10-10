import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/colors';
import api, { asList } from '../services/api';
import ModalSelector from '../components/ModalSelector';
import ListaAgrupada from '../components/ListaAgrupada';

export default function ManageUsersScreen() {
    const [users, setUsers] = useState<any[]>([]);
    const [errorCarga, setErrorCarga] = useState('');
    const [isModalVisible, setModalVisible] = useState(false);
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        role: 'FIREFIGHTER',
        fire_department: null as number | null,
        company: null as number | null
    });

    const [departments, setDepartments] = useState<{ id: number; label: string }[]>([]);
    const [companies, setCompanies] = useState<{ id: number; label: string }[]>([]);

    const [showDeptSelector, setShowDeptSelector] = useState(false);
    const [showCompSelector, setShowCompSelector] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchDepartments();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users/');
            setUsers(asList(response.data));
            setErrorCarga('');
        } catch (error) {
            setErrorCarga('No pude cargar los usuarios. Cierra sesión y entra de nuevo.');
        }
    };

    const fetchDepartments = async () => {
        try {
            const response = await api.get('/departments/');
            setDepartments(asList(response.data).map((d: any) => ({ id: d.id, label: d.name })));
        } catch (error) {
            console.error(error);
        }
    };

    const fetchCompanies = async (deptId: number) => {
        try {
            const response = await api.get(`/companies/?fire_department=${deptId}`);
            setCompanies(asList(response.data).map((c: any) => ({ id: c.id, label: `${c.name} (${c.number})` })));
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateUser = async () => {
        try {
            await api.post('/users/', newUser);
            setModalVisible(false);
            fetchUsers();
            setNewUser({ email: '', password: '', role: 'FIREFIGHTER', fire_department: null, company: null });
            Alert.alert('Éxito', 'Usuario creado correctamente');
        } catch (error) {
            Alert.alert('Error', 'No se pudo crear el usuario. Verifique los permisos o datos.');
        }
    };

    const getDeptLabel = () => departments.find((d: any) => d.id === newUser.fire_department)?.label || 'Seleccionar Cuerpo';
    const getCompLabel = () => companies.find((c: any) => c.id === newUser.company)?.label || 'Seleccionar Compañía';

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.crearBarra} onPress={() => setModalVisible(true)}>
                <Ionicons name="person-add" size={22} color={colors.white} />
                <Text style={styles.crearBarraTexto}>Crear usuario</Text>
            </TouchableOpacity>
            {!!errorCarga && <Text style={styles.errorCarga}>{errorCarga}</Text>}
            <ListaAgrupada
                datos={users}
                criterios={[
                    { clave: 'compania', etiqueta: 'Compañía',
                      grupo: (u: any) => u.company_details?.name || 'Sin compañía' },
                    { clave: 'comuna', etiqueta: 'Ciudad',
                      grupo: (u: any) => u.company_details?.comuna || 'Sin ciudad' },
                    { clave: 'cuerpo', etiqueta: 'Cuerpo',
                      grupo: (u: any) => u.fire_department_details?.name || 'Sin cuerpo' },
                    { clave: 'rol', etiqueta: 'Rol',
                      grupo: (u: any) => ({
                          SUPER_ADMIN: 'Super Admin', COMPANY_ADMIN: 'Comandante',
                          COMPANY_CHIEF: 'Jefe de Compañía', FIREFIGHTER: 'Bombero',
                      } as any)[u.role] || u.role },
                ]}
                claveItem={(u: any) => String(u.id)}
                buscarEn={(u: any) =>
                    `${u.first_name || ''} ${u.last_name || ''} ${u.email} ${u.company_details?.name || ''}`}
                render={(item: any) => {
                    const getRoleInfo = (role: string) => {
                        switch (role) {
                            case 'SUPER_ADMIN': return { label: 'Super Admin', color: colors.danger, icon: 'shield' };
                            case 'COMPANY_ADMIN': return { label: 'Administrador', color: colors.secondary, icon: 'settings' };
                            case 'COMPANY_CHIEF': return { label: 'Jefe de Compañía', color: colors.accent, icon: 'star' };
                            case 'FIREFIGHTER': return { label: 'Bombero', color: colors.success, icon: 'flame' };
                            default: return { label: role, color: colors.gray[500], icon: 'person' };
                        }
                    };
                    const roleInfo = getRoleInfo(item.role);

                    return (
                        <View style={styles.userCard}>
                            {/* Avatar */}
                            <View style={[styles.avatar, { backgroundColor: roleInfo.color + '20' }]}>
                                <Ionicons name={roleInfo.icon as any} size={24} color={roleInfo.color} />
                            </View>

                            {/* Info */}
                            <View style={styles.userInfo}>
                                <Text style={styles.userEmail}>
                                    {(item.first_name || item.last_name)
                                        ? `${item.first_name || ''} ${item.last_name || ''}`.trim()
                                        : item.email}
                                </Text>
                                {(item.first_name || item.last_name) ? (
                                    <Text style={styles.companyLabel}>{item.email}</Text>
                                ) : null}
                                <View style={styles.userMeta}>
                                    <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '15' }]}>
                                        <Text style={[styles.roleText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
                                    </View>
                                    {item.company_details && (
                                        <Text style={styles.companyLabel}>• Cía {item.company_details.number}</Text>
                                    )}
                                </View>
                            </View>

                            {/* Status */}
                            <View style={[styles.statusBadge, { backgroundColor: item.is_active ? colors.success + '15' : colors.gray[100] }]}>
                                <View style={[styles.statusDot, { backgroundColor: item.is_active ? colors.success : colors.gray[400] }]} />
                                <Text style={[styles.statusText, { color: item.is_active ? colors.success : colors.gray[500] }]}>
                                    {item.is_active ? 'Activo' : 'Inactivo'}
                                </Text>
                            </View>
                        </View>
                    );
                }}
                vacio={<Text style={styles.emptyText}>No hay usuarios registrados</Text>}
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="add" size={24} color={colors.white} />
            </TouchableOpacity>

            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>Crear Usuario</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor={colors.textMuted}
                                value={newUser.email}
                                onChangeText={(t) => setNewUser({ ...newUser, email: t })}
                                autoCapitalize="none"
                            />

                            <TextInput
                                style={styles.input}
                                placeholder="Contraseña"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry
                                value={newUser.password}
                                onChangeText={(t) => setNewUser({ ...newUser, password: t })}
                            />

                            <Text style={styles.label}>Rol:</Text>
                            <View style={styles.roleButtons}>
                                {['FIREFIGHTER', 'COMPANY_CHIEF', 'COMPANY_ADMIN'].map(r => (
                                    <TouchableOpacity
                                        key={r}
                                        style={[styles.roleButton, newUser.role === r && styles.roleButtonActive]}
                                        onPress={() => setNewUser({ ...newUser, role: r })}
                                    >
                                        <Text style={[styles.roleButtonText, newUser.role === r && styles.roleButtonTextActive]}>
                                            {r.replace('COMPANY_', '').replace('FIREFIGHTER', 'BOMBERO')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Organización:</Text>
                            <TouchableOpacity style={styles.selectButton} onPress={() => setShowDeptSelector(true)}>
                                <Text style={styles.selectText}>{getDeptLabel()}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.text} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.selectButton, !newUser.fire_department && styles.disabled]}
                                onPress={() => newUser.fire_department && setShowCompSelector(true)}
                                disabled={!newUser.fire_department}
                            >
                                <Text style={styles.selectText}>{getCompLabel()}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.text} />
                            </TouchableOpacity>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.createButton} onPress={handleCreateUser}>
                                    <Text style={styles.createButtonText}>Crear</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ModalSelector
                visible={showDeptSelector}
                title="Seleccionar Cuerpo"
                options={departments}
                searchable
                onClose={() => setShowDeptSelector(false)}
                onSelect={(opt) => {
                    setNewUser({ ...newUser, fire_department: opt.id as number, company: null });
                    fetchCompanies(opt.id as number);
                }}
            />

            <ModalSelector
                visible={showCompSelector}
                title="Seleccionar Compañía"
                options={companies}
                onClose={() => setShowCompSelector(false)}
                onSelect={(opt) => setNewUser({ ...newUser, company: opt.id as number })}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing.md, paddingBottom: 100 },
    userCard: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    userEmail: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    userMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    roleBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: borderRadius.sm,
    },
    roleText: {
        fontSize: 11,
        fontWeight: '600',
    },
    companyLabel: {
        fontSize: 12,
        color: colors.textMuted,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: borderRadius.lg,
        gap: 5,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: borderRadius.sm,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: colors.textMuted,
        fontSize: 15,
    },
    activeBadge: { padding: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: borderRadius.sm },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.md,
        width: 60,
        height: 60,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.scrim,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: spacing.xl,
        maxHeight: '90%',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: spacing.lg,
        textAlign: 'center',
        color: colors.text,
    },
    crearBarra: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        margin: spacing.md, minHeight: 56, borderRadius: borderRadius.md,
        backgroundColor: colors.primary,
    },
    crearBarraTexto: { color: colors.white, fontSize: 18, fontWeight: '700' },
    errorCarga: { color: colors.danger, fontSize: 16, marginHorizontal: spacing.md, marginBottom: spacing.sm },
    input: {
        backgroundColor: '#24303A',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        fontSize: 18,
        borderWidth: 1,
        borderColor: '#6B7380', color: colors.text,},
    label: {
        fontWeight: '600',
        marginBottom: spacing.sm,
        color: colors.text,
        fontSize: 14,
    },
    roleButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
    roleButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        borderWidth: 1.5,
        borderColor: colors.accent,
        backgroundColor: colors.surface,
    },
    roleButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.accent,
    },
    roleButtonText: { fontSize: 16, fontWeight: '700', color: colors.text },
    roleButtonTextActive: { color: colors.textOnPrimary },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.lg },
    cancelButton: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: '#24303A',
        borderWidth: 1,
        borderColor: '#6B7380',
        alignItems: 'center',
    },
    cancelText: { color: colors.text, fontSize: 16, fontWeight: '700' },
    selectText: { color: colors.text, fontSize: 18, flex: 1 },
    createButton: {
        flex: 2,
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    createButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    selectButton: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#24303A', padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md,
        borderWidth: 1, borderColor: '#6B7380'
    },
    disabled: { opacity: 0.5 },
});
