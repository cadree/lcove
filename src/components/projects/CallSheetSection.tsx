import React, { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Clock, MapPin, FileText, ChevronDown, ChevronUp, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCallSheets, RoleEntry, CallSheet } from '@/hooks/useCallSheets';
import { ProjectRole } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';

interface CallSheetSectionProps {
  projectId: string;
  roles: ProjectRole[];
  isOwner: boolean;
}

export const CallSheetSection: React.FC<CallSheetSectionProps> = ({ projectId, roles, isOwner }) => {
  const { callSheets, createCallSheet, updateCallSheet, deleteCallSheet } = useCallSheets(projectId);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [shootDate, setShootDate] = useState('');
  const [generalLocation, setGeneralLocation] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [roleEntries, setRoleEntries] = useState<RoleEntry[]>([]);

  const initRoleEntries = () => {
    return roles.map(r => ({
      role_name: r.role_name,
      call_time: '',
      location: '',
      wrap_time: '',
      notes: '',
    }));
  };

  const startCreate = () => {
    setRoleEntries(initRoleEntries());
    setShootDate('');
    setGeneralLocation('');
    setGeneralNotes('');
    setCreating(true);
    setEditingId(null);
  };

  const startEdit = (cs: CallSheet) => {
    setShootDate(cs.shoot_date);
    setGeneralLocation(cs.general_location || '');
    setGeneralNotes(cs.general_notes || '');
    // Merge existing entries with current roles
    const entries = roles.map(r => {
      const existing = cs.role_entries.find(e => e.role_name === r.role_name);
      return existing || { role_name: r.role_name, call_time: '', location: '', wrap_time: '', notes: '' };
    });
    // Also include entries for roles no longer in the project
    cs.role_entries.forEach(e => {
      if (!entries.find(x => x.role_name === e.role_name)) {
        entries.push(e);
      }
    });
    setRoleEntries(entries);
    setEditingId(cs.id);
    setCreating(false);
    setExpandedId(cs.id);
  };

  const updateEntry = (i: number, field: keyof RoleEntry, value: string) => {
    const updated = [...roleEntries];
    updated[i] = { ...updated[i], [field]: value };
    setRoleEntries(updated);
  };

  const addCustomEntry = () => {
    setRoleEntries([...roleEntries, { role_name: '', call_time: '', location: '', wrap_time: '', notes: '' }]);
  };

  const removeEntry = (i: number) => {
    setRoleEntries(roleEntries.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    if (!shootDate) return;
    const filtered = roleEntries.filter(e => e.role_name.trim());
    if (editingId) {
      updateCallSheet.mutate({
        id: editingId,
        shoot_date: shootDate,
        general_location: generalLocation || null,
        general_notes: generalNotes || null,
        role_entries: filtered,
      } as any, {
        onSuccess: () => { setEditingId(null); },
      });
    } else {
      createCallSheet.mutate({
        project_id: projectId,
        shoot_date: shootDate,
        general_location: generalLocation || undefined,
        general_notes: generalNotes || undefined,
        role_entries: filtered,
      }, {
        onSuccess: () => { setCreating(false); },
      });
    }
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
  };

  const isEditing = creating || editingId !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" /> Call Sheets
        </h4>
        {isOwner && !isEditing && (
          <Button variant="ghost" size="sm" onClick={startCreate} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" /> New
          </Button>
        )}
      </div>

      {/* Existing call sheets */}
      {callSheets.map(cs => (
        <div key={cs.id} className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === cs.id ? null : cs.id)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {format(new Date(cs.shoot_date + 'T00:00:00'), 'MMM d, yyyy')}
              </Badge>
              {cs.general_location && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {cs.general_location}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isOwner && editingId !== cs.id && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); startEdit(cs); }}>
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
              {expandedId === cs.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          {expandedId === cs.id && editingId !== cs.id && (
            <div className="px-3 pb-3 space-y-2">
              {cs.general_notes && (
                <p className="text-xs text-muted-foreground bg-muted/20 rounded p-2">{cs.general_notes}</p>
              )}
              <div className="space-y-1.5">
                {cs.role_entries.map((entry, i) => (
                  <div key={i} className="bg-muted/10 rounded-lg p-2.5 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">{entry.role_name}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {entry.call_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {entry.call_time}
                          </span>
                        )}
                        {entry.wrap_time && <span>→ {entry.wrap_time}</span>}
                      </div>
                    </div>
                    {entry.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {entry.location}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={() => deleteCallSheet.mutate(cs.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              )}
            </div>
          )}

          {/* Inline edit form */}
          {editingId === cs.id && (
            <div className="px-3 pb-3">
              <CallSheetForm
                shootDate={shootDate}
                setShootDate={setShootDate}
                generalLocation={generalLocation}
                setGeneralLocation={setGeneralLocation}
                generalNotes={generalNotes}
                setGeneralNotes={setGeneralNotes}
                roleEntries={roleEntries}
                updateEntry={updateEntry}
                addCustomEntry={addCustomEntry}
                removeEntry={removeEntry}
                onSave={handleSave}
                onCancel={cancel}
                isPending={updateCallSheet.isPending}
              />
              />
            </div>
          )}
        </div>
      ))}

      {/* Create form */}
      {creating && (
        <div className="border border-primary/30 rounded-lg p-3">
          <CallSheetForm
            shootDate={shootDate}
            setShootDate={setShootDate}
            generalLocation={generalLocation}
            setGeneralLocation={setGeneralLocation}
            generalNotes={generalNotes}
            setGeneralNotes={setGeneralNotes}
            roleEntries={roleEntries}
            updateEntry={updateEntry}
            addCustomEntry={addCustomEntry}
            removeEntry={removeEntry}
            onSave={handleSave}
            onCancel={cancel}
            isPending={createCallSheet.isPending}
            />
          />
        </div>
      )}

      {callSheets.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground text-center py-4">No call sheets yet</p>
      )}
    </div>
  );
};

