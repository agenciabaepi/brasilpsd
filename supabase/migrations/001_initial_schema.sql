-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- User roles enum
CREATE TYPE user_role AS ENUM ('user', 'creator', 'admin');

-- Resource types enum
CREATE TYPE resource_type AS ENUM ('image', 'video', 'font', 'psd', 'ai', 'audio', 'other');

-- Resource status enum
CREATE TYPE resource_status AS ENUM ('pending', 'approved', 'rejected');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'user' NOT NULL,
  is_creator BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table
CREATE TABLE public.tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resources table
CREATE TABLE public.resources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  resource_type resource_type NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status resource_status DEFAULT 'pending' NOT NULL,
  
  -- File information
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  preview_url TEXT,
  file_size BIGINT NOT NULL,
  file_format TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- for videos/audio in seconds
  
  -- Metadata
  keywords TEXT[],
  color_palette TEXT[],
  is_premium BOOLEAN DEFAULT false,
  price DECIMAL(10, 2),
  
  -- Statistics
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  
  -- Moderation
  rejected_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resource tags junction table
CREATE TABLE public.resource_tags (
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

-- Downloads table
CREATE TABLE public.downloads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorites table
CREATE TABLE public.favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);

-- Creator earnings table (for future commission system)
CREATE TABLE public.creator_earnings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE NOT NULL,
  download_id UUID REFERENCES public.downloads(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_resources_status ON public.resources(status);
CREATE INDEX idx_resources_type ON public.resources(resource_type);
CREATE INDEX idx_resources_category ON public.resources(category_id);
CREATE INDEX idx_resources_creator ON public.resources(creator_id);
CREATE INDEX idx_resources_created_at ON public.resources(created_at DESC);
CREATE INDEX idx_resources_download_count ON public.resources(download_count DESC);
CREATE INDEX idx_resources_keywords ON public.resources USING GIN(keywords);
CREATE INDEX idx_resources_title_search ON public.resources USING GIN(to_tsvector('english', title));
CREATE INDEX idx_downloads_user ON public.downloads(user_id);
CREATE INDEX idx_downloads_resource ON public.downloads(resource_id);
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_resource_tags_resource ON public.resource_tags(resource_id);
CREATE INDEX idx_resource_tags_tag ON public.resource_tags(tag_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Resources policies
CREATE POLICY "Anyone can view approved resources"
  ON public.resources FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Creators can view own resources"
  ON public.resources FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins can view all resources"
  ON public.resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Creators can insert resources"
  ON public.resources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_creator = true OR is_admin = true)
    )
  );

CREATE POLICY "Creators can update own resources"
  ON public.resources FOR UPDATE
  USING (auth.uid() = creator_id AND status = 'pending');

CREATE POLICY "Admins can update any resource"
  ON public.resources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Downloads policies
CREATE POLICY "Users can view own downloads"
  ON public.downloads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create downloads"
  ON public.downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Favorites policies
CREATE POLICY "Users can manage own favorites"
  ON public.favorites FOR ALL
  USING (auth.uid() = user_id);

-- Categories and tags are public
CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view tags"
  ON public.tags FOR SELECT
  USING (true);

