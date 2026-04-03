import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.explorawander.app',
  appName: 'ExploraWander',
  webDir: 'dist',
  plugins: {
    BackgroundGeolocation: {
      android: {
        allowMockLocations: false,
        activitiesInterval: 10000,
        debug: false,
        desiredAccuracy: 100,
        distanceFilter: 0,
        fastestInterval: 5000,
        interval: 10000,
        locationProvider: 0,
        startForeground: true,
        startOnBoot: false,
        stationaryRadius: 0,
        stopOnTerminate: false,
        notificationTitle: 'ExploraWander',
        notificationText: 'Gravant track...',
        notificationIconColor: '#1a2332',
      },
    },
  },
};

export default config;
