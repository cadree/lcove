import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Link as LinkIcon, StickyNote, Clock, Trash2, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEventMoodboard, useAddMoodboardItem, useDeleteMoodboardItem, uploadMoodboardImage } from "@/hooks/useEventMoodboard";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  eventId: string;
}

type ItemType = 'image' | 'link' | 'note' | 'itinerary';

export function EventMoodboardEditor({ eventId }: Props) {
  const { user } = useAuth();
  const { data: items = [] } = useEventMoodboard(eventId);
  const addItem = useAddMoodboardItem();
  const delItem = useDeleteMoodboardItem();

  const [activeType, setActiveType] = useState<ItemType>('image');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [startTime, setStartTime] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please pick an image');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadMoodboardImage(user.id, eventId, file);
      await addItem.mutateAsync({
        event_id: eventId,
        type: 'image',
        media_url: url,
        link_url: null,
        title: title || null,
        body: null,
        start_time: null,
        sort_order: items.length,
      });
      setTitle('');
      toast.success('Image added');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddText = async () => {
    if (activeType === 'link' && !linkUrl.trim()) {
      toast.error('Add a link URL');
      return;
    }
    if (activeType === 'note' && !body.trim()) {
      toast.error('Add note text');
      return;
    }
    if (activeType === 'itinerary' && (!title.trim() || !startTime)) {
      toast.error('Itinerary needs a title and time');
      return;
    }
    await addItem.mutateAsync({
      event_id: eventId,
      type: activeType,
      media_url: null,
      link_url: activeType === 'link' ? linkUrl.trim() : null,
      title: title.trim() || null,
      body: body.trim() || null,
      start_time: activeType === 'itinerary' && startTime ? new Date(startTime).toISOString() : null,
      sort_order: items.length,
    });
    setTitle('');
    setBody('');
    setLinkUrl('');
    setStartTime('');
    toast.success('Added');
  };

  const TypeBtn = ({ t, icon, label }: { t: ItemType; icon: React.ReactNode; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveType(t)}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
        activeType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border">
      <Label className="flex items-center gap-2 font-display">
        <ImageIcon className="h-4 w-4 text-primary" />
        Moodboard & Itinerary
      </Label>
      <p className="text-xs text-muted-foreground">
        Add images for the vibe and timed entries for the schedule.
      </p>

      <div className="grid grid-cols-4 gap-2">
        <TypeBtn t="image" icon={<ImageIcon className="h-4 w-4" />} label="Image" />
        <TypeBtn t="link" icon={<LinkIcon className="h-4 w-4" />} label="Link" />
        <TypeBtn t="note" icon={<StickyNote className="h-4 w-4" />} label="Note" />
        <TypeBtn t="itinerary" icon={<Clock className="h-4 w-4" />} label="Schedule" />
      </div>

      <div className="space-y-2">
        {activeType === 'image' && (
          <>
            <Input
              placeholder="Caption (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass"
            />
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">Tap to upload</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
          </>
        )}

        {activeType === 'link' && (
          <>
            <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} className="glass" />
            <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="glass" />
            <Button type="button" onClick={handleAddText} className="w-full" size="sm">
              Add Link
            </Button>
          </>
        )}

        {activeType === 'note' && (
          <>
            <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} className="glass" />
            <Textarea placeholder="Tell attendees what to expect..." value={body} onChange={(e) => setBody(e.target.value)} className="glass min-h-[70px]" />
            <Button type="button" onClick={handleAddText} className="w-full" size="sm">
              Add Note
            </Button>
          </>
        )}

        {activeType === 'itinerary' && (
          <>
            <Input placeholder="What's happening?" value={title} onChange={(e) => setTitle(e.target.value)} className="glass" />
            <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="glass" />
            <Textarea placeholder="Details (optional)" value={body} onChange={(e) => setBody(e.target.value)} className="glass min-h-[60px]" />
            <Button type="button" onClick={handleAddText} className="w-full" size="sm">
              Add to Schedule
            </Button>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Label className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</Label>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex gap-2 p-2 rounded bg-background/50 border border-border/50">
                {item.type === 'image' && item.media_url && (
                  <img src={item.media_url} alt="" className="w-12 h-12 rounded object-cover" />
                )}
                {item.type !== 'image' && (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                    {item.type === 'link' && <LinkIcon className="h-4 w-4 text-muted-foreground" />}
                    {item.type === 'note' && <StickyNote className="h-4 w-4 text-muted-foreground" />}
                    {item.type === 'itinerary' && <Clock className="h-4 w-4 text-primary" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {item.title && <p className="text-sm font-medium truncate">{item.title}</p>}
                  {item.start_time && (
                    <p className="text-xs text-primary">{format(new Date(item.start_time), 'MMM d · h:mm a')}</p>
                  )}
                  {item.body && <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>}
                  {item.link_url && <p className="text-xs text-muted-foreground truncate">{item.link_url}</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => delItem.mutate({ id: item.id, eventId: item.event_id })}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
