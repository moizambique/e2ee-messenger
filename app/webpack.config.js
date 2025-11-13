const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Add a fallback for the 'crypto' module.
  // This is used by various libraries and needs a browser-compatible polyfill.
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    vm: require.resolve('vm-browserify'),
    stream: require.resolve('stream-browserify'),
  };

  return config;
};