import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/colors';

export interface SectionMember {
    id: string; // internal temp id
    firstName: string;
    lastName: string;
    rut: string;
    role: string; // 'Comandante', 'Conductor', etc.
    company: string; // 'Primera', etc.
}

interface PersonnelFormProps {
    onChange: (members: SectionMember[]) => void;
    initialMembers?: SectionMember[];
}

export default function PersonnelForm({ onChange, initialMembers = [] }: PersonnelFormProps) {
    const [members, setMembers] = useState<SectionMember[]>(initialMembers);
    const [isExpanded, setIsExpanded] = useState(true);

    // Form Header Fields (Static for now or passed from parent?)
    // The image has: Lugar, Cuerpo, Lider, Contacto. 
    // We will assume these are context-based or part of the incident header, 
    // but here we focus on the LIST of people.

    const addMember = () => {
        const newMember: SectionMember = {
            id: Date.now().toString(),
            firstName: '',
            lastName: '',
            rut: '',
            role: 'Voluntario',
            company: 'Primera'
        };
        const updated = [...members, newMember];
        setMembers(updated);
        onChange(updated);
    };

    const removeMember = (id: string) => {
        const updated = members.filter(m => m.id !== id);
        setMembers(updated);
        onChange(updated);
    };

    const updateMember = (id: string, field: keyof SectionMember, value: string) => {
        const updated = members.map(m => {
            if (m.id === id) {
                return { ...m, [field]: value };
            }
            return m;
        });
        setMembers(updated);
        onChange(updated);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.header} onPress={() => setIsExpanded(!isExpanded)}>
                <Text style={styles.headerTitle}>Lista de Personal (Form. IF-AC-3)</Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.text} />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.content}>
                    {/* Header Info Block simulation */}
                    <View style={styles.formHeaderBlock}>
                        <Text style={styles.formLabel}>Lider del Grupo:</Text>
                        <TextInput style={styles.headerInput} placeholder="Nombre del oficial a cargo"     placeholderTextColor={colors.textMuted}
                        />
                    </View>

                    <Text style={styles.sectionTitle}>Personal Concurrente ({members.length})</Text>

                    {members.map((member, index) => (
                        <View key={member.id} style={styles.memberCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.memberIndex}>#{index + 1}</Text>
                                <TouchableOpacity onPress={() => removeMember(member.id)}>
                                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Apellidos</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={member.lastName}
                                        onChangeText={t => updateMember(member.id, 'lastName', t)}
                                        placeholder="Apellidos"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Nombres</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={member.firstName}
                                        onChangeText={t => updateMember(member.id, 'firstName', t)}
                                        placeholder="Nombres"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.col, { flex: 2 }]}>
                                    <Text style={styles.label}>RUT</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={member.rut}
                                        onChangeText={t => updateMember(member.id, 'rut', t)}
                                        placeholder="12.345.678-9"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="default"
                                    />
                                </View>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Cía</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={member.company}
                                        onChangeText={t => updateMember(member.id, 'company', t)}
                                        placeholder="N°"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Cargo / Función</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={member.role}
                                        onChangeText={t => updateMember(member.id, 'role', t)}
                                        placeholder="Cargo"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addButton} onPress={addMember}>
                        <Ionicons name="add-circle" size={20} color={colors.white} />
                        <Text style={styles.addButtonText}>Agregar Personal</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.gray[200],
        marginBottom: spacing.md,
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.gray[100]
    },
    headerTitle: {
        fontWeight: 'bold',
        color: colors.text,
        fontSize: 14
    },
    content: {
        padding: spacing.md
    },
    formHeaderBlock: {
        backgroundColor: colors.surfaceRaised,
        padding: 10,
        marginBottom: 15,
        borderRadius: borderRadius.sm,
        borderLeftWidth: 4,
        borderLeftColor: colors.secondary
    },
    formLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.gray[600],
        marginBottom: 4
    },
    headerInput: {
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[300],
        paddingVertical: 4,
        fontSize: 14, color: colors.text,},
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.accent,
        marginBottom: 10
    },
    memberCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.gray[200],
        borderRadius: borderRadius.sm,
        padding: 10,
        marginBottom: 10,
        elevation: 1
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    memberIndex: {
        fontWeight: 'bold',
        color: colors.textMuted
    },
    row: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8
    },
    col: {
        flex: 1
    },
    label: {
        fontSize: 14,
        color: colors.textMuted,
        marginBottom: 2
    },
    inputSmall: {
        backgroundColor: '#24303A',
        borderWidth: 1,
        borderColor: '#6B7380',
        borderRadius: borderRadius.sm,
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 16,
        height: 40, color: colors.text,},
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.success,
        padding: 10,
        borderRadius: borderRadius.sm,
        marginTop: 5,
        gap: 8
    },
    addButtonText: {
        color: colors.white,
        fontWeight: 'bold',
        fontSize: 14
    }
});
