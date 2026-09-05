const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
if (process.env.RN_HARNESS === 'true') {
  const expoResolveRequest = config.resolver.resolveRequest;
  // Harness requests its sentinel relative to the app; Expo expands Router's entry relative to the workspace.
  config.server.unstable_serverRoot = __dirname;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.endsWith('/node_modules/expo-router/entry')) {
      return { type: 'sourceFile', filePath: require.resolve('@react-native-harness/runtime/entry-point') };
    }
    return expoResolveRequest ? expoResolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
  };
}
module.exports = config;
