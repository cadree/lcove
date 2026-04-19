import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSubmitEntry } from '@/hooks/useChallengeParticipation';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  challengeId: string;
}

export function SubmitEntryDialog({ open, onOpenChange, challengeId }: Props) {
  const submit = useSubmitEntry();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');
      const ext = file.name.split('.').pop();
      const path = `${u.user.id}/challenge-submissions/${challengeId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      setUrl(data.publicUrl);
      toast.success('File uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    if (!url.trim() && !text.trim()) {
      toast.error('Add a link/file or write a note');
      return;
    }
    await submit.mutateAsync({ challengeId, submission_url: url || null, submission_text: text || null });
    onOpenChange(false);
    setUrl(''); setText('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Submit your entry</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Upload file</Label>
            <input ref={fileRef} type="file" onChange={onUpload} className="hidden" accept="image/*,video/*,audio/*,.pdf" />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? 'Uploading...' : 'Choose file'}
            </Button>
          </div>
          <div>
            <Label>Or paste a link</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Tell us about your entry" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={submit.isPending}>
            {submit.isPending ? 'Submitting...' : 'Submit entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
