import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NetworkContent } from '@/hooks/useCinema';
import { VideoPlayer } from './VideoPlayer';
import { 
  Film, 
  Clock, 
  Calendar, 
  Eye, 
  User, 
  Users, 
  Edit,
  ExternalLink,
  Play,
} from 'lucide-react';
import { format } from 'date-fns';

interface ContentDetailManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: NetworkContent | null;
  onEdit: () => void;
}

export const ContentDetailManageDialog = ({ 
  open, 
  onOpenChange, 
  content,
  onEdit,
}: ContentDetailManageDialogProps) => {
  const [showPlayer, setShowPlayer] = useState(false);

  if (!content) return null;

  const hasVideo = content.video_url || content.external_video_url;

  const formatContentType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Show video player fullscreen
  if (showPlayer) {
    return (
      <VideoPlayer
        content={content}
        onClose={() => setShowPlayer(false)}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        {/* Hero Section */}
        <div className="relative h-64 bg-gradient-to-br from-primary/20 to-accent/20">
          {content.cover_art_url ? (
            <img
              src={content.cover_art_url}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-20 h-20 text-muted-foreground/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={content.is_published ? 'default' : 'secondary'}>
                    {content.is_published ? 'Published' : 'Draft'}
                  </Badge>
                  {content.is_featured && (
                    <Badge className="bg-amber-500">Featured</Badge>
                  )}
                  <Badge variant="outline">{formatContentType(content.content_type)}</Badge>
                </div>
                <h1 className="text-2xl font-bold">{content.title}</h1>
              </div>
              <div className="flex gap-2">
                {hasVideo && (
                  <Button onClick={() => setShowPlayer(true)}>
                    <Play className="w-4 h-4 mr-2" />
                    Watch
                  </Button>
                )}
                <Button variant="outline" onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="p-6 space-y-6">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {content.runtime_minutes && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{content.runtime_minutes} min</span>
                </div>
              )}
              {content.release_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(content.release_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              {content.director && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>{content.director}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="w-4 h-4" />
                <span>{content.view_count} views</span>
              </div>
            </div>

            {/* Description */}
            {content.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{content.description}</p>
              </div>
            )}

            {/* Genres */}
            {content.genre_tags && content.genre_tags.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {content.genre_tags.map((genre) => (
                    <Badge key={genre} variant="outline">{genre}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Cast */}
            {content.cast_members && content.cast_members.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Cast
                </h3>
                <div className="flex flex-wrap gap-2">
                  {content.cast_members.map((member) => (
                    <Badge key={member} variant="secondary">{member}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Video Section */}
            <div className="space-y-3">
              <h3 className="font-semibold">Video</h3>
              {hasVideo ? (
                <Button 
                  onClick={() => setShowPlayer(true)}
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Watch Now
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">No video linked yet</p>
              )}
            </div>

            {/* Created Date */}
            <div className="pt-4 border-t text-xs text-muted-foreground">
              Created {format(new Date(content.created_at), 'MMM d, yyyy h:mm a')}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
