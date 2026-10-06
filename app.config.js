// La clave de Google Maps NO se escribe en app.json: vive como variable sensible
// en EAS (GOOGLE_MAPS_API_KEY) y se inyecta acá en tiempo de build.
// Para correr local: GOOGLE_MAPS_API_KEY=... npx expo start
//
// iOS no la necesita: MapWidget usa PROVIDER_DEFAULT (Apple Maps) en iOS y
// PROVIDER_GOOGLE solo en Android.

const base = require('./app.json').expo;

module.exports = () => ({
  ...base,
  android: {
    ...base.android,
    config: {
      ...(base.android.config || {}),
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
});
