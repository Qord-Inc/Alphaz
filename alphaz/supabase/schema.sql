-- Create users table for storing user data from Clerk authentication
CREATE TABLE IF NOT EXISTS public.users (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Clerk user ID for linking with Clerk authentication
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- User information
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  google_id VARCHAR(255) UNIQUE, -- Only for Gmail users
  
  -- Authentication method
  auth_method VARCHAR(50) NOT NULL CHECK (auth_method IN ('gmail', 'email')),
  
  -- Subscription information
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'free', 'pro', 'enterprise')),
  trial_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  trial_end_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
  
  -- LinkedIn connection status
  linkedin_connected BOOLEAN DEFAULT FALSE,
  linkedin_profile_url VARCHAR(500),
  linkedin_profile_name VARCHAR(255),
  linkedin_profile_picture_url TEXT,
  linkedin_access_token TEXT, -- Should be encrypted in production
  linkedin_token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_clerk_user_id ON public.users(clerk_user_id);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_google_id ON public.users(google_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only read their own data
-- Note: For development, you might want to disable RLS or adjust policies
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid()::text = clerk_user_id);

-- Create policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role has full access" ON public.users
  USING (auth.jwt()->>'role' = 'service_role');

-- Create linkedin_company_pages table for storing user's company pages
CREATE TABLE IF NOT EXISTS public.linkedin_company_pages (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign key to users
  user_clerk_id VARCHAR(255) NOT NULL REFERENCES public.users(clerk_user_id) ON DELETE CASCADE,
  
  -- LinkedIn company information
  company_id VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  company_vanity_name VARCHAR(255),
  company_logo_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicate company pages per user
  UNIQUE(user_clerk_id, company_id)
);

-- Create indexes for company pages
CREATE INDEX idx_company_pages_user_clerk_id ON public.linkedin_company_pages(user_clerk_id);
CREATE INDEX idx_company_pages_company_id ON public.linkedin_company_pages(company_id);

-- Add LinkedIn user ID to users table if not exists
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS linkedin_user_id VARCHAR(255) UNIQUE;

-- Create trigger for updating company pages updated_at
CREATE TRIGGER update_company_pages_updated_at BEFORE UPDATE ON public.linkedin_company_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for company pages
ALTER TABLE public.linkedin_company_pages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own company pages
CREATE POLICY "Users can view own company pages" ON public.linkedin_company_pages
  FOR SELECT USING (user_clerk_id IN (
    SELECT clerk_user_id FROM public.users WHERE clerk_user_id = auth.uid()::text
  ));

-- Sample data insertion (commented out - for reference only)
-- INSERT INTO public.users (clerk_user_id, email, name, auth_method, google_id)
-- VALUES 
-- ('user_123456', 'john@example.com', 'John Doe', 'email', NULL),
-- ('user_789012', 'jane@gmail.com', 'Jane Smith', 'gmail', 'google_123456');