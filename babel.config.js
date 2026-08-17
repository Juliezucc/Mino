module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // react-native-worklets/plugin must stay last (required by Reanimated 4).
    plugins: ['react-native-worklets/plugin'],
  };
};