/* ─── Form Sub-component ───────────────────────── */

interface CallSheetFormProps {
  shootDate: string;
  setShootDate: (v: string) => void;
  generalLocation: string;
  setGeneralLocation: (v: string) => void;
  generalNotes: string;
  setGeneralNotes: (v: string) => void;
  roleEntries: RoleEntry[];
  updateEntry: (i: number, field: keyof RoleEntry, value: string) => void;
  addCustomEntry: () => void;
  removeEntry: (i: number) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

const CallSheetForm: React.FC<CallSheetFormProps> = ({
  shootDate, setShootDate,
  generalLocation, setGeneralLocation,
  generalNotes, setGeneralNotes,
  roleEntries, updateEntry, addCustomEntry, removeEntry,
  onSave, onCancel, isPending,
}) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label className="text-xs">Shoot Date *</Label>
        <Input type="date" value={shootDate} onChange={e => setShootDate(e.target.value)} className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-xs">General Location</Label>
        <Input value={generalLocation} onChange={e => setGeneralLocation(e.target.value)} placeholder="Studio A" className="h-8 text-xs" />
      </div>
    </div>
    <div>
      <Label className="text-xs">General Notes</Label>
      <Textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} placeholder="Weather, parking, catering info..." rows={2} className="text-xs" />
    </div>

    <div className="space-y-2">
      <Label className="text-xs font-medium">Per-Role Details</Label>
      {roleEntries.map((entry, i) => (
        <div key={i} className="bg-muted/20 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <Input
              value={entry.role_name}
              onChange={e => updateEntry(i, 'role_name', e.target.value)}
              placeholder="Role name"
              className="h-7 text-xs w-40"
            />
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeEntry(i)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Call Time</Label>
              <Input type="time" value={entry.call_time} onChange={e => updateEntry(i, 'call_time', e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Wrap Time</Label>
              <Input type="time" value={entry.wrap_time} onChange={e => updateEntry(i, 'wrap_time', e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Location</Label>
            <Input value={entry.location} onChange={e => updateEntry(i, 'location', e.target.value)} placeholder="Specific location for this role" className="h-7 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Notes</Label>
            <Input value={entry.notes} onChange={e => updateEntry(i, 'notes', e.target.value)} placeholder="Wardrobe, bring items, etc." className="h-7 text-xs" />
          </div>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={addCustomEntry} className="text-xs gap-1 w-full">
        <Plus className="h-3 w-3" /> Add Role Entry
      </Button>
    </div>

    <div className="flex gap-2">
      <Button size="sm" onClick={onSave} disabled={isPending || !shootDate} className="flex-1 text-xs gap-1">
        <Save className="h-3 w-3" /> {isPending ? 'Saving...' : 'Save'}
      </Button>
      <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">Cancel</Button>
    </div>
  </div>
);
