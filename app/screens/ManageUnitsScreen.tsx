import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function ManageUnitsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Gestión de Unidades</Text>
            <Text style={styles.subtext}>Próximamente: Crear y editar carros/unidades.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    text: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    subtext: { color: colors.gray[500], marginTop: 8 },
});
