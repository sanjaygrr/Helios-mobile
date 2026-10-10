import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../theme/colors';
import api, { asList } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ModalSelector from './ModalSelector';

const TIPOS = [
  { id: 'FORESTAL', label: 'Forestal' },
  { id: 'ESTRUCTURAL', label: 'Estructural' },
  { id: 'RESCATE', label: 'Rescate' },
  { id: 'HAZMAT', label: 'Hazmat' },
  { id: 'OTRO', label: 'Otro' },
];

function nombrePersona(p: any) {
  const n = `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
  return n || (p?.email || '').split('@')[0] || 'Sin nombre';
}

function mensajeError(error: any, fallback: string) {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first[0]) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
}

export default function ReportarEmergencia({
  visible,
  incidente,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  incidente?: any | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const { user, role } = useAuth();
  const editando = !!incidente?.id;
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [companias, setCompanias] = useState<any[]>([]);
  const [carros, setCarros] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [vaEn, setVaEn] = useState<Record<number, number[]>>({});
  const [encargado, setEncargado] = useState<Record<number, number | null>>({});
  const [titulo, setTitulo] = useState('');
  const [clave, setClave] = useState('');
  const [tipo, setTipo] = useState('OTRO');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [showTipo, setShowTipo] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPaso(editando ? 3 : 1);
    setTitulo(incidente?.title || '');
    setClave(incidente?.dispatch_code || '');
    setTipo(incidente?.incident_type || 'OTRO');
    setDescripcion(incidente?.description || '');
    setDireccion('');
    setLat(Number(incidente?.latitude) || 0);
    setLng(Number(incidente?.longitude) || 0);
    setElegidos([]);
    setVaEn({});
    setEncargado({});
    setErrorCarga('');
    let vivo = true;
    setCargando(true);
    Promise.all([
      api.get('/companies/'),
      api.get('/units/'),
      api.get('/users/'),
    ]).then(([c, u, p]) => {
      if (!vivo) return;
      setCompanias(asList(c.data));
      setCarros(asList(u.data));
      setPersonas(asList(p.data));
    }).catch(() => {
      if (vivo) setErrorCarga('No pude cargar compañías ni carros. Cierra sesión y entra de nuevo.');
    }).finally(() => { if (vivo) setCargando(false); });

    if (!incidente?.latitude) {
      Location.requestForegroundPermissionsAsync()
        .then(({ status }) => status === 'granted' ? Location.getCurrentPositionAsync({}) : null)
        .then(pos => {
          if (!vivo || !pos) return;
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        })
        .catch(() => undefined);
    }
    return () => { vivo = false; };
  }, [visible, incidente?.id]);

  const grupos = useMemo(() => {
    const map = new Map<number, { compania: any; carros: any[] }>();
    companias.forEach(c => map.set(c.id, { compania: c, carros: [] }));
    carros.forEach(carro => {
      const id = carro.company;
      if (!map.has(id)) {
        map.set(id, {
          compania: { id, name: carro.company_name || 'Sin compañía', number: carro.company_number || '' },
          carros: [],
        });
      }
      map.get(id)!.carros.push(carro);
    });
    return [...map.values()].sort((a, b) =>
      String(a.compania.number || a.compania.name).localeCompare(
        String(b.compania.number || b.compania.name), 'es', { numeric: true }));
  }, [companias, carros]);

  const genteDe = (companyId: number) =>
    personas.filter(p => p.is_active !== false && p.company === companyId);

  const toggleCarro = (carro: any) => {
    if ((carro.status || '').toUpperCase() !== 'AVAILABLE') return;
    setElegidos(prev => prev.includes(carro.id)
      ? prev.filter(id => id !== carro.id)
      : [...prev, carro.id]);
  };

  const armarSalida = () => {
    if (elegidos.length === 0) {
      Alert.alert('Elige un carro', 'Marca al menos un carro disponible para la salida.');
      return;
    }
    const va: Record<number, number[]> = {};
    const jefes: Record<number, number | null> = {};
    const yaVan = new Set<number>();
    elegidos.forEach(id => {
      const carro = carros.find(c => c.id === id);
      const gente = genteDe(carro?.company).filter(p => !yaVan.has(p.id));
      const capitan = gente.find(p => p.role === 'COMPANY_CHIEF') || gente[0];
      va[id] = gente.map(p => p.id);
      jefes[id] = capitan?.id ?? null;
      gente.forEach(p => yaVan.add(p.id));
    });
    setVaEn(va);
    setEncargado(jefes);
    setPaso(2);
  };

  const mover = (carroId: number, personaId: number) => {
    const actuales = vaEn[carroId] || [];
    if (actuales.includes(personaId)) {
      const queda = actuales.filter(id => id !== personaId);
      setVaEn({ ...vaEn, [carroId]: queda });
      if (encargado[carroId] === personaId) {
        setEncargado({ ...encargado, [carroId]: queda[0] ?? null });
      }
      return;
    }
    const siguiente: Record<number, number[]> = {};
    Object.entries(vaEn).forEach(([k, ids]) => {
      const id = Number(k);
      siguiente[id] = id === carroId
        ? [...ids, personaId]
        : ids.filter(pid => pid !== personaId);
    });
    setVaEn(siguiente);
  };

  const guardar = async () => {
    if (!titulo.trim() || !clave.trim()) {
      Alert.alert('Falta el llamado', 'Escribe el título y la clave.');
      return;
    }
    setGuardando(true);
    try {
      let latitude = lat;
      let longitude = lng;
      if (!latitude && direccion.trim()) {
        const puntos = await Location.geocodeAsync(direccion.trim());
        if (puntos[0]) {
          latitude = puntos[0].latitude;
          longitude = puntos[0].longitude;
        }
      }
      if (!latitude || !longitude) {
        Alert.alert('Falta el lugar', 'Escribe la dirección y espera un segundo, o activa la ubicación.');
        setGuardando(false);
        return;
      }
      const cuerpo = user?.fire_department
        || carros.find(c => elegidos.includes(c.id))?.fire_department
        || incidente?.fire_department
        || null;
      if (role === 'SUPER_ADMIN' && !cuerpo) {
        Alert.alert('Falta el cuerpo', 'Elige un carro de un cuerpo, o entra con una cuenta de ese cuerpo.');
        setGuardando(false);
        return;
      }
      const payload = {
        title: titulo.trim(),
        dispatch_code: clave.trim(),
        description: descripcion.trim(),
        requested_units: Math.max(1, elegidos.length),
        incident_type: tipo,
        latitude,
        longitude,
        fire_department: cuerpo,
      };
      const res = editando
        ? await api.patch(`/incidents/${incidente.id}/`, payload)
        : await api.post('/incidents/', payload);
      const incidentId = res.data.id;
      if (!editando) {
        for (const carroId of elegidos) {
          const carro = carros.find(c => c.id === carroId);
          await api.post('/assignments/', {
            unit: carroId,
            incident: incidentId,
            encargado: encargado[carroId],
            tripulacion: vaEn[carroId] || [],
          }).catch((error) => {
            throw new Error(mensajeError(error, `No pude sacar ${carro?.name || 'el carro'}.`));
          });
        }
      }
      onGuardado();
      onClose();
      Alert.alert('Listo', editando ? 'Emergencia actualizada.' : 'Emergencia reportada.');
    } catch (error: any) {
      Alert.alert('No se guardó', error?.message && !error?.response
        ? error.message
        : mensajeError(error, 'Revisa los datos e inténtalo de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  const tituloPaso = editando
    ? 'Editar emergencia'
    : paso === 1 ? 'Compañías y carros'
    : paso === 2 ? 'Quién sale'
    : 'El llamado';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={estilos.fondo}>
        <View style={estilos.barra}>
          <TouchableOpacity onPress={paso > 1 && !editando ? () => setPaso(paso - 1) : onClose} hitSlop={12}>
            <Ionicons name={paso > 1 && !editando ? 'arrow-back' : 'close'} size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={estilos.titulo}>{tituloPaso}</Text>
          <Text style={estilos.paso}>{editando ? '' : `${paso}/3`}</Text>
        </View>

        {cargando ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">
            {!!errorCarga && <Text style={estilos.error}>{errorCarga}</Text>}

            {paso === 1 && !editando && grupos.map(grupo => (
              <View key={grupo.compania.id} style={estilos.bloque}>
                <Text style={estilos.compania}>
                  {grupo.compania.number ? `${grupo.compania.number} · ` : ''}{grupo.compania.name}
                </Text>
                {grupo.carros.length === 0 ? (
                  <Text style={estilos.vacio}>Esta compañía no tiene carros cargados.</Text>
                ) : grupo.carros.map(carro => {
                  const libre = (carro.status || '').toUpperCase() === 'AVAILABLE';
                  const marcado = elegidos.includes(carro.id);
                  return (
                    <TouchableOpacity
                      key={carro.id}
                      style={[estilos.carro, marcado && estilos.carroOn, !libre && estilos.carroOff]}
                      onPress={() => toggleCarro(carro)}
                      disabled={!libre}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={estilos.carroNombre}>{carro.name}</Text>
                        <Text style={estilos.especialidad}>
                          {carro.type_display || carro.unit_type || 'Sin especialidad'}
                          {libre ? '' : ` · ${carro.status_display || 'No disponible'}`}
                        </Text>
                      </View>
                      <Ionicons
                        name={marcado ? 'checkbox' : libre ? 'square-outline' : 'lock-closed'}
                        size={24}
                        color={marcado ? colors.accent : colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {paso === 1 && !editando && grupos.length === 0 && !errorCarga && (
              <Text style={estilos.vacio}>No hay compañías en tu cuerpo. Créalas en Gestión.</Text>
            )}

            {paso === 2 && elegidos.map(carroId => {
              const carro = carros.find(c => c.id === carroId);
              const van = vaEn[carroId] || [];
              const ocupados = new Set(elegidos.flatMap(id => id === carroId ? [] : (vaEn[id] || [])));
              const deCompania = genteDe(carro?.company);
              const disponibles = deCompania.filter(p => !van.includes(p.id) && !ocupados.has(p.id));
              return (
                <View key={carroId} style={estilos.bloque}>
                  <Text style={estilos.compania}>{carro?.name}</Text>
                  <Text style={estilos.especialidad}>{carro?.type_display || carro?.unit_type} · {carro?.company_name}</Text>
                  <Text style={estilos.seccion}>Va en el carro</Text>
                  {van.length === 0 && <Text style={estilos.vacio}>Nadie marcado. Toca a alguien de disponibles.</Text>}
                  {van.map(pid => {
                    const p = personas.find(x => x.id === pid);
                    const esJefe = encargado[carroId] === pid;
                    return (
                      <View key={pid} style={estilos.fila}>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => mover(carroId, pid)}>
                          <Text style={estilos.carroNombre}>{nombrePersona(p)}</Text>
                          <Text style={estilos.especialidad}>{esJefe ? 'A cargo del carro' : 'Tripulante'}</Text>
                        </TouchableOpacity>
                        {!esJefe && (
                          <TouchableOpacity onPress={() => setEncargado({ ...encargado, [carroId]: pid })}>
                            <Text style={estilos.link}>A cargo</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                  <Text style={estilos.seccion}>Disponibles</Text>
                  {disponibles.length === 0 && <Text style={estilos.vacio}>No queda nadie libre en esta compañía.</Text>}
                  {disponibles.map(p => (
                    <TouchableOpacity key={p.id} style={estilos.fila} onPress={() => mover(carroId, p.id)}>
                      <Text style={estilos.carroNombre}>{nombrePersona(p)}</Text>
                      <Text style={estilos.link}>Sube</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}

            {(paso === 3 || editando) && (
              <View>
                <Text style={estilos.seccion}>Título</Text>
                <TextInput style={estilos.input} value={titulo} onChangeText={setTitulo} placeholder="Incendio en Sector 5" placeholderTextColor={colors.textMuted} />
                <Text style={estilos.seccion}>Clave</Text>
                <TextInput style={estilos.input} value={clave} onChangeText={setClave} placeholder="10-0" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                <Text style={estilos.seccion}>Tipo</Text>
                <TouchableOpacity style={estilos.input} onPress={() => setShowTipo(true)}>
                  <Text style={estilos.carroNombre}>{TIPOS.find(t => t.id === tipo)?.label}</Text>
                </TouchableOpacity>
                <Text style={estilos.seccion}>Dirección</Text>
                <TextInput style={estilos.input} value={direccion} onChangeText={setDireccion} placeholder="Calle y número" placeholderTextColor={colors.textMuted} />
                <Text style={estilos.especialidad}>
                  {lat ? `Punto: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Sin punto todavía. Escribe la dirección o espera el GPS.'}
                </Text>
                <Text style={estilos.seccion}>Qué pasa</Text>
                <TextInput
                  style={[estilos.input, { minHeight: 90 }]}
                  value={descripcion}
                  onChangeText={setDescripcion}
                  placeholder="Riesgos, personas, referencia"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>
            )}
          </ScrollView>
        )}

        <View style={estilos.pie}>
          {paso === 1 && !editando && (
            <>
              <TouchableOpacity style={estilos.secundario} onPress={() => setPaso(3)}>
                <Text style={estilos.secundarioTexto}>Sin carro</Text>
              </TouchableOpacity>
              <TouchableOpacity style={estilos.primario} onPress={armarSalida}>
                <Text style={estilos.primarioTexto}>Sacar carros</Text>
              </TouchableOpacity>
            </>
          )}
          {paso === 2 && (
            <TouchableOpacity style={estilos.primario} onPress={() => setPaso(3)}>
              <Text style={estilos.primarioTexto}>Datos del llamado</Text>
            </TouchableOpacity>
          )}
          {(paso === 3 || editando) && (
            <TouchableOpacity style={estilos.primario} onPress={guardar} disabled={guardando}>
              <Text style={estilos.primarioTexto}>{guardando ? 'Guardando…' : editando ? 'Guardar' : 'Reportar'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <ModalSelector
          visible={showTipo}
          title="Tipo"
          options={TIPOS}
          onClose={() => setShowTipo(false)}
          onSelect={opt => setTipo(String(opt.id))}
        />
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.background },
  barra: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 56, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  titulo: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '700' },
  paso: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  bloque: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  compania: { color: colors.text, fontSize: 20, fontWeight: '700' },
  carro: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm,
    backgroundColor: '#24303A', borderRadius: borderRadius.md, padding: spacing.md,
    borderWidth: 1, borderColor: '#6B7380',
  },
  carroOn: { borderColor: colors.accent },
  carroOff: { opacity: 0.45 },
  carroNombre: { color: colors.text, fontSize: 18, fontWeight: '700' },
  especialidad: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  vacio: { color: colors.textMuted, fontSize: 16, marginTop: spacing.sm },
  seccion: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  fila: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm,
    backgroundColor: '#24303A', borderRadius: borderRadius.md, padding: spacing.md,
  },
  link: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: '#24303A', color: colors.text, fontSize: 18,
    borderWidth: 1, borderColor: '#6B7380', borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  error: { color: colors.warning, fontSize: 16, marginBottom: spacing.md },
  pie: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 28 },
  primario: {
    flex: 2, minHeight: 56, borderRadius: borderRadius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  primarioTexto: { color: colors.white, fontSize: 18, fontWeight: '700' },
  secundario: {
    flex: 1, minHeight: 56, borderRadius: borderRadius.md, backgroundColor: '#24303A',
    borderWidth: 1, borderColor: '#6B7380', alignItems: 'center', justifyContent: 'center',
  },
  secundarioTexto: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
