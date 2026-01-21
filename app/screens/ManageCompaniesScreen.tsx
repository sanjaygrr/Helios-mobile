import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/colors';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ModalSelector from '../components/ModalSelector';

export default function ManageCompaniesScreen() {
    const { user, role } = useAuth();
    const [companies, setCompanies] = useState([]);
    const [isModalVisible, setModalVisible] = useState(false);
    const [newCompany, setNewCompany] = useState({ name: '', number: '', fire_department: user?.fire_department });

    // For SuperAdmin to filtering/creating
    const [departments, setDepartments] = useState([]);
    const [showDeptSelector, setShowDeptSelector] = useState(false);

    useEffect(() => {
        fetchCompanies();
        if (role === 'SUPER_ADMIN') {
            fetchDepartments();
        }
    }, []);

    const fetchCompanies = async () => {
        try {
            const url = role === 'SUPER_ADMIN' ? '/companies/' : `/companies/?fire_department=${user?.fire_department}`;
            const response = await api.get(url);
            setCompanies(response.data);
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

    const handleCreateCompany = async () => {
        if (!newCompany.fire_department) {
            Alert.alert('Error', 'Seleccione un Cuerpo de Bomberos');
            return;
        }
        try {
            await api.post('/companies/', newCompany);
            setModalVisible(false);
            fetchCompanies();
            setNewCompany({ name: '', number: '', fire_department: user?.fire_department });
            Alert.alert('Éxito', 'Compañía creada');
        } catch (error) {
            Alert.alert('Error', 'No se pudo crear la compañía');
        }
    };

    const getDeptLabel = () =>
        departments.find((d: any) => d.id === newCompany.fire_department)?.label || 'Seleccionar Cuerpo';

    return (
        <View style={styles.container}>
            <FlatList
                data={companies}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.iconBox}>
                            <Ionicons name="business" size={24} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.md }}>
                            <Text style={styles.title}>{item.name}</Text>
                            <Text style={styles.subtitle}>Compañía N° {item.number}</Text>
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
                        <Text style={styles.modalTitle}>Nueva Compañía</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Nombre (ej: Primera Compañía)"
                            value={newCompany.name}
                            onChangeText={(t) => setNewCompany({ ...newCompany, name: t })}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Número (ej: 1, B-1)"
                            value={newCompany.number}
                            onChangeText={(t) => setNewCompany({ ...newCompany, number: t })}
                        />

                        {role === 'SUPER_ADMIN' && (
                            <TouchableOpacity style={styles.selectButton} onPress={() => setShowDeptSelector(true)}>
                                <Text>{getDeptLabel()}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.gray[500]} />
                            </TouchableOpacity>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                                <Text>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.createButton} onPress={handleCreateCompany}>
                                <Text style={styles.createButtonText}>Crear</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <ModalSelector
                visible={showDeptSelector}
                title="Seleccionar Cuerpo"
                options={departments}
                searchable
                onClose={() => setShowDeptSelector(false)}
                onSelect={(opt) => setNewCompany({ ...newCompany, fire_department: opt.id as number })}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing.md },
    card: {
        backgroundColor: colors.white,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    iconBox: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center'
    },
    title: { fontSize: 16, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.gray[500] },
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
    modalContent: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.xl },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: spacing.lg, textAlign: 'center' },
    input: { backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
    cancelButton: { padding: spacing.md },
    createButton: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md },
    createButtonText: { color: colors.white, fontWeight: '600' },
    selectButton: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.gray[100], padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md
    },
});
