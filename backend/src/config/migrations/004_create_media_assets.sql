-- Media Assets Table Migration
-- Management of images, videos, and animations for the home page

-- Create media assets table
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('image', 'video', 'animation', 'icon')),
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT, -- Size in bytes
  mime_type VARCHAR(100),
  alt_text VARCHAR(255),
  caption TEXT,
  section VARCHAR(50) NOT NULL CHECK (section IN ('hero', 'features', 'pricing', 'testimonials', 'footer')),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_optimized BOOLEAN DEFAULT FALSE,
  optimization_settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb, -- For storing dimensions, duration, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for efficient media queries
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_section ON media_assets(section);
CREATE INDEX IF NOT EXISTS idx_media_assets_active ON media_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_media_assets_display_order ON media_assets(display_order);
CREATE INDEX IF NOT EXISTS idx_media_assets_section_order ON media_assets(section, display_order);

-- Add updated_at trigger for media_assets table
DROP TRIGGER IF EXISTS trigger_media_assets_updated_at ON media_assets;
CREATE TRIGGER trigger_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get media assets by section
CREATE OR REPLACE FUNCTION get_media_assets_by_section(p_section VARCHAR(50))
RETURNS TABLE(
  id UUID,
  asset_type VARCHAR(20),
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  alt_text VARCHAR(255),
  caption TEXT,
  display_order INTEGER,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT ma.id, ma.asset_type, ma.file_path, ma.file_name, 
         ma.alt_text, ma.caption, ma.display_order, ma.metadata
  FROM media_assets ma
  WHERE ma.section = p_section AND ma.is_active = TRUE
  ORDER BY ma.display_order ASC, ma.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get hero media assets
CREATE OR REPLACE FUNCTION get_hero_media_assets()
RETURNS TABLE(
  id UUID,
  asset_type VARCHAR(20),
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  alt_text VARCHAR(255),
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT ma.id, ma.asset_type, ma.file_path, ma.file_name, ma.alt_text, ma.metadata
  FROM media_assets ma
  WHERE ma.section = 'hero' AND ma.is_active = TRUE
  ORDER BY ma.display_order ASC
  LIMIT 5; -- Limit hero assets for performance
END;
$$ LANGUAGE plpgsql;

-- Function to update media asset optimization status
CREATE OR REPLACE FUNCTION mark_media_optimized(
  p_asset_id UUID,
  p_optimization_settings JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE media_assets 
  SET is_optimized = TRUE,
      optimization_settings = p_optimization_settings,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_asset_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup unused media assets
CREATE OR REPLACE FUNCTION cleanup_unused_media_assets()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Mark assets as inactive if they haven't been accessed in 30 days
  -- This is a soft delete approach
  UPDATE media_assets 
  SET is_active = FALSE,
      updated_at = CURRENT_TIMESTAMP
  WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND is_active = TRUE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;