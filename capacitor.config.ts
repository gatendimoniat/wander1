import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.explorawander.app',
  appName: 'ExploraWander',
  webDir: 'dist',
  plugins: {
    BackgroundGeolocation: {
      android: {
        allowMockLocations: false,
        activitiesInterval: 3000,
        debug: false,
        desiredAccuracy: 3,
        distanceFilter: 3,
        fastestInterval: 3000,
        interval: 3000,
        locationProvider: 2,
        startForeground: true,
        startOnBoot: false,
        stationaryRadius: 3,
        stopOnTerminate: false,
        notificationTitle: 'ExploraWander',
        notificationText: 'Gravant track...',
        notificationIconColor: '#1a2332',
        foregroundServiceType: 'location',
      },
    },
  },
};

export default config;
