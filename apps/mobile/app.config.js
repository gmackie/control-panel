const IS_DEV = process.env.APP_VARIANT === 'development';

// Single Expo project (@gmacko/gmac-control-panel) with two app variants:
// Development: ControlPanel-Dev (com.gmacko.controlroom.dev) - Expo dev client
// Production:  ControlPanel (com.gmacko.controlroom) - TestFlight/App Store

const PROJECT_ID = 'bf500af1-1e4d-444f-ad90-1ce7146359ce';

const config = {
  expo: {
    name: IS_DEV ? 'ControlPanel-Dev' : 'GMAC Control Panel',
    slug: 'gmac-control-panel',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: IS_DEV ? 'controlpanel-dev' : 'controlpanel',
    jsEngine: 'hermes',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#111827',
    },
    assetBundlePatterns: ['**/*'],
    notification: {
      icon: './assets/notification-icon.png',
      color: '#8b5cf6',
      iosDisplayInForeground: true,
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? 'com.gmacko.controlroom.dev' : 'com.gmacko.controlroom',
      buildNumber: '1',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#111827',
      },
      package: IS_DEV ? 'com.gmacko.controlroom.dev' : 'com.gmacko.controlroom',
      versionCode: 1,
      permissions: [
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-splash-screen',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#8b5cf6',
          sounds: [],
        },
      ],
      'expo-asset',
    ],
    extra: {
      eas: {
        projectId: PROJECT_ID,
      },
      APP_VARIANT: process.env.APP_VARIANT || 'production',
    },
    owner: 'gmacko',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: `https://u.expo.dev/${PROJECT_ID}`,
    },
  },
};

export default config;
