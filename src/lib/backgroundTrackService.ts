import { TrackPoint } from '@/lib/types';

const RECORDING_INTERVAL = 5000;

export class BackgroundTrackService {
  private isRecording = false;
  private trackPoints: TrackPoint[] = [];
  private lastRecordedTime = 0;
  private watchId: number | null = null;
  private bgGeolocationPlugin: any = null;
  private onPointCallback?: (point: TrackPoint) => void;
  private onErrorCallback?: (error: string) => void;
  private initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
      this.bgGeolocationPlugin = BackgroundGeolocation;
      console.log('BackgroundGeolocation plugin loaded');
    } catch (e) {
      console.log('Background geolocation plugin not available, using browser geolocation', e);
    }
    this.initialized = true;
  }

  async start(onPoint: (point: TrackPoint) => void, onError: (error: string) => void) {
    this.onPointCallback = onPoint;
    this.onErrorCallback = onError;
    this.trackPoints = [];
    this.lastRecordedTime = 0;
    this.isRecording = true;

    await this.init();

    if (this.bgGeolocationPlugin) {
      this.startNative();
    } else {
      this.startBrowser();
    }
  }

  private startNative() {
    const plugin = this.bgGeolocationPlugin;

    plugin.configure({
      interval: RECORDING_INTERVAL / 1000,
      fastestInterval: 5000,
      activitiesInterval: 5000,
      stopOnTerminate: false,
      startOnBoot: true,
      debug: false,
      startForeground: true,
      notificationTitle: 'ExploraWander',
      notificationText: 'Gravant track...',
      locationProvider: 1,
      desiredAccuracy: 0,
      stationaryRadius: 0,
      distanceFilter: 0,
      wakeLock: true,
      notificationIconColor: '#1a2332',
      notificationIconLarge: '',
      notificationIconSmall: '',
    });

    plugin.on('location', (location: any) => {
      const now = Date.now();
      if (now - this.lastRecordedTime < RECORDING_INTERVAL) {
        return;
      }
      this.lastRecordedTime = now;

      const point: TrackPoint = {
        lat: location.latitude,
        lng: location.longitude,
        altitude: location.altitude ?? undefined,
        timestamp: location.time ?? now,
      };

      this.trackPoints.push(point);
      this.onPointCallback?.(point);
    });

    plugin.on('error', (error: any) => {
      console.error('Background geolocation error:', error);
      this.onErrorCallback?.('Error de GPS');
    });

    plugin.start();
  }

  private startBrowser() {
    if (!navigator.geolocation) {
      this.onErrorCallback?.('Geolocalització no disponible');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = pos.timestamp;
        if (now - this.lastRecordedTime < RECORDING_INTERVAL) {
          return;
        }
        this.lastRecordedTime = now;

        const point: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude ?? undefined,
          timestamp: pos.timestamp,
        };

        this.trackPoints.push(point);
        this.onPointCallback?.(point);
      },
      (err) => {
        let errorMsg = 'Error de GPS';
        if (err.code === 1) errorMsg = 'Permís de GPS denegat';
        else if (err.code === 2) errorMsg = 'GPS no disponible';
        else if (err.code === 3) errorMsg = 'Temps d\'espera del GPS exhaurit';
        this.onErrorCallback?.(errorMsg);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  stop() {
    this.isRecording = false;

    if (this.bgGeolocationPlugin) {
      try {
        this.bgGeolocationPlugin.stop();
      } catch (e) {
        console.error('Error stopping background geolocation:', e);
      }
    } else if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  getPoints(): TrackPoint[] {
    return [...this.trackPoints];
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  isNativeAvailable(): boolean {
    return this.bgGeolocationPlugin !== null;
  }
}

export const backgroundTrackService = new BackgroundTrackService();
