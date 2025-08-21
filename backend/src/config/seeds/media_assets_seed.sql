-- Media Assets Seed Data
-- Initial media assets for the home page redesign

-- Hero Section Assets
INSERT INTO media_assets (
  asset_type,
  file_path,
  file_name,
  alt_text,
  section,
  display_order,
  metadata
) VALUES 
(
  'video',
  '/assets/hero/hero-video.mp4',
  'hero-video.mp4',
  'Perbox platform demonstration video showing email campaign creation',
  'hero',
  1,
  '{
    "duration": 30,
    "width": 1920,
    "height": 1080,
    "format": "mp4",
    "autoplay": true,
    "loop": true,
    "muted": true
  }'::jsonb
),
(
  'image',
  '/assets/hero/hero-background.jpg',
  'hero-background.jpg',
  'Premium gradient background for hero section',
  'hero',
  2,
  '{
    "width": 1920,
    "height": 1080,
    "format": "jpg",
    "quality": 90,
    "responsive": true
  }'::jsonb
),
(
  'image',
  '/assets/hero/hero-dashboard-preview.png',
  'hero-dashboard-preview.png',
  'Perbox dashboard interface preview showing email analytics',
  'hero',
  3,
  '{
    "width": 1200,
    "height": 800,
    "format": "png",
    "quality": 95,
    "responsive": true
  }'::jsonb
);

-- Features Section Assets
INSERT INTO media_assets (
  asset_type,
  file_path,
  file_name,
  alt_text,
  section,
  display_order,
  metadata
) VALUES 
(
  'image',
  '/assets/features/email-builder.png',
  'email-builder.png',
  'Drag and drop email builder interface',
  'features',
  1,
  '{
    "width": 800,
    "height": 600,
    "format": "png",
    "quality": 90,
    "responsive": true
  }'::jsonb
),
(
  'image',
  '/assets/features/analytics-dashboard.png',
  'analytics-dashboard.png',
  'Email campaign analytics and reporting dashboard',
  'features',
  2,
  '{
    "width": 800,
    "height": 600,
    "format": "png",
    "quality": 90,
    "responsive": true
  }'::jsonb
),
(
  'video',
  '/assets/features/automation-demo.mp4',
  'automation-demo.mp4',
  'Email automation workflow demonstration',
  'features',
  3,
  '{
    "duration": 15,
    "width": 800,
    "height": 600,
    "format": "mp4",
    "autoplay": false,
    "loop": false,
    "controls": true
  }'::jsonb
),
(
  'image',
  '/assets/features/template-gallery.png',
  'template-gallery.png',
  'Professional email template gallery',
  'features',
  4,
  '{
    "width": 800,
    "height": 600,
    "format": "png",
    "quality": 90,
    "responsive": true
  }'::jsonb
);

-- Pricing Section Assets
INSERT INTO media_assets (
  asset_type,
  file_path,
  file_name,
  alt_text,
  section,
  display_order,
  metadata
) VALUES 
(
  'icon',
  '/assets/pricing/check-icon.svg',
  'check-icon.svg',
  'Checkmark icon for pricing features',
  'pricing',
  1,
  '{
    "width": 24,
    "height": 24,
    "format": "svg",
    "color": "#10B981"
  }'::jsonb
),
(
  'icon',
  '/assets/pricing/star-icon.svg',
  'star-icon.svg',
  'Star icon for popular pricing plan',
  'pricing',
  2,
  '{
    "width": 24,
    "height": 24,
    "format": "svg",
    "color": "#F59E0B"
  }'::jsonb
),
(
  'animation',
  '/assets/pricing/pricing-animation.json',
  'pricing-animation.json',
  'Lottie animation for pricing section',
  'pricing',
  3,
  '{
    "format": "lottie",
    "duration": 3,
    "loop": true,
    "autoplay": true
  }'::jsonb
);

-- Footer Section Assets
INSERT INTO media_assets (
  asset_type,
  file_path,
  file_name,
  alt_text,
  section,
  display_order,
  metadata
) VALUES 
(
  'image',
  '/assets/footer/perbox-logo.svg',
  'perbox-logo.svg',
  'Perbox company logo',
  'footer',
  1,
  '{
    "width": 120,
    "height": 40,
    "format": "svg",
    "responsive": true
  }'::jsonb
),
(
  'icon',
  '/assets/footer/social-twitter.svg',
  'social-twitter.svg',
  'Twitter social media icon',
  'footer',
  2,
  '{
    "width": 24,
    "height": 24,
    "format": "svg"
  }'::jsonb
),
(
  'icon',
  '/assets/footer/social-linkedin.svg',
  'social-linkedin.svg',
  'LinkedIn social media icon',
  'footer',
  3,
  '{
    "width": 24,
    "height": 24,
    "format": "svg"
  }'::jsonb
);

-- Update all assets to be active and optimized for development
UPDATE media_assets 
SET is_active = true, is_optimized = true 
WHERE id IN (
  SELECT id FROM media_assets 
  WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
);