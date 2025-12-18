-- Create enum for access levels
CREATE TYPE public.access_level AS ENUM ('level_1', 'level_2', 'level_3');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  city TEXT,
  bio TEXT,
  avatar_url TEXT,
  passion_seriousness INTEGER CHECK (passion_seriousness >= 1 AND passion_seriousness <= 10),
  access_level public.access_level DEFAULT 'level_2',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create passions table
CREATE TABLE public.passions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_passions junction table
CREATE TABLE public.user_passions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  passion_id UUID REFERENCES public.passions(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, passion_id)
);

-- Create skills table
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_skills junction table
CREATE TABLE public.user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, skill_id)
);

-- Create creative_roles table
CREATE TABLE public.creative_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_creative_roles junction table
CREATE TABLE public.user_creative_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES public.creative_roles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Create questionnaire_responses table
CREATE TABLE public.questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  responses JSONB NOT NULL,
  total_score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_passions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_creative_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Passions policies (read-only for users)
CREATE POLICY "Anyone can view passions" ON public.passions FOR SELECT USING (true);

-- User passions policies
CREATE POLICY "Users can view own passions" ON public.user_passions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own passions" ON public.user_passions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own passions" ON public.user_passions FOR DELETE USING (auth.uid() = user_id);

-- Skills policies (read-only for users)
CREATE POLICY "Anyone can view skills" ON public.skills FOR SELECT USING (true);

-- User skills policies
CREATE POLICY "Users can view own skills" ON public.user_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skills" ON public.user_skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own skills" ON public.user_skills FOR DELETE USING (auth.uid() = user_id);

-- Creative roles policies (read-only for users)
CREATE POLICY "Anyone can view creative roles" ON public.creative_roles FOR SELECT USING (true);

-- User creative roles policies
CREATE POLICY "Users can view own creative roles" ON public.user_creative_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own creative roles" ON public.user_creative_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own creative roles" ON public.user_creative_roles FOR DELETE USING (auth.uid() = user_id);

-- Questionnaire policies
CREATE POLICY "Users can view own responses" ON public.questionnaire_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own responses" ON public.questionnaire_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert seed data for passions
INSERT INTO public.passions (name, category) VALUES
  ('Music Production', 'Music'),
  ('Singing', 'Music'),
  ('DJing', 'Music'),
  ('Songwriting', 'Music'),
  ('Photography', 'Visual'),
  ('Videography', 'Visual'),
  ('Graphic Design', 'Visual'),
  ('Illustration', 'Visual'),
  ('Animation', 'Visual'),
  ('Fashion Design', 'Fashion'),
  ('Styling', 'Fashion'),
  ('Dance', 'Performance'),
  ('Acting', 'Performance'),
  ('Poetry', 'Writing'),
  ('Content Creation', 'Digital'),
  ('3D Art', 'Digital'),
  ('Web Design', 'Digital'),
  ('Brand Design', 'Design'),
  ('Interior Design', 'Design'),
  ('Film Making', 'Film');

-- Insert seed data for skills
INSERT INTO public.skills (name, category) VALUES
  ('Adobe Photoshop', 'Software'),
  ('Adobe Premiere', 'Software'),
  ('Logic Pro', 'Software'),
  ('Ableton Live', 'Software'),
  ('Final Cut Pro', 'Software'),
  ('Figma', 'Software'),
  ('Blender', 'Software'),
  ('After Effects', 'Software'),
  ('Pro Tools', 'Software'),
  ('Lightroom', 'Software'),
  ('Social Media Marketing', 'Marketing'),
  ('Brand Strategy', 'Marketing'),
  ('Event Planning', 'Business'),
  ('Project Management', 'Business'),
  ('Community Building', 'Business'),
  ('Public Speaking', 'Communication'),
  ('Copywriting', 'Writing'),
  ('Mixing & Mastering', 'Audio'),
  ('Sound Design', 'Audio'),
  ('Color Grading', 'Video');

-- Insert seed data for creative roles
INSERT INTO public.creative_roles (name, category) VALUES
  ('Artist', 'Creator'),
  ('Producer', 'Creator'),
  ('Director', 'Creator'),
  ('Designer', 'Creator'),
  ('Photographer', 'Creator'),
  ('Videographer', 'Creator'),
  ('Writer', 'Creator'),
  ('DJ', 'Creator'),
  ('Vocalist', 'Creator'),
  ('Creative Director', 'Leadership'),
  ('Art Director', 'Leadership'),
  ('Brand Strategist', 'Strategy'),
  ('Content Creator', 'Digital'),
  ('Influencer', 'Digital'),
  ('Event Organizer', 'Business'),
  ('Manager', 'Business'),
  ('Curator', 'Business'),
  ('Mentor', 'Community'),
  ('Collaborator', 'Community'),
  ('Supporter', 'Community');

-- Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();