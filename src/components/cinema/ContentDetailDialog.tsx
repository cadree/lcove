import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Lock,
  Clock,
  Calendar,
  User,
  Users,
  Film,
  Tv,
  X,
} from 'lucide-react';
import { NetworkContent, useTVSeasons } from '@/hooks/useCinema';
import { format } from 'date-fns';

interface ContentDetailDialogProps {
  content: NetworkContent | null;
  onClose: () => void;
  onPlay: (content: NetworkContent) => void;
  isSubscribed: boolean;
}

export const ContentDetailDialog = ({
  content,
  onClose,
  onPlay,
  isSubscribed,
}: ContentDetailDialogProps) => {
  const { data: seasons = [] } = useTVSeasons(content?.id || '');
  const isTVShow = content?.content_type === 'tv_show';

  if (!content) return null;

  return (
    <Dialog open={!!content} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {/* Hero Section */}
        <div className="relative aspect-video">
          {content.cover_art_url ? (
            <img
              src={content.cover_art_url}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
              {isTVShow ? (
                <Tv className="w-20 h-20 text-muted-foreground" />
              ) : (
                <Film className="w-20 h-20 text-muted-foreground" />
              )}
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 bg-background/50 backdrop-blur-sm"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">
                {content.content_type === 'tv_show'
                  ? 'TV Series'
                  : content.content_type === 'short_film'
                  ? 'Short Film'
                  : 'Feature Film'}
              </Badge>
              {content.genre_tags?.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              {content.title}
            </h2>

            <div className="flex items-center gap-4">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => onPlay(content)}
              >
                {isSubscribed ? (
                  <>
                    <Play className="w-5 h-5" />
                    {isTVShow ? 'Play S1 E1' : 'Play'}
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Subscribe to Watch
                  </>
                )}
              </Button>

              {content.trailer_url && (
                <Button variant="outline" size="lg" className="gap-2">
                  <Play className="w-4 h-4" />
                  Watch Trailer
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Info */}
        <ScrollArea className="max-h-[40vh]">
          <div className="p-6 space-y-6">
            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {content.runtime_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {content.runtime_minutes} min
                </span>
              )}
              {content.release_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(content.release_date), 'yyyy')}
                </span>
              )}
              {content.director && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Dir. {content.director}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {content.view_count.toLocaleString()} views
              </span>
            </div>

            {/* Description */}
            <p className="text-foreground">{content.description}</p>

            {/* Cast */}
            {content.cast_members && content.cast_members.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Cast</h4>
                <div className="flex flex-wrap gap-2">
                  {content.cast_members.map((member) => (
                    <Badge key={member} variant="outline">
                      {member}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* TV Show Episodes */}
            {isTVShow && seasons.length > 0 && (
              <div>
                <h4 className="font-medium mb-4">Episodes</h4>
                <Tabs defaultValue={`season-${seasons[0]?.season_number}`}>
                  <TabsList className="mb-4">
                    {seasons.map((season) => (
                      <TabsTrigger
                        key={season.id}
                        value={`season-${season.season_number}`}
                      >
                        Season {season.season_number}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {seasons.map((season) => (
                    <TabsContent
                      key={season.id}
                      value={`season-${season.season_number}`}
                      className="space-y-3"
                    >
                      {season.episodes?.map((episode) => (
                        <div
                          key={episode.id}
                          className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                        >
                          <div className="w-24 h-14 rounded bg-muted flex-shrink-0 overflow-hidden">
                            {episode.thumbnail_url ? (
                              <img
                                src={episode.thumbnail_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium truncate">
                              {episode.episode_number}. {episode.title}
                            </h5>
                            {episode.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {episode.description}
                              </p>
                            )}
                          </div>
                          {episode.runtime_minutes && (
                            <span className="text-sm text-muted-foreground flex-shrink-0">
                              {episode.runtime_minutes}m
                            </span>
                          )}
                        </div>
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
