-- Add is_official column to resources
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;

