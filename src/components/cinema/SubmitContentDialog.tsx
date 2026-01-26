import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, X, Image, Film, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface SubmitContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networkId: string;
  networkName: string;
}

export const SubmitContentDialog = ({
  open,
  onOpenChange,
  networkId,
  networkName,
}: SubmitContentDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<'short_film' | 'feature_film' | 'tv_show'>('short_film');
  const [director, setDirector] = useState('');
  const [castMembers, setCastMembers] = useState('');
  const [runtimeMinutes, setRuntimeMinutes] = useState('');
  const [pitchNotes, setPitchNotes] = useState('');
  const [coverArtUrl, setCoverArtUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [moodboardImages, setMoodboardImages] = useState<string[]>([]);
  const [newMoodboardUrl, setNewMoodboardUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingMoodboard, setUploadingMoodboard] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setContentType('short_film');
    setDirector('');
    setCastMembers('');
    setRuntimeMinutes('');
    setPitchNotes('');
    setCoverArtUrl('');
    setTrailerUrl('');
    setVideoUrl('');
    setExternalVideoUrl('');
    setMoodboardImages([]);
    setNewMoodboardUrl('');
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-submission-cover.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      setCoverArtUrl(urlData.publicUrl);
    } catch (error: any) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingCover(false);
    }
  };

  const addMoodboardImage = () => {
    if (newMoodboardUrl.trim() && moodboardImages.length < 6) {
      setMoodboardImages([...moodboardImages, newMoodboardUrl.trim()]);
      setNewMoodboardUrl('');
    }
  };

  const handleUploadMoodboard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || moodboardImages.length >= 6) return;

    setUploadingMoodboard(true);
    try {
      const newImages: string[] = [];
      const filesToUpload = Array.from(files).slice(0, 6 - moodboardImages.length);

      for (const file of filesToUpload) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-moodboard-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        newImages.push(urlData.publicUrl);
      }

      setMoodboardImages([...moodboardImages, ...newImages]);
    } catch (error: any) {
      toast.error('Failed to upload moodboard images');
    } finally {
      setUploadingMoodboard(false);
    }
  };

  const removeMoodboardImage = (index: number) => {
    setMoodboardImages(moodboardImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to submit content');
      return;
    }

    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }

    if (!pitchNotes.trim()) {
      toast.error('Please include a pitch explaining why your content fits this network');
      return;
    }

    setSubmitting(true);

    try {
      // Get user's profile for the submitter name - user's own profile so we can use profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const submitterName = profile?.display_name || 'A creator';

      const { error } = await supabase
        .from('content_submissions')
        .insert({
          network_id: networkId,
          submitter_id: user.id,
          title: title.trim(),
          description: description.trim(),
          content_type: contentType,
          director: director.trim() || null,
          cast_members: castMembers ? castMembers.split(',').map(s => s.trim()) : null,
          runtime_minutes: runtimeMinutes ? parseInt(runtimeMinutes) : null,
          pitch_notes: pitchNotes.trim(),
          cover_art_url: coverArtUrl || null,
          trailer_url: trailerUrl.trim() || null,
          video_url: videoUrl.trim() || null,
          external_video_url: externalVideoUrl.trim() || null,
          credits: { moodboard: moodboardImages },
          status: 'pending',
        });

      if (error) throw error;

      // Notify the network owner via edge function
      supabase.functions.invoke('notify-content-submission', {
        body: {
          network_id: networkId,
          network_name: networkName,
          submission_title: title.trim(),
          submitter_name: submitterName,
          content_type: contentType,
        },
      }).catch((err) => {
        console.error('Error sending submission notification:', err);
      });

      toast.success('Content submitted successfully! The network owner will review your submission.');
      queryClient.invalidateQueries({ queryKey: ['content-submissions', networkId] });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit content');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Submit Content to {networkName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter your content title"
              />
            </div>

            <div className="space-y-2">
              <Label>Content Type *</Label>
              <Select value={contentType} onValueChange={(v: any) => setContentType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_film">Short Film</SelectItem>
                  <SelectItem value="feature_film">Feature Film</SelectItem>
                  <SelectItem value="tv_show">TV Show</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="runtime">Runtime (minutes)</Label>
              <Input
                id="runtime"
                type="number"
                value={runtimeMinutes}
                onChange={(e) => setRuntimeMinutes(e.target.value)}
                placeholder="e.g., 90"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your content..."
              rows={3}
            />
          </div>

          {/* Crew */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="director">Director</Label>
              <Input
                id="director"
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                placeholder="Director name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cast">Cast Members</Label>
              <Input
                id="cast"
                value={castMembers}
                onChange={(e) => setCastMembers(e.target.value)}
                placeholder="Comma separated names"
              />
            </div>
          </div>

          {/* Cover Art */}
          <div className="space-y-2">
            <Label>Cover Art</Label>
            <div className="flex gap-4 items-start">
              {coverArtUrl ? (
                <div className="relative w-24 h-36 rounded-lg overflow-hidden">
                  <img src={coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => setCoverArtUrl('')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="w-24 h-36 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                  {uploadingCover ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Upload</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadCover}
                  />
                </label>
              )}
              <div className="flex-1">
                <Input
                  placeholder="Or paste image URL"
                  value={coverArtUrl}
                  onChange={(e) => setCoverArtUrl(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Video URLs */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trailerUrl">Trailer URL</Label>
              <Input
                id="trailerUrl"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                placeholder="https://youtube.com/... or direct video URL"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoUrl">Full Video URL</Label>
              <Input
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Direct video file URL"
              />
              <p className="text-xs text-muted-foreground">
                Direct link to your video file (MP4, WebM, etc.)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalVideoUrl">External Video URL</Label>
              <Input
                id="externalVideoUrl"
                value={externalVideoUrl}
                onChange={(e) => setExternalVideoUrl(e.target.value)}
                placeholder="YouTube, Vimeo, or other streaming link"
              />
            </div>
          </div>

          {/* Moodboard */}
          <div className="space-y-3">
            <Label>Moodboard Images (up to 6)</Label>
            <p className="text-sm text-muted-foreground">
              Add images that capture the visual style and tone of your project
            </p>
            
            <div className="grid grid-cols-3 gap-2">
              {moodboardImages.map((url, index) => (
                <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img src={url} alt={`Moodboard ${index + 1}`} className="w-full h-full object-cover" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => removeMoodboardImage(index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {moodboardImages.length < 6 && (
                <label className="aspect-video border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                  {uploadingMoodboard ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Upload</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleUploadMoodboard}
                    disabled={uploadingMoodboard}
                  />
                </label>
              )}
            </div>

            {moodboardImages.length < 6 && (
              <div className="flex gap-2">
                <Input
                  placeholder="Or paste image URL"
                  value={newMoodboardUrl}
                  onChange={(e) => setNewMoodboardUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMoodboardImage()}
                />
                <Button variant="outline" onClick={addMoodboardImage} disabled={!newMoodboardUrl.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Pitch Notes */}
          <div className="space-y-2">
            <Label htmlFor="pitch">Pitch Notes *</Label>
            <Textarea
              id="pitch"
              value={pitchNotes}
              onChange={(e) => setPitchNotes(e.target.value)}
              placeholder="Explain why your content would be a great fit for this network. What makes it unique? What audience would it appeal to?"
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit for Review'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
