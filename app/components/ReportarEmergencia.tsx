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
import { compararCarros, etiquetaCarro, nombreCarroConOrigen, origenCarro } from '../utils/claves';

const TIPOS = [
  { id: 'FORESTAL', label: 'Forestal' },
  { id: 'ESTRUCTURAL', label: 'Estructural' },
  { id: 'RESCATE', label: 'Rescate' },
  { id: 'HAZMAT', label: 'Hazmat' },
  { id: 'OTRO', label: 'Otro' },
];

const LUGARES = [
  { id: 'URBANO', label: 'Urbano' },
  { id: 'RURAL', label: 'Rural' },
  { id: 'FORESTAL', label: 'Forestal' },
  { id: 'INTERFAZ', label: 'Interfaz' },
  { id: 'CARRETERA', label: 'Carretera' },
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

function nombreCentral(cuerpo: any) {
  return cuerpo?.central_name || (cuerpo?.name ? `Central de ${cuerpo.name}` : 'Central');
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
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [companias, setCompanias] = useState<any[]>([]);
  const [carros, setCarros] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [lugar, setLugar] = useState('');
  const [protagonista, setProtagonista] = useState<number | null>(null);
  const [apoyos, setApoyos] = useState<number[]>([]);
  const [region, setRegion] = useState('');
  const [selector, setSelector] = useState<null | 'region' | 'central' | 'apoyo'>(null);
  const [companiaAbierta, setCompaniaAbierta] = useState<number | null>(null);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [vaEn, setVaEn] = useState<Record<number, number[]>>({});
  const [encargado, setEncargado] = useState<Record<number, number | null>>({});
  const [titulo, setTitulo] = useState('');
  const [clave, setClave] = useState('');
  const [tipo, setTipo] = useState('OTRO');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [comuna, setComuna] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [ubicacionEstado, setUbicacionEstado] = useState<'idle' | 'searching' | 'found' | 'error'>('idle');
  const [showTipo, setShowTipo] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const centrales = Array.isArray(incidente?.centrales) ? incidente.centrales : [];
    const prot = centrales.find((c: any) => c.role === 'PROTAGONISTA');
    setPaso(editando ? 4 : 1);
    setLugar(incidente?.geographic_type || '');
    setProtagonista(prot?.fire_department || incidente?.fire_department || user?.fire_department || null);
    setApoyos(centrales.filter((c: any) => c.role === 'APOYO').map((c: any) => c.fire_department));
    setRegion('');
    setSelector(null);
    setCompaniaAbierta(null);
    setTitulo(incidente?.title || '');
    setClave(incidente?.dispatch_code || '');
    setTipo(incidente?.incident_type || 'OTRO');
    setDescripcion(incidente?.description || '');
    setDireccion(incidente?.address || '');
    setComuna(incidente?.comuna || '');
    setLat(Number(incidente?.latitude) || 0);
    setLng(Number(incidente?.longitude) || 0);
    setUbicacionEstado(incidente?.latitude ? 'found' : 'idle');
    setElegidos([]);
    setVaEn({});
    setEncargado({});
    setErrorCarga('');
    let vivo = true;
    setCargando(true);
    Promise.all([
      api.get('/departments/', { params: { para: 'emergencia' } }),
      api.get('/companies/'),
      api.get('/units/'),
      api.get('/users/'),
    ]).then(([d, c, u, p]) => {
      if (!vivo) return;
      setDepartamentos(asList(d.data));
      setCompanias(asList(c.data));
      setCarros(asList(u.data));
      setPersonas(asList(p.data));
    }).catch(() => {
      if (vivo) setErrorCarga('No pude cargar cuerpos ni carros. Cierra sesión y entra de nuevo.');
    }).finally(() => { if (vivo) setCargando(false); });

    return () => { vivo = false; };
  }, [visible, incidente?.id]);

  const cuerpoDe = (id: number | null) => departamentos.find(d => d.id === id);

  const grupos = useMemo(() => {
    const map = new Map<number, { compania: any; carros: any[] }>();
    companias.forEach(c => map.set(c.id, { compania: c, carros: [] }));
    carros.forEach(carro => {
      const id = carro.company;
      if (!map.has(id)) {
        map.set(id, {
          compania: {
            id,
            name: carro.company_name || 'Sin compañía',
            number: carro.company_number || '',
            fire_department: carro.fire_department,
          },
          carros: [],
        });
      }
      map.get(id)!.carros.push(carro);
    });
    return [...map.values()]
      .map(g => ({ ...g, carros: [...g.carros].sort(compararCarros) }))
      .sort((a, b) =>
        String(a.compania.number || a.compania.name).localeCompare(
          String(b.compania.number || b.compania.name), 'es', { numeric: true }));
  }, [companias, carros]);

  useEffect(() => {
    if (region || departamentos.length === 0) return;
    const propia = departamentos.find(d => d.id === (protagonista || user?.fire_department));
    if (propia?.region) setRegion(propia.region);
  }, [departamentos, protagonista, region, user?.fire_department]);

  const regiones = useMemo(() => {
    const nombres = departamentos.map(d => d.region).filter(Boolean);
    return [...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es'));
  }, [departamentos]);

  const deLaRegion = useMemo(
    () => departamentos.filter(d => !region || d.region === region),
    [departamentos, region],
  );

  useEffect(() => {
    if (!visible || !region.trim() || !comuna.trim() || !direccion.trim()) return;
    let vivo = true;
    setUbicacionEstado('searching');
    const timer = setTimeout(async () => {
      try {
        const consulta = [direccion.trim(), comuna.trim(), region.trim(), 'Chile'].join(', ');
        const puntos = await Location.geocodeAsync(consulta);
        if (!vivo) return;
        if (!puntos[0]) {
          setLat(0);
          setLng(0);
          setUbicacionEstado('error');
          return;
        }
        setLat(puntos[0].latitude);
        setLng(puntos[0].longitude);
        setUbicacionEstado('found');
      } catch {
        if (vivo) setUbicacionEstado('error');
      }
    }, 700);
    return () => { vivo = false; clearTimeout(timer); };
  }, [visible, region, comuna, direccion]);

  const genteDe = (companyId: number) =>
    personas.filter(p => p.is_active !== false && p.company === companyId);

  const marcarProtagonista = (id: number) => {
    setApoyos(actual => {
      const sinEste = actual.filter(x => x !== id);
      if (protagonista && protagonista !== id && !sinEste.includes(protagonista)) {
        return [...sinEste, protagonista];
      }
      return sinEste;
    });
    setProtagonista(id);
  };

  const alternarApoyo = (id: number) => {
    if (id === protagonista) return;
    setApoyos(actual => actual.includes(id) ? actual.filter(x => x !== id) : [...actual, id]);
  };

  const seguirACarros = () => {
    if (!lugar) {
      Alert.alert('Falta el lugar', 'Elige si es urbano, rural, forestal, interfaz o carretera.');
      return;
    }
    if (!protagonista) {
      Alert.alert('Falta la central', 'Marca la central que tiene el problema.');
      return;
    }
    setPaso(2);
  };

  const toggleCarro = (carro: any) => {
    const deOtroCuerpo = carro.fire_department && user?.fire_department
      && carro.fire_department !== user.fire_department && role !== 'SUPER_ADMIN';
    const deOtraCompania = role === 'COMPANY_CHIEF'
      && user?.company && carro.company !== user.company;
    if (deOtroCuerpo || deOtraCompania || (carro.status || '').toUpperCase() !== 'AVAILABLE') return;
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
    setPaso(3);
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
    if (!lugar) {
      Alert.alert('Falta el lugar', 'Elige el tipo geográfico.');
      return;
    }
    if (!protagonista) {
      Alert.alert('Falta la central', 'Marca la central que tiene el problema.');
      return;
    }
    if (!titulo.trim() || !clave.trim()) {
      Alert.alert('Falta el llamado', 'Escribe el título y la clave.');
      return;
    }
    setGuardando(true);
    try {
      let latitude = lat;
      let longitude = lng;
      if (!region.trim() || !comuna.trim() || !direccion.trim()) {
        Alert.alert('Falta la dirección', 'Completa región, comuna, calle y número.');
        setGuardando(false);
        return;
      }
      if (direccion.trim()) {
        const consulta = [direccion.trim(), comuna.trim(), region.trim(), 'Chile'].join(', ');
        const puntos = await Location.geocodeAsync(consulta);
        if (puntos[0]) {
          latitude = puntos[0].latitude;
          longitude = puntos[0].longitude;
        }
      }
      if (!latitude || !longitude) {
        Alert.alert('Dirección no encontrada', 'Revisa región, comuna, calle y número.');
        setGuardando(false);
        return;
      }
      const centrales = [
        { fire_department: protagonista, role: 'PROTAGONISTA' },
        ...apoyos.filter(id => id !== protagonista).map(id => ({ fire_department: id, role: 'APOYO' })),
      ];
      const payload = {
        title: titulo.trim(),
        dispatch_code: clave.trim(),
        description: descripcion.trim(),
        requested_units: Math.max(1, elegidos.length),
        incident_type: tipo,
        geographic_type: lugar,
        address: direccion.trim(),
        comuna: comuna.trim(),
        latitude,
        longitude,
        fire_department: protagonista,
        centrales,
      };
      if (editando) {
        await api.patch(`/incidents/${incidente.id}/`, payload);
      } else {
        await api.post('/incidents/create-and-dispatch/', {
          incident: payload,
          dispatches: elegidos.map(carroId => ({
            unit: carroId,
            encargado: encargado[carroId],
            tripulacion: vaEn[carroId] || [],
          })),
        });
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
    : paso === 1 ? 'Lugar y centrales'
    : paso === 2 ? 'Compañías y carros'
    : paso === 3 ? 'Quién sale'
    : 'El llamado';

  const resumen = [
    LUGARES.find(l => l.id === lugar)?.label,
    comuna.trim(),
    nombreCentral(cuerpoDe(protagonista)),
  ].filter(Boolean).join(' · ');

  const bloqueLugar = (
    <View>
      <Text style={estilos.seccion}>Tipo de lugar</Text>
      <View style={estilos.chips}>
        {LUGARES.map(opcion => {
          const activo = lugar === opcion.id;
          return (
            <TouchableOpacity
              key={opcion.id}
              style={[estilos.chip, activo && estilos.chipOn]}
              onPress={() => setLugar(opcion.id)}
            >
              <Text style={[estilos.chipTexto, activo && estilos.chipTextoOn]}>{opcion.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={estilos.seccion}>Región</Text>
      <TouchableOpacity style={estilos.input} onPress={() => setSelector('region')}>
        <Text style={estilos.carroNombre}>{region || 'Elegir región'}</Text>
      </TouchableOpacity>
      <Text style={estilos.seccion}>Comuna</Text>
      <TextInput style={estilos.input} value={comuna} onChangeText={texto => { setComuna(texto); setLat(0); setLng(0); }} placeholder="Concepción" placeholderTextColor={colors.textMuted} />
      <Text style={estilos.seccion}>Calle y número</Text>
      <TextInput style={estilos.input} value={direccion} onChangeText={texto => { setDireccion(texto); setLat(0); setLng(0); }} placeholder="O'Higgins 525" placeholderTextColor={colors.textMuted} />
      <Text style={estilos.especialidad}>
        {ubicacionEstado === 'searching' ? 'Buscando dirección…'
          : ubicacionEstado === 'found' && lat ? `Ubicación encontrada · ${lat.toFixed(5)}, ${lng.toFixed(5)}`
          : ubicacionEstado === 'error' ? 'No encontramos esa dirección. Revisa los datos.'
          : 'Completa los tres campos para ubicar la emergencia.'}
      </Text>
      <Text style={estilos.seccion}>Central que tiene el problema</Text>
      <TouchableOpacity style={estilos.input} onPress={() => setSelector('central')}>
        <Text style={estilos.carroNombre}>
          {protagonista ? nombreCentral(cuerpoDe(protagonista)) : 'Elegir central comunal'}
        </Text>
      </TouchableOpacity>
      <Text style={estilos.especialidad}>Solo aparecen los cuerpos de {region || 'la región que elijas'}.</Text>
      {apoyos.length > 0 && (
        <View style={estilos.chips}>
          {apoyos.map(id => (
            <TouchableOpacity key={id} style={estilos.chip} onPress={() => alternarApoyo(id)}>
              <Text style={estilos.chipTexto}>{nombreCentral(cuerpoDe(id))} · quitar</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TouchableOpacity style={estilos.secundarioEnLinea} onPress={() => setSelector('apoyo')}>
        <Text style={estilos.secundarioTexto}>Sumar central de apoyo</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={estilos.fondo}>
        <View style={estilos.barra}>
          <TouchableOpacity onPress={paso > 1 && !editando ? () => setPaso(paso - 1) : onClose} hitSlop={12}>
            <Ionicons name={paso > 1 && !editando ? 'arrow-back' : 'close'} size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={estilos.titulo}>{tituloPaso}</Text>
          <Text style={estilos.paso}>{editando ? '' : `${paso}/4`}</Text>
        </View>

        {cargando ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">
            {!!errorCarga && <Text style={estilos.error}>{errorCarga}</Text>}
            {paso > 1 && !!resumen && <Text style={estilos.especialidad}>{resumen}</Text>}

            {(paso === 1 || editando) && bloqueLugar}

            {paso === 2 && !editando && (
              <View style={estilos.bloque}>
                <Text style={estilos.compania}>{nombreCentral(cuerpoDe(protagonista))}</Text>
                <Text style={estilos.especialidad}>Toca una compañía para ver sus carros.</Text>
                {grupos.filter(g => g.compania.fire_department === protagonista).length === 0 && (
                  <Text style={estilos.vacio}>Esta central no tiene compañías cargadas.</Text>
                )}
                {grupos.filter(g => g.compania.fire_department === protagonista).map(grupo => {
                  const abierta = companiaAbierta === grupo.compania.id;
                  const libres = grupo.carros.filter((c: any) => (c.status || '').toUpperCase() === 'AVAILABLE').length;
                  return (
                    <View key={grupo.compania.id}>
                      <TouchableOpacity
                        style={estilos.fila}
                        onPress={() => setCompaniaAbierta(abierta ? null : grupo.compania.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={estilos.carroNombre}>
                            {grupo.compania.number ? `${grupo.compania.number} · ` : ''}{grupo.compania.name}
                          </Text>
                          <Text style={estilos.especialidad}>
                            {grupo.carros.length} carros · {libres} disponibles
                          </Text>
                        </View>
                        <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
                      </TouchableOpacity>
                      {abierta && grupo.carros.map(carro => {
                        const deOtro = carro.fire_department && user?.fire_department
                          && carro.fire_department !== user.fire_department && role !== 'SUPER_ADMIN';
                        const deOtraCompania = role === 'COMPANY_CHIEF'
                          && user?.company && carro.company !== user.company;
                        const libre = !deOtro && !deOtraCompania
                          && (carro.status || '').toUpperCase() === 'AVAILABLE';
                        const marcado = elegidos.includes(carro.id);
                        return (
                          <TouchableOpacity
                            key={carro.id}
                            style={[estilos.carro, marcado && estilos.carroOn, !libre && estilos.carroOff]}
                            onPress={() => toggleCarro(carro)}
                            disabled={!libre}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={estilos.carroNombre}>{nombreCarroConOrigen(carro)}</Text>
                              <Text style={estilos.especialidad}>
                                {etiquetaCarro(carro.unit_type, carro.type_display)}
                                {deOtro || deOtraCompania
                                  ? ' · Lo saca su central'
                                  : libre ? '' : ` · ${carro.status_display || 'No disponible'}`}
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
                      {abierta && grupo.carros.length === 0 && (
                        <Text style={estilos.vacio}>Esta compañía no tiene carros cargados.</Text>
                      )}
                    </View>
                  );
                })}
                {apoyos.map(id => (
                  <Text key={id} style={estilos.especialidad}>
                    {nombreCentral(cuerpoDe(id))} va en apoyo. Sus carros los saca esa central.
                  </Text>
                ))}
              </View>
            )}

            {paso === 3 && elegidos.map(carroId => {
              const carro = carros.find(c => c.id === carroId);
              const van = vaEn[carroId] || [];
              const ocupados = new Set(elegidos.flatMap(id => id === carroId ? [] : (vaEn[id] || [])));
              const deCompania = genteDe(carro?.company);
              const disponibles = deCompania.filter(p => !van.includes(p.id) && !ocupados.has(p.id));
              return (
                <View key={carroId} style={estilos.bloque}>
                  <Text style={estilos.compania}>{nombreCarroConOrigen(carro)}</Text>
                  <Text style={estilos.especialidad}>{[etiquetaCarro(carro?.unit_type, carro?.type_display), origenCarro(carro)].filter(Boolean).join(' · ')}</Text>
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

            {(paso === 4 || editando) && (
              <View>
                <Text style={estilos.seccion}>Título</Text>
                <TextInput style={estilos.input} value={titulo} onChangeText={setTitulo} placeholder="Incendio en Sector 5" placeholderTextColor={colors.textMuted} />
                <Text style={estilos.seccion}>Clave</Text>
                <TextInput style={estilos.input} value={clave} onChangeText={setClave} placeholder="10-0" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                <Text style={estilos.seccion}>Tipo de emergencia</Text>
                <TouchableOpacity style={estilos.input} onPress={() => setShowTipo(true)}>
                  <Text style={estilos.carroNombre}>{TIPOS.find(t => t.id === tipo)?.label}</Text>
                </TouchableOpacity>
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
            <TouchableOpacity style={estilos.primario} onPress={seguirACarros}>
              <Text style={estilos.primarioTexto}>Compañías y carros</Text>
            </TouchableOpacity>
          )}
          {paso === 2 && !editando && (
            <>
              <TouchableOpacity style={estilos.secundario} onPress={() => setPaso(4)}>
                <Text style={estilos.secundarioTexto}>Sin carro</Text>
              </TouchableOpacity>
              <TouchableOpacity style={estilos.primario} onPress={armarSalida}>
                <Text style={estilos.primarioTexto}>Sacar carros</Text>
              </TouchableOpacity>
            </>
          )}
          {paso === 3 && (
            <TouchableOpacity style={estilos.primario} onPress={() => setPaso(4)}>
              <Text style={estilos.primarioTexto}>Datos del llamado</Text>
            </TouchableOpacity>
          )}
          {(paso === 4 || editando) && (
            <TouchableOpacity style={estilos.primario} onPress={guardar} disabled={guardando}>
              <Text style={estilos.primarioTexto}>{guardando ? 'Guardando…' : editando ? 'Guardar' : 'Reportar'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <ModalSelector
          visible={showTipo}
          title="Tipo de emergencia"
          options={TIPOS}
          onClose={() => setShowTipo(false)}
          onSelect={opt => setTipo(String(opt.id))}
        />
        <ModalSelector
          visible={selector === 'region'}
          title="Región"
          searchable
          options={regiones.map(nombre => ({ id: nombre, label: nombre }))}
          onClose={() => setSelector(null)}
          onSelect={opt => {
            setRegion(String(opt.id));
            setSelector(null);
          }}
        />
        <ModalSelector
          visible={selector === 'central' || selector === 'apoyo'}
          title={selector === 'apoyo' ? 'Central de apoyo' : 'Central protagonista'}
          searchable
          options={deLaRegion
            .filter(d => selector !== 'apoyo' || (d.id !== protagonista && !apoyos.includes(d.id)))
            .map(d => ({ id: d.id, label: `${nombreCentral(d)} · ${d.name}` }))}
          onClose={() => setSelector(null)}
          onSelect={opt => {
            const id = Number(opt.id);
            if (selector === 'apoyo') alternarApoyo(id);
            else {
              const cuerpo = departamentos.find(d => d.id === id);
              if (cuerpo?.region) setRegion(cuerpo.region);
              marcarProtagonista(id);
            }
            setSelector(null);
          }}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#24303A', borderWidth: 1, borderColor: '#6B7380',
    borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: 14,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.primary },
  chipTexto: { color: colors.text, fontSize: 16, fontWeight: '700' },
  chipTextoOn: { color: colors.white },
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
  secundarioEnLinea: {
    minHeight: 48, borderRadius: borderRadius.md, backgroundColor: '#24303A',
    borderWidth: 1, borderColor: '#6B7380', alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm,
  },
});
