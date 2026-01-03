-- Update default energy to start at 0 instead of 100
ALTER TABLE public.user_energy ALTER COLUMN current_energy SET DEFAULT 0;

-- Reset existing users to 0 energy for fresh start
UPDATE public.user_energy SET current_energy = 0 WHERE current_energy = 100;