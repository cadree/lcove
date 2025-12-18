-- Add advanced profile customization fields
ALTER TABLE public.profile_customizations
ADD COLUMN IF NOT EXISTS theme_preset text DEFAULT 'clean_modern',
ADD COLUMN IF NOT EXISTS background_opacity numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS background_blur numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS overlay_tint text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS overlay_opacity numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS effect_grain boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS effect_neon_glow boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS effect_scanlines boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_font text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS accent_color_override text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS section_order text[] DEFAULT ARRAY['about', 'music', 'stats', 'links'],
ADD COLUMN IF NOT EXISTS show_top_friends boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS effect_holographic boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS effect_motion_gradient boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS music_visualizer_enabled boolean DEFAULT false;