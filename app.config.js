// Configuración única de la app. Antes vivía partida entre app.json y este
// archivo, y no quedaba claro cuál mandaba.
//
// La clave de Google Maps NO se escribe acá: vive como variable sensible en
// EAS (GOOGLE_MAPS_API_KEY) y se inyecta en tiempo de build.
// Para correr local: GOOGLE_MAPS_API_KEY=... npx expo start
//
// MapWidget usa Google Maps en Android, iOS y en la web (SDK de JavaScript).

const config = {
    "name": "Lumbre",
    "slug": "lumbre",
    "owner": "sanjaygrr",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "cl.lumbre.app",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Lumbre necesita acceso a tu ubicacion para rastrear la posicion de tu unidad.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Lumbre necesita acceso a tu ubicacion para rastrear la posicion de tu unidad en tiempo real.",
        "ITSAppUsesNonExemptEncryption": false,
        "UIBackgroundModes": [
          "location",
          "remote-notification"
        ]
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#12161B"
      },
      "package": "cl.lumbre.app",
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Lumbre necesita acceso a tu ubicacion para rastrear tu unidad.",
          "isAndroidBackgroundLocationEnabled": true,
          "isIosBackgroundLocationEnabled": true
        }
      ],
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash.png",
          "resizeMode": "contain",
          "backgroundColor": "#12161B"
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#B82E0A",
          "defaultChannel": "despachos"
        }
      ],
      [
        "react-native-maps",
        {
          "iosGoogleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY,
          "androidGoogleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY
        }
      ],
      "expo-asset",
      "expo-font",
      "expo-status-bar"
    ],
    "extra": {
      "eas": {
        "projectId": "cb991a4c-af05-4b98-bbe8-e318cc62feb0"
      },
      // La misma clave de EAS. El mapa web la necesita en el bundle; no va al repo.
      "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY || ""
    },
    "runtimeVersion": {
      "policy": "sdkVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/cb991a4c-af05-4b98-bbe8-e318cc62feb0"
    },
    "scheme": "lumbre"
  };

module.exports = () => ({
  ...config,
  ios: {
    ...config.ios,
    config: {
      ...(config.ios.config || {}),
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    ...config.android,
    config: {
      ...(config.android.config || {}),
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY },
    },
  },
});
