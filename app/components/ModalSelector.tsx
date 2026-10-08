import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/colors';

interface Option {
    id: number | string;
    label: string;
}

interface ModalSelectorProps {
    visible: boolean;
    title: string;
    options: Option[];
    onSelect: (option: Option) => void;
    onClose: () => void;
    searchable?: boolean;
}

export default function ModalSelector({ visible, title, options, onSelect, onClose, searchable }: ModalSelectorProps) {
    const [search, setSearch] = React.useState('');
    const filteredOptions = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {searchable && (
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar..."
                            value={search}
                            onChangeText={setSearch}
                            placeholderTextColor={colors.textDisabled}
                        />
                    )}

                    <FlatList
                        data={filteredOptions}
                        keyExtractor={item => item.id.toString()}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.option}
                                onPress={() => {
                                    onSelect(item);
                                    onClose();
                                }}
                            >
                                <Text style={styles.optionText}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                        style={styles.list}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
    container: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg, padding: spacing.md, maxHeight: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { fontSize: 18, fontWeight: 'bold' },
    searchInput: { backgroundColor: colors.gray[100], padding: spacing.sm, borderRadius: borderRadius.md, marginBottom: spacing.sm, color: colors.text,},
    list: { marginTop: spacing.xs },
    option: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
    optionText: { fontSize: 16 },
});
