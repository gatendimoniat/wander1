-- ExploraWander Database Schema
-- Execute this SQL in your Supabase SQL Editor

-- ============================================
-- ROUTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at DESC);

-- ============================================
-- TRACKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  positions JSONB NOT NULL DEFAULT '[]',
  distance NUMERIC NOT NULL DEFAULT 0,
  elevation_gain NUMERIC NOT NULL DEFAULT 0,
  elevation_loss NUMERIC NOT NULL DEFAULT 0,
  max_altitude NUMERIC NOT NULL DEFAULT 0,
  min_altitude NUMERIC NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_difficulty ON tracks(difficulty);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on both tables
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROUTES POLICIES
-- ============================================

-- Users can view their own routes
DROP POLICY IF EXISTS "Users can view their own routes" ON routes;
CREATE POLICY "Users can view their own routes"
  ON routes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own routes
DROP POLICY IF EXISTS "Users can insert their own routes" ON routes;
CREATE POLICY "Users can insert their own routes"
  ON routes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own routes
DROP POLICY IF EXISTS "Users can update their own routes" ON routes;
CREATE POLICY "Users can update their own routes"
  ON routes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own routes
DROP POLICY IF EXISTS "Users can delete their own routes" ON routes;
CREATE POLICY "Users can delete their own routes"
  ON routes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRACKS POLICIES
-- ============================================

-- Users can view their own tracks
DROP POLICY IF EXISTS "Users can view their own tracks" ON tracks;
CREATE POLICY "Users can view their own tracks"
  ON tracks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own tracks
DROP POLICY IF EXISTS "Users can insert their own tracks" ON tracks;
CREATE POLICY "Users can insert their own tracks"
  ON tracks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tracks
DROP POLICY IF EXISTS "Users can update their own tracks" ON tracks;
CREATE POLICY "Users can update their own tracks"
  ON tracks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tracks
DROP POLICY IF EXISTS "Users can delete their own tracks" ON tracks;
CREATE POLICY "Users can delete their own tracks"
  ON tracks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_routes_updated_at ON routes;
CREATE TRIGGER update_routes_updated_at
  BEFORE UPDATE ON routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tracks_updated_at ON tracks;
CREATE TRIGGER update_tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
