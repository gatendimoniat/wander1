import { TrackPoint } from '@/lib/types';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

const RECORDING_INTERVAL = 3000;

async function requestIgnoreBatteryOptimization() {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { isAvailable } = await Device.isFeatureAvailable('BatteryOptimization');
    if (isAvailable) {
      await Device.releaseBatteryOptimization({
        reason: 'Need continuous GPS tracking for track recording'
      });
    }
  } catch (e) {
    console.log('Battery optimization release not available:', e);
  }
}

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
      if (Capacitor.isNativePlatform()) {
        const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
        this.bgGeolocationPlugin = BackgroundGeolocation;
        console.log('BackgroundGeolocation plugin loaded');
      }
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
    await requestIgnoreBatteryOptimization();

    if (this.bgGeolocationPlugin) {
      await this.startNative();
    } else {
      this.startBrowser();
    }
  }

  private async startNative() {
    const plugin = this.bgGeolocationPlugin;

    try {
      await plugin.requestPermission();
    } catch (e) {
      console.log('Permission request error:', e);
    }

    plugin.configure({
      interval: RECORDING_INTERVAL / 1000,
      fastestInterval: 3000,
      activitiesInterval: 3000,
      stopOnTerminate: false,
      startOnBoot: false,
      debug: false,
      startForegroundService: true,
      notificationTitle: 'ExploraWander',
      notificationText: 'Gravant track...',
      notificationChannelName: 'ExploraWander',
      notificationChannelDescription: 'Gravació de track en segon pla',
      notificationChannelId: 'explorawander_channel',
      locationProvider: 2,
      desiredAccuracy: 3,
      stationaryRadius: 3,
      distanceFilter: 3,
      stopStillThreshold: 0,
      enableTimestampInUnixSeconds: true,
    });

    plugin.on('location', (location: any) => {
      const now = Date.now();
      if (now - this.lastRecordedTime < RECORDING_INTERVAL) {
        return;
      }
      this.lastRecordedTime = now;

      const timestamp = location.timestamp || location.time || now;
      const point: TrackPoint = {
        lat: location.latitude,
        lng: location.longitude,
        altitude: location.altitude ?? undefined,
        timestamp: typeof timestamp === 'number' && timestamp > 1e12 ? timestamp : now,
      };

      console.log('Track point recorded:', point);
      this.trackPoints.push(point);
      this.onPointCallback?.(point);
    });

    plugin.on('error', (error: any) => {
      console.error('Background geolocation error:', error);
      this.onErrorCallback?.('Error de GPS');
    });

    await plugin.start();
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
