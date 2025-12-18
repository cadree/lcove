import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddContent, useContentGenres } from '@/hooks/useCinema';
import { Film, Upload, Link as LinkIcon, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networkId: string;
}

export const AddContentDialog = ({ open, onOpenChange, networkId }: AddContentDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<'short_film' | 'feature_film' | 'tv_show'>('short_film');
  const [director, setDirector] = useState('');
  const [runtimeMinutes, setRuntimeMinutes] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [useExternalUrl, setUseExternalUrl] = useState(false);
  const [genreTags, setGenreTags] = useState<string[]>([]);
  const [castMembers, setCastMembers] = useState<string[]>([]);
  const [newCastMember, setNewCastMember] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: genres = [] } = useContentGenres();
  const addContent = useAddContent();

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('media')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleAddCastMember = () => {
    if (newCastMember.trim() && !castMembers.includes(newCastMember.trim())) {
      setCastMembers([...castMembers, newCastMember.trim()]);
      setNewCastMember('');
    }
  };

  const handleRemoveCastMember = (member: string) => {
    setCastMembers(castMembers.filter((m) => m !== member));
  };

  const toggleGenre = (genre: string) => {
    if (genreTags.includes(genre)) {
      setGenreTags(genreTags.filter((g) => g !== genre));
    } else if (genreTags.length < 3) {
      setGenreTags([...genreTags, genre]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setUploading(true);

    try {
      let coverArtUrl = null;
      let uploadedVideoUrl = null;

      if (coverFile) {
        coverArtUrl = await uploadFile(coverFile, 'content-covers');
      }

      if (!useExternalUrl && videoFile) {
        uploadedVideoUrl = await uploadFile(videoFile, 'content-videos');
      }

      await addContent.mutateAsync({
        network_id: networkId,
        title: title.trim(),
        description: description.trim() || null,
        content_type: contentType,
        director: director.trim() || null,
        runtime_minutes: runtimeMinutes ? parseInt(runtimeMinutes) : null,
        release_date: releaseDate || null,
        cover_art_url: coverArtUrl,
        video_url: uploadedVideoUrl,
        external_video_url: useExternalUrl ? externalVideoUrl.trim() : null,
        genre_tags: genreTags.length > 0 ? genreTags : null,
        cast_members: castMembers.length > 0 ? castMembers : null,
        is_featured: isFeatured,
        is_published: true,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setContentType('short_film');
      setDirector('');
      setRuntimeMinutes('');
      setReleaseDate('');
      setVideoUrl('');
      setExternalVideoUrl('');
      setUseExternalUrl(false);
      setGenreTags([]);
      setCastMembers([]);
      setIsFeatured(false);
      setCoverFile(null);
      setVideoFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add content:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Add Content
          </DialogTitle>
          <DialogDescription>
            Upload a film, show, or movie to your network
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
                required
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
                placeholder="90"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description / Synopsis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers what this content is about..."
              rows={3}
            />
          </div>

          {/* Director & Release Date */}
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
              <Label htmlFor="releaseDate">Release Date</Label>
              <Input
                id="releaseDate"
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
              />
            </div>
          </div>

          {/* Cover Art Upload */}
          <div className="space-y-2">
            <Label>Cover Art (Poster)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {coverFile ? (
                <div className="space-y-2">
                  <img
                    src={URL.createObjectURL(coverFile)}
                    alt="Cover preview"
                    className="max-h-40 mx-auto rounded"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCoverFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload poster (2:3 ratio recommended)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Video Upload / External URL */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Video Source</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Use external URL</span>
                <Switch checked={useExternalUrl} onCheckedChange={setUseExternalUrl} />
              </div>
            </div>

            {useExternalUrl ? (
              <div className="space-y-2">
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={externalVideoUrl}
                    onChange={(e) => setExternalVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports YouTube, Vimeo, and direct video URLs
                </p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                {videoFile ? (
                  <div className="space-y-2">
                    <p className="text-sm">{videoFile.name}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVideoFile(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload video file
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Genres */}
          <div className="space-y-2">
            <Label>Genres (select up to 3)</Label>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <Badge
                  key={genre.id}
                  variant={genreTags.includes(genre.name) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleGenre(genre.name)}
                >
                  {genre.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Cast */}
          <div className="space-y-2">
            <Label>Cast Members</Label>
            <div className="flex gap-2">
              <Input
                value={newCastMember}
                onChange={(e) => setNewCastMember(e.target.value)}
                placeholder="Add cast member"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCastMember())}
              />
              <Button type="button" variant="outline" onClick={handleAddCastMember}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {castMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {castMembers.map((member) => (
                  <Badge key={member} variant="secondary" className="gap-1">
                    {member}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => handleRemoveCastMember(member)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Featured Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label>Feature this content</Label>
              <p className="text-sm text-muted-foreground">
                Featured content appears prominently on your network page
              </p>
            </div>
            <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={uploading || addContent.isPending}
            >
              {uploading || addContent.isPending ? 'Uploading...' : 'Add Content'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
