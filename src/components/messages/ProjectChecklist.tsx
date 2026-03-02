import { useState } from 'react';
import { Plus, Check, Hand, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectChecklist, useCreateChecklistItem, useClaimChecklistItem, useCompleteChecklistItem, useDeleteChecklistItem } from '@/hooks/useProjectChecklist';
import { useItemSuggestions, useSuggestItem, useReviewSuggestion, ItemSuggestion } from '@/hooks/useItemSuggestions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ProjectChecklistProps {
  projectId: string;
  isOwner: boolean;
}

const statusColors: Record<string, string> = {
  unclaimed: 'bg-muted text-muted-foreground',
  claimed: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
};

const ProjectChecklist = ({ projectId, isOwner }: ProjectChecklistProps) => {
  const { user } = useAuth();
  const { data: items = [] } = useProjectChecklist(projectId);
  const { data: suggestions = [] } = useItemSuggestions(projectId);
  const createItem = useCreateChecklistItem();
  const claimItem = useClaimChecklistItem();
  const completeItem = useCompleteChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const suggestItem = useSuggestItem();
  const reviewSuggestion = useReviewSuggestion();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('props');
  const [newNotes, setNewNotes] = useState('');

  const categories = ['props', 'equipment', 'other'] as const;
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  const handleAdd = () => {
    if (!newName.trim()) return;
    createItem.mutate({ project_id: projectId, category: newCategory, name: newName.trim(), notes: newNotes.trim() || undefined });
    setNewName('');
    setNewNotes('');
    setShowAddForm(false);
  };

  const handleSuggest = () => {
    if (!newName.trim()) return;
    suggestItem.mutate({ project_id: projectId, category: newCategory, name: newName.trim(), notes: newNotes.trim() || undefined });
    setNewName('');
    setNewNotes('');
    setShowSuggestForm(false);
  };

  return (
    <div className="space-y-3">
      {categories.map(cat => {
        const catItems = items.filter(i => i.category === cat);
        if (catItems.length === 0 && !isOwner) return null;

        return (
          <div key={cat}>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 capitalize">
              {cat}
            </h5>
            <div className="space-y-1.5">
              {catItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm group">
                  <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[item.status]}`}>
                    {item.status}
                  </Badge>
                  <span className="flex-1 truncate">{item.name}</span>

                  {item.assigned_profile && (
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={item.assigned_profile.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px] bg-muted">
                        {item.assigned_profile.display_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  {item.status === 'unclaimed' && user && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100"
                      onClick={() => claimItem.mutate({ itemId: item.id, projectId })}
                      title="Take responsibility"
                    >
                      <Hand className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {item.status === 'claimed' && item.assigned_user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 text-emerald-400"
                      onClick={() => completeItem.mutate({ itemId: item.id, projectId })}
                      title="Mark complete"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => deleteItem.mutate({ itemId: item.id, projectId })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              {catItems.length === 0 && <p className="text-xs text-muted-foreground italic">No items yet</p>}
            </div>
          </div>
        );
      })}

      {/* Owner: Add item */}
      {isOwner && !showAddForm && (
        <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => setShowAddForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
        </Button>
      )}

      {/* Member: Suggest item */}
      {!isOwner && !showSuggestForm && (
        <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => setShowSuggestForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Suggest Item
        </Button>
      )}

      {/* Add / Suggest form */}
      {(showAddForm || showSuggestForm) && (
        <div className="space-y-2 p-2 rounded-lg bg-muted/30 border border-border/50">
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="props">Props</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Item name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Notes (optional)"
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" className="text-xs flex-1" onClick={showAddForm ? handleAdd : handleSuggest}>
              {showAddForm ? 'Add' : 'Suggest'}
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setShowAddForm(false); setShowSuggestForm(false); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Owner: Pending suggestions */}
      {isOwner && pendingSuggestions.length > 0 && (
        <div className="mt-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
            Pending Suggestions ({pendingSuggestions.length})
          </h5>
          <div className="space-y-2">
            {pendingSuggestions.map(s => (
              <SuggestionRow key={s.id} suggestion={s} projectId={projectId} onReview={reviewSuggestion.mutate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SuggestionRow = ({ suggestion, projectId, onReview }: {
  suggestion: ItemSuggestion;
  projectId: string;
  onReview: (args: any) => void;
}) => (
  <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted/20">
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium truncate">{suggestion.name}</p>
      <p className="text-[10px] text-muted-foreground">
        by {suggestion.suggester_profile?.display_name || 'Member'} · {suggestion.category}
      </p>
    </div>
    <Button
      variant="ghost"
      size="icon"
      className="w-7 h-7 text-emerald-400"
      onClick={() => onReview({ suggestionId: suggestion.id, projectId, status: 'approved', suggestion })}
    >
      <ThumbsUp className="w-3.5 h-3.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      className="w-7 h-7 text-destructive"
      onClick={() => onReview({ suggestionId: suggestion.id, projectId, status: 'denied', suggestion })}
    >
      <ThumbsDown className="w-3.5 h-3.5" />
    </Button>
  </div>
);

export default ProjectChecklist;
