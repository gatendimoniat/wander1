import { describe, it, expect } from 'vitest';
import { haversine, calculateTrackStats } from '@/lib/exportImport';

describe('Haversine distance', () => {
  it('should calculate distance between same points as 0', () => {
    const dist = haversine(41.3874, 2.1686, 41.3874, 2.1686);
    expect(dist).toBeCloseTo(0, 2);
  });

  it('should calculate approximate distance Barcelona-Madrid', () => {
    const dist = haversine(41.3874, 2.1686, 40.4168, -3.7038);
    expect(dist).toBeGreaterThan(450);
    expect(dist).toBeLessThan(550);
  });

  it('should calculate distance for 1 degree latitude (~111km)', () => {
    const dist = haversine(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });
});

describe('Track statistics', () => {
  it('should return zero distance for single point', () => {
    const stats = calculateTrackStats([
      { lat: 41.3874, lng: 2.1686, altitude: 100, timestamp: Date.now() }
    ]);
    expect(stats.distance).toBe(0);
    expect(stats.elevationGain).toBe(0);
    expect(stats.elevationLoss).toBe(0);
    expect(stats.difficulty).toBe('easy');
  });

  it('should calculate distance and elevation for two points', () => {
    const stats = calculateTrackStats([
      { lat: 41.0, lng: 2.0, altitude: 100, timestamp: 1000 },
      { lat: 41.01, lng: 2.01, altitude: 200, timestamp: 2000 },
    ]);
    expect(stats.distance).toBeGreaterThan(0);
    expect(stats.elevationGain).toBe(100);
    expect(stats.elevationLoss).toBe(0);
    expect(stats.maxAltitude).toBe(200);
    expect(stats.minAltitude).toBe(100);
  });

  it('should classify difficulty based on elevation gain', () => {
    const easy = calculateTrackStats([
      { lat: 0, lng: 0, altitude: 0, timestamp: 0 },
      { lat: 0.001, lng: 0.001, altitude: 50, timestamp: 1000 },
    ]);
    expect(easy.difficulty).toBe('easy');

    const moderate = calculateTrackStats([
      { lat: 0, lng: 0, altitude: 0, timestamp: 0 },
      { lat: 0.001, lng: 0.001, altitude: 300, timestamp: 1000 },
    ]);
    expect(moderate.difficulty).toBe('moderate');

    const hard = calculateTrackStats([
      { lat: 0, lng: 0, altitude: 0, timestamp: 0 },
      { lat: 0.001, lng: 0.001, altitude: 600, timestamp: 1000 },
    ]);
    expect(hard.difficulty).toBe('hard');

    const expert = calculateTrackStats([
      { lat: 0, lng: 0, altitude: 0, timestamp: 0 },
      { lat: 0.001, lng: 0.001, altitude: 1100, timestamp: 1000 },
    ]);
    expect(expert.difficulty).toBe('expert');
  });

  it('should calculate elevation loss correctly', () => {
    const stats = calculateTrackStats([
      { lat: 0, lng: 0, altitude: 500, timestamp: 0 },
      { lat: 0.001, lng: 0, altitude: 200, timestamp: 1000 },
    ]);
    expect(stats.elevationGain).toBe(0);
    expect(stats.elevationLoss).toBe(300);
  });
});
