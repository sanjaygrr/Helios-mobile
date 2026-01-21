import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/colors';
import api from '../services/api';
import ModalSelector from '../components/ModalSelector';

export default function ManageUsersScreen() {
    const [users, setUsers] = useState([]);
    const [isModalVisible, setModalVisible] = useState(false);
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        role: 'FIREFIGHTER',
        fire_department: null as number | null,
        company: null as number | null
    });

    const [departments, setDepartments] = useState([]);
    const [companies, setCompanies] = useState([]);

    const [showDeptSelector, setShowDeptSelector] = useState(false);
    const [showCompSelector, setShowCompSelector] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchDepartments();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users/');
            setUsers(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDepartments = async () => {
        try {
            const response = await api.get('/departments/');
            setDepartments(response.data.map((d: any) => ({ id: d.id, label: d.name })));
        } catch (error) {
            console.error(error);
        }
    };

    const fetchCompanies = async (deptId: number) => {
        try {
            const response = await api.get(`/companies/?fire_department=${deptId}`);
            setCompanies(response.data.map((c: any) => ({ id: c.id, label: `${c.name} (${c.number})` })));
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
            <FlatList
                data={users}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.userCard}>
                        <View>
                            <Text style={styles.userEmail}>{item.email}</Text>
                            <Text style={styles.userRole}>
                                {item.role}
                                {item.company_details ? ` - ${item.company_details.number}` : ''}
                            </Text>
                        </View>
                        <View style={styles.activeBadge}>
                            <View style={[styles.dot, { backgroundColor: item.is_active ? colors.success : colors.danger }]} />
                        </View>
                    </View>
                )}
                contentContainerStyle={styles.listContent}
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
                                value={newUser.email}
                                onChangeText={(t) => setNewUser({ ...newUser, email: t })}
                                autoCapitalize="none"
                            />

                            <TextInput
                                style={styles.input}
                                placeholder="Contraseña"
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
                                <Text>{getDeptLabel()}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.selectButton, !newUser.fire_department && styles.disabled]}
                                onPress={() => newUser.fire_department && setShowCompSelector(true)}
                                disabled={!newUser.fire_department}
                            >
                                <Text>{getCompLabel()}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
                            </TouchableOpacity>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                                    <Text>Cancelar</Text>
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
    listContent: { padding: spacing.md },
    userCard: {
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    userEmail: { fontSize: 16, fontWeight: '600' },
    userRole: { fontSize: 12, color: colors.gray[500], marginTop: 2 },
    activeBadge: { padding: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: 4 },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.md,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        maxHeight: '80%',
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: spacing.lg, textAlign: 'center' },
    input: {
        backgroundColor: colors.gray[100],
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    label: { fontWeight: '600', marginBottom: spacing.xs, color: colors.gray[700] },
    roleButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
    roleButton: {
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 16, borderWidth: 1, borderColor: colors.primary
    },
    roleButtonActive: { backgroundColor: colors.primary },
    roleButtonText: { fontSize: 12, color: colors.primary },
    roleButtonTextActive: { color: colors.white },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
    cancelButton: { padding: spacing.md },
    createButton: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md },
    createButtonText: { color: colors.white, fontWeight: '600' },
    selectButton: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md
    },
    disabled: { opacity: 0.5 },
});
