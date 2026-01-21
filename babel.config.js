module.exports = function (api) {
  // api.cache(true); // Disable cache for now to ensure platform check works dynamically or use api.cache.invalidate(() => process.env.NODE_ENV)
  api.cache.using(() => process.env.NODE_ENV);

  const isWeb = api.caller((caller) => caller && caller.platform === 'web');

  const plugins = [];

  if (isWeb) {
    plugins.push([
      'module-resolver',
      {
        alias: {
          'react-native': 'react-native-web',
          'react-native-maps': './shims/react-native-maps-web.js',
          'react-native-web/Libraries/Image/AssetRegistry': 'react-native-web/dist/modules/AssetRegistry',
        },
      },
    ]);
  }








  return {
    presets: ['babel-preset-expo'],
    plugins: plugins,
  };
};
