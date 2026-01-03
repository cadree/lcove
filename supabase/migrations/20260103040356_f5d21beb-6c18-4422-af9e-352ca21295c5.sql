-- User energy state table
CREATE TABLE public.user_energy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_energy INTEGER NOT NULL DEFAULT 100,
  max_energy INTEGER NOT NULL DEFAULT 100,
  last_regen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  streak_days INTEGER NOT NULL DEFAULT 0,
  streak_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Energy transactions/history for analytics
CREATE TABLE public.energy_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- 'earn' or 'spend'
  source TEXT NOT NULL, -- 'task_complete', 'project_milestone', 'collaboration', 'focus_session', 'regen', etc.
  source_id UUID, -- optional reference to the source entity
  description TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_energy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_energy
CREATE POLICY "Users can view own energy" ON public.user_energy
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own energy" ON public.user_energy
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own energy" ON public.user_energy
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for energy_transactions
CREATE POLICY "Users can view own transactions" ON public.energy_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.energy_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_energy_updated_at
  BEFORE UPDATE ON public.user_energy
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();