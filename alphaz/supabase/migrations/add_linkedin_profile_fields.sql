-- Add LinkedIn profile fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS linkedin_profile_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS linkedin_profile_picture_url TEXT;

-- Update the existing LinkedIn user ID column if needed
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS linkedin_user_id VARCHAR(255) UNIQUE;