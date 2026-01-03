import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEnergy, ENERGY_GAINS } from '@/hooks/useEnergy';

/**
 * Hook to award energy when user gets accepted to a project.
 * Tracks which acceptances have already awarded energy to prevent duplicates.
 */
export function useProjectJoinEnergy() {
  const { user } = useAuth();
  const { earnEnergy, energy } = useEnergy();
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id || !energy) return;

    const checkAcceptedApplications = async () => {
      // Get all accepted applications for the user
      const { data: acceptedApps, error } = await supabase
        .from('project_applications')
        .select('id, project_id, reviewed_at')
        .eq('applicant_id', user.id)
        .eq('status', 'accepted');

      if (error || !acceptedApps) return;

      // Check if we've already awarded energy for each acceptance
      for (const app of acceptedApps) {
        if (processedRef.current.has(app.id)) continue;

        // Check if energy was already awarded for this application
        const { data: existingTx } = await supabase
          .from('energy_transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('source', 'project_join')
          .eq('source_id', app.id)
          .maybeSingle();

        if (existingTx) {
          // Already awarded, mark as processed
          processedRef.current.add(app.id);
          continue;
        }

        // Award energy for joining the project
        try {
          await earnEnergy({
            amount: ENERGY_GAINS.project_join,
            source: 'project_join',
            sourceId: app.id,
            description: 'Accepted to a project!',
          });
          processedRef.current.add(app.id);
        } catch (err) {
          console.error('Failed to award energy for project join:', err);
        }
      }
    };

    checkAcceptedApplications();
  }, [user?.id, energy?.id, earnEnergy]);
}
