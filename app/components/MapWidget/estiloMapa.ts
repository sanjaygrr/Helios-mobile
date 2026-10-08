/**
 * Estilo del mapa para Google Maps en Android.
 *
 * El mapa estaba en "hybrid": satélite con todas las etiquetas encima, así que
 * los nombres de locales, paraderos y negocios tapaban lo único que importa,
 * que es dónde está cada carro y cada bombero.
 *
 * Esta versión deja relieve y calles, y apaga todo lo demás. Los nombres de
 * calle se conservan: sin ellos la central no puede despachar.
 */
export const estiloMapa = [
  // Base
  { elementType: 'geometry', stylers: [{ color: '#1A2026' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A949E' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0E1217' }, { weight: 3 }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // Fuera todo lo que no sea terreno ni calle
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },

  // Relieve y vegetación: contexto del terreno, sin nombres
  { featureType: 'landscape.natural', elementType: 'geometry',
    stylers: [{ color: '#1E262D' }] },
  { featureType: 'landscape.natural.terrain', elementType: 'geometry',
    stylers: [{ color: '#223038' }] },
  { featureType: 'poi.park', elementType: 'geometry',
    stylers: [{ color: '#18241E' }, { visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  // Calles: lo que sí tiene que leerse
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2B343C' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0E1217' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#A8B0BA' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#36414A' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#45525C' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill',
    stylers: [{ color: '#C9D0D8' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },

  // Agua
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B1A24' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4A6675' }] },

  // Ciudades y comunas sí, en tono bajo
  { featureType: 'administrative.locality', elementType: 'labels.text.fill',
    stylers: [{ color: '#7D8794' }] },
  // Google reparte los POI en varias subcategorias: hay que apagarlas una a una,
  // la regla general de 'poi' no alcanza para todas.
  { featureType: 'poi.government', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.line', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.province', elementType: 'labels',
    stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
