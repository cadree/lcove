import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Calendar, Download, FileText, Users, MapPin, Wrench, Package, BarChart3, Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddToCalendarButtons } from '@/components/calendar/AddToCalendarButtons';
import { generateProjectPdf } from '@/lib/generateProjectPdf';
import { cn } from '@/lib/utils';

export default function PublicClientPortal() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-portal', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_client_project_by_token', { p_token: token! });
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold">Link Expired or Invalid</h1>
          <p className="text-muted-foreground">This client portal link is no longer valid.</p>
        </div>
      </div>
    );
  }

  const project = data.project;
  const creator = data.creator;
  const roles = data.roles || [];
  const milestones = data.milestones || [];
  const callSheets = data.call_sheets || [];
  const attachments = data.attachments || [];
  const deliverables = (project.deliverables as any[])?.filter((d: any) => d?.type) || [];
  const filledRoles = roles.filter((r: any) => r.slots_filled > 0);

  const calendarEvent = project.timeline_start ? {
    title: project.title,
    description: project.description,
    startDate: new Date(project.timeline_start),
    endDate: project.timeline_end ? new Date(project.timeline_end) : null,
    location: project.venue,
  } : null;

  const handleDownloadPdf = () => generateProjectPdf(data);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {data.client_name && (
            <p className="text-sm text-muted-foreground mb-1">Welcome, {data.client_name}</p>
          )}
          <h1 className="text-2xl font-bold">{project.title}</h1>
          {creator?.display_name && (
            <p className="text-sm text-muted-foreground mt-1">by {creator.display_name}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {calendarEvent && (
              <AddToCalendarButtons event={calendarEvent} variant="compact" />
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Content - reuse ClientDashboardView layout */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Progress */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Project Progress
            </span>
            <span className="text-lg font-bold text-primary">{project.progress_percent}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all" style={{ width: `${project.progress_percent}%` }} />
          </div>
        </div>

        {project.description && (
          <div>
            <h4 className="text-sm font-medium mb-2">About This Project</h4>
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </div>
        )}

        {(project.timeline_start || project.timeline_end) && (
          <div className="flex items-center gap-4 text-sm bg-muted/20 rounded-lg p-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="font-medium">Timeline: </span>
              {project.timeline_start && format(new Date(project.timeline_start), 'MMM d, yyyy')}
              {project.timeline_start && project.timeline_end && ' → '}
              {project.timeline_end && format(new Date(project.timeline_end), 'MMM d, yyyy')}
            </div>
          </div>
        )}

        {filledRoles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" /> Confirmed Team</h4>
            {filledRoles.map((role: any) => (
              <div key={role.id} className="flex items-center justify-between bg-muted/20 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-medium">{role.role_name}</span>
                </div>
                <span className="text-muted-foreground">{role.slots_filled}/{role.slots_available} filled</span>
              </div>
            ))}
          </div>
        )}

        {(project.equipment_needed || project.venue || project.props_needed) && (
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2"><Wrench className="h-4 w-4" /> Resources & Logistics</h4>
            {project.equipment_needed && <div className="text-sm"><span className="text-muted-foreground">Supplies: </span>{project.equipment_needed}</div>}
            {project.venue && (
              <div className="text-sm flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {project.venue}
                {project.location_secured && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 ml-1">Secured</Badge>}
              </div>
            )}
            {project.props_needed && <div className="text-sm"><span className="text-muted-foreground">Props: </span>{project.props_needed}</div>}
          </div>
        )}

        {milestones.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Milestones</h4>
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-border" />
              {milestones.map((ms: any) => (
                <div key={ms.id} className="relative">
                  <div className={cn(
                    "absolute -left-4 top-1 w-3 h-3 rounded-full border-2",
                    ms.status === 'approved' || ms.status === 'paid' ? "bg-emerald-500 border-emerald-500" :
                    ms.status === 'in_progress' || ms.status === 'submitted' ? "bg-amber-500 border-amber-500" :
                    "bg-background border-muted-foreground"
                  )} />
                  <div>
                    <p className="text-sm font-medium">{ms.title}</p>
                    <div className="flex items-center gap-2">
                      {ms.due_date && <span className="text-xs text-muted-foreground">{format(new Date(ms.due_date), 'MMM d')}</span>}
                      <Badge className={cn('text-[10px]',
                        ms.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                        ms.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-muted text-muted-foreground'
                      )}>{ms.status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {callSheets.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Call Sheets</h4>
            {callSheets.map((cs: any) => (
              <div key={cs.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{format(new Date(cs.shoot_date + 'T00:00:00'), 'MMM d, yyyy')}</Badge>
                  {cs.general_location && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {cs.general_location}</span>}
                </div>
                {cs.general_notes && <p className="text-xs text-muted-foreground bg-muted/20 rounded p-2">{cs.general_notes}</p>}
                <div className="space-y-1.5">
                  {(cs.role_entries || []).map((entry: any, i: number) => (
                    <div key={i} className="bg-muted/10 rounded-lg p-2.5 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{entry.role_name}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {entry.call_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {entry.call_time}</span>}
                          {entry.wrap_time && <span>→ {entry.wrap_time}</span>}
                        </div>
                      </div>
                      {entry.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {entry.location}</p>}
                      {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {deliverables.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4" /> Deliverables</h4>
            {deliverables.map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg p-3 text-sm">
                <span className="font-medium">{d.type}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {d.publish_date && <span>{format(new Date(d.publish_date), 'MMM d')}</span>}
                  {d.publish_location && <span>• {d.publish_location}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Files</h4>
            {attachments.map((att: any) => (
              <div key={att.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">{att.file_type.toUpperCase()}</Badge>
                  <span className="text-sm truncate">{att.file_name}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => window.open(att.file_url, '_blank', 'noopener')}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-6 pb-8">
          <p className="text-xs text-muted-foreground">Powered by ETHER</p>
        </div>
      </div>
    </div>
  );
}
