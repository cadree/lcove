-- Create events table for community events
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  venue TEXT,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT DEFAULT 'USA',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  image_url TEXT,
  ticket_type TEXT NOT NULL DEFAULT 'free', -- free, paid, credits, hybrid
  ticket_price NUMERIC DEFAULT 0,
  credits_price INTEGER DEFAULT 0,
  capacity INTEGER,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event RSVPs table
CREATE TABLE public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'going', -- going, interested, not_going
  ticket_purchased BOOLEAN DEFAULT false,
  stripe_payment_id TEXT,
  credits_spent INTEGER DEFAULT 0,
  reminder_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Create personal calendar items table
CREATE TABLE public.personal_calendar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#FF69B4', -- bubblegum pink default
  reminder_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create calendar reminders table
CREATE TABLE public.calendar_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  personal_item_id UUID REFERENCES public.personal_calendar_items(id) ON DELETE CASCADE,
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT reminder_has_source CHECK (
    (event_id IS NOT NULL)::int + 
    (project_id IS NOT NULL)::int + 
    (personal_item_id IS NOT NULL)::int = 1
  )
);

-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_reminders ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Anyone can view public events" ON public.events
  FOR SELECT USING (is_public = true OR creator_id = auth.uid());

CREATE POLICY "Authenticated users can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own events" ON public.events
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete own events" ON public.events
  FOR DELETE USING (auth.uid() = creator_id);

-- Event RSVPs policies
CREATE POLICY "Users can view RSVPs for public events" ON public.event_rsvps
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND (e.is_public = true OR e.creator_id = auth.uid()))
  );

CREATE POLICY "Users can RSVP to events" ON public.event_rsvps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVPs" ON public.event_rsvps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVPs" ON public.event_rsvps
  FOR DELETE USING (auth.uid() = user_id);

-- Personal calendar items policies
CREATE POLICY "Users can view own personal items" ON public.personal_calendar_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own personal items" ON public.personal_calendar_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personal items" ON public.personal_calendar_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own personal items" ON public.personal_calendar_items
  FOR DELETE USING (auth.uid() = user_id);

-- Calendar reminders policies
CREATE POLICY "Users can view own reminders" ON public.calendar_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reminders" ON public.calendar_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders" ON public.calendar_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_events_city ON public.events(city);
CREATE INDEX idx_events_start_date ON public.events(start_date);
CREATE INDEX idx_events_creator ON public.events(creator_id);
CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON public.event_rsvps(user_id);
CREATE INDEX idx_personal_items_user ON public.personal_calendar_items(user_id);
CREATE INDEX idx_personal_items_date ON public.personal_calendar_items(start_date);
CREATE INDEX idx_reminders_time ON public.calendar_reminders(reminder_time) WHERE sent = false;

-- Update timestamp triggers
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_rsvps_updated_at
  BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_personal_items_updated_at
  BEFORE UPDATE ON public.personal_calendar_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();