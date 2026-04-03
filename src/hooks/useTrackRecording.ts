import { useRef, useState, useCallback } from 'react';
import { TrackPoint } from '@/lib/types';

const RECORDING_INTERVAL = 10000;

export function useTrackRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const recordingTrackRef = useRef<TrackPoint[]>([]);
  const lastRecordedTimeRef = useRef<number>(0);
  const bgGeolocationPluginRef = useRef<any>(null);

  const startRecording = useCallback((t: (key: string) => string) => {
    if (!navigator.geolocation) {
      alert(t('track.noGeolocation'));
      return;
    }
    if (trackPoints.length > 0) {
      if (!window.confirm(t('track.confirmClear'))) {
        return;
      }
    }
    setTrackPoints([]);
    recordingTrackRef.current = [];
    lastRecordedTimeRef.current = 0;
    setIsRecording(true);
    setGpsError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = pos.timestamp;
        if (now - lastRecordedTimeRef.current < RECORDING_INTERVAL) {
          return;
        }
        lastRecordedTimeRef.current = now;
        const point: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude ?? undefined,
          timestamp: pos.timestamp,
        };
        recordingTrackRef.current.push(point);
        setTrackPoints((prev) => [...prev, point]);
        setGpsError(null);
      },
      (err) => {
        console.error('GPS error:', err);
        let errorMsg = t('track.gpsError');
        if (err.code === 1) errorMsg = t('track.gpsDenied');
        else if (err.code === 2) errorMsg = t('track.gpsUnavailable');
        else if (err.code === 3) errorMsg = t('track.gpsTimeout');
        setGpsError(errorMsg);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, [trackPoints.length]);

  const stopRecording = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const getTrackPoints = useCallback(() => {
    return Array.from(recordingTrackRef.current);
  }, []);

  return {
    isRecording,
    trackPoints,
    gpsError,
    startRecording,
    stopRecording,
    getTrackPoints,
  };
}
