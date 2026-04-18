import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProjectState } from '@/lib/types';
import { getTotalWallLength } from '@/lib/wallCalculations';

const STORAGE_KEY = 'se_submission_id';

/**
 * Debounced auto-save of the public planner project to the submissions table.
 * Creates a row once an address is set, then upserts on change.
 */
export const useAutoSaveSubmission = (project: ProjectState) => {
  const idRef = useRef<string | null>(localStorage.getItem(STORAGE_KEY));
  const timer = useRef<number | null>(null);
  const lastStep = useRef<number>(project.currentStep);

  useEffect(() => {
    // Only persist once we have an address (avoids empty leads)
    if (!project.details.address || !project.details.lat) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const totalLen = getTotalWallLength(project.walls);
      const maxH = project.walls.reduce((m, w) => Math.max(m, w.maxHeight || 0), 0);

      const payload = {
        client_name: project.details.clientName || null,
        client_email: project.details.clientEmail || null,
        client_phone: project.details.clientPhone || null,
        company_name: project.details.companyName || null,
        is_builder: project.details.isBuilder,
        address: project.details.address,
        suburb: project.details.suburb || null,
        state: project.details.state || null,
        postcode: project.details.postcode || null,
        lat: project.details.lat,
        lng: project.details.lng,
        wall_count: project.walls.length,
        total_length: Number(totalLen.toFixed(2)),
        max_height: maxH,
        current_step: project.currentStep,
        project_data: project as any,
        last_activity_at: new Date().toISOString(),
      };

      try {
        if (!idRef.current) {
          const { data, error } = await supabase.from('submissions').insert(payload).select('id').single();
          if (error) throw error;
          if (data?.id) {
            idRef.current = data.id;
            localStorage.setItem(STORAGE_KEY, data.id);
            await supabase.from('submission_activity').insert({
              submission_id: data.id, event_type: 'created',
              details: { address: project.details.address },
            });
          }
        } else {
          const { error } = await supabase.from('submissions').update(payload).eq('id', idRef.current);
          if (error) throw error;
          if (lastStep.current !== project.currentStep) {
            await supabase.from('submission_activity').insert({
              submission_id: idRef.current, event_type: 'step_advanced',
              details: { from: lastStep.current, to: project.currentStep },
            });
            lastStep.current = project.currentStep;
          }
        }
      } catch (e) {
        console.warn('Auto-save failed', e);
      }
    }, 1500);

    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [project]);
};
