import { applePlatform, appleSimulator } from '@react-native-harness/platform-apple';
import { androidPlatform, androidEmulator } from '@react-native-harness/platform-android';

export default {
  forwardClientLogs: true,
  entryPoint: './harness.entry.ts',
  appRegistryComponentName: 'main',
  cache: { metro: false },
  runners: [
    applePlatform({ name: 'ios', device: appleSimulator(process.env.HARNESS_IOS_DEVICE ?? 'iPhone 16 Pro', process.env.HARNESS_IOS_VERSION ?? '18.5'), bundleId: 'com.iauti.nitrologger.example' }),
    androidPlatform({ name: 'android', device: androidEmulator('NitroLogger_API_36', { apiLevel: 36, profile: 'pixel_8', diskSize: '2G', heapSize: '1G' }), bundleId: 'com.iauti.nitrologger.example' }),
  ],
  defaultRunner: 'ios',
};
