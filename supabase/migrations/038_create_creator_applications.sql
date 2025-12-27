-- Create creator_applications table for managing creator application requests
CREATE TABLE IF NOT EXISTS public.creator_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  portfolio_url TEXT NOT NULL,
  is_contributor_on_other_platform BOOLEAN DEFAULT false,
  other_platform_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejected_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- Um usuário só pode ter uma solicitação pendente/ativa
);

-- Create index for performance
CREATE INDEX idx_creator_applications_user_id ON public.creator_applications(user_id);
CREATE INDEX idx_creator_applications_status ON public.creator_applications(status);
CREATE INDEX idx_creator_applications_created_at ON public.creator_applications(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_creator_applications_updated_at 
  BEFORE UPDATE ON public.creator_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
  ON public.creator_applications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own applications
CREATE POLICY "Users can create own applications"
  ON public.creator_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
  ON public.creator_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins can update all applications
CREATE POLICY "Admins can update all applications"
  ON public.creator_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Function to automatically update user's is_creator status when approved
CREATE OR REPLACE FUNCTION handle_creator_application_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'approved', update the user's profile
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.profiles
    SET 
      is_creator = true,
      role = 'creator',
      updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle approval
CREATE TRIGGER on_creator_application_approved
  AFTER UPDATE OF status ON public.creator_applications
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION handle_creator_application_approval();


