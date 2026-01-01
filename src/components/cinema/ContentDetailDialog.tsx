import { useState } from 'react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Plus,
  ThumbsUp,
  Send,
  Download,
  Check,
  Volume2,
  VolumeX,
  Info,
  ChevronDown,
} from 'lucide-react';
import { NetworkContent, useTVSeasons } from '@/hooks/useCinema';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.season_number?.toString() || '1');
  const [isMuted, setIsMuted] = useState(true);
  const [isInList, setIsInList] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  
  const isTVShow = content?.content_type === 'tv_show';
  const currentSeason = seasons.find(s => s.season_number.toString() === selectedSeason);
  const currentEpisode = currentSeason?.episodes?.[0];

  if (!content) return null;

  return (
    <Sheet open={!!content} onOpenChange={() => onClose()}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] md:h-[85vh] rounded-t-2xl p-0 border-t border-border/50"
      >
        {/* Video Preview Section */}
        <div className="relative aspect-video max-h-[35vh] overflow-hidden">
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
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="lg"
              className="rounded-full w-16 h-16 bg-white/20 hover:bg-white/30 backdrop-blur-sm border-2 border-white/50"
              onClick={() => onPlay(content)}
            >
              <Play className="w-8 h-8 text-white fill-white" />
            </Button>
          </div>

          {/* Top controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/50 backdrop-blur-sm hover:bg-background/70 rounded-full"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/50 backdrop-blur-sm hover:bg-background/70 rounded-full"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content Info */}
        <ScrollArea className="h-[calc(90vh-35vh)] md:h-[calc(85vh-35vh)]">
          <div className="p-4 md:p-6 space-y-5">
            {/* Title & Meta */}
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
                {content.title}
              </h2>
              
              {/* Meta badges row */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {content.release_date && (
                  <span>{format(new Date(content.release_date), 'yyyy')}</span>
                )}
                {isTVShow && seasons.length > 0 && (
                  <span>{seasons.length} Season{seasons.length > 1 ? 's' : ''}</span>
                )}
                {content.runtime_minutes && !isTVShow && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {content.runtime_minutes}m
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/50">
                  HD
                </Badge>
                {content.genre_tags?.[0] && (
                  <Badge variant="secondary" className="text-[10px]">
                    {content.genre_tags[0]}
                  </Badge>
                )}
              </div>
            </div>

            {/* Current Episode Info (for TV shows) */}
            {isTVShow && currentEpisode && (
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  S{selectedSeason}:E{currentEpisode.episode_number} {currentEpisode.title}
                </p>
                {/* Progress bar placeholder */}
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground">23m remaining</p>
              </div>
            )}

            {/* Description */}
            <p className="text-muted-foreground text-sm leading-relaxed">
              {content.description}
            </p>

            {/* Play/Resume Button */}
            <Button
              size="lg"
              className="w-full gap-2 h-12"
              onClick={() => onPlay(content)}
            >
              {isSubscribed ? (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  {isTVShow ? 'Resume' : 'Play'}
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Subscribe to Watch
                </>
              )}
            </Button>

            {/* Download Button (for TV shows) */}
            {isTVShow && currentEpisode && (
              <Button
                size="lg"
                variant="secondary"
                className="w-full gap-2 h-12"
                disabled={!isSubscribed}
              >
                <Download className="w-5 h-5" />
                Download S{selectedSeason}:E{currentEpisode.episode_number}
              </Button>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-around py-4 border-t border-border/50">
              <ActionButton
                icon={isInList ? Check : Plus}
                label="My List"
                active={isInList}
                onClick={() => setIsInList(!isInList)}
              />
              <ActionButton
                icon={ThumbsUp}
                label="Rated"
                active={isLiked}
                onClick={() => setIsLiked(!isLiked)}
              />
              <ActionButton
                icon={Send}
                label="Share"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: content.title,
                      text: content.description || '',
                      url: window.location.href,
                    });
                  }
                }}
              />
              {isTVShow && (
                <ActionButton
                  icon={Download}
                  label={`Download Season ${selectedSeason}`}
                  disabled={!isSubscribed}
                />
              )}
            </div>

            {/* Tabs Section */}
            <Tabs defaultValue="episodes" className="w-full">
              <TabsList className="w-full grid grid-cols-3 md:grid-cols-4 bg-transparent border-b border-border/50 rounded-none h-auto p-0">
                {isTVShow && (
                  <TabsTrigger 
                    value="episodes" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
                  >
                    Episodes
                  </TabsTrigger>
                )}
                <TabsTrigger 
                  value="details" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
                >
                  {isTVShow ? 'Collection' : 'Details'}
                </TabsTrigger>
                <TabsTrigger 
                  value="similar" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
                >
                  More Like This
                </TabsTrigger>
                {content.trailer_url && (
                  <TabsTrigger 
                    value="trailers" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
                  >
                    Trailers
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Episodes Tab */}
              {isTVShow && (
                <TabsContent value="episodes" className="mt-4 space-y-4">
                  {/* Season Selector */}
                  {seasons.length > 1 && (
                    <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select season" />
                      </SelectTrigger>
                      <SelectContent>
                        {seasons.map((season) => (
                          <SelectItem key={season.id} value={season.season_number.toString()}>
                            Season {season.season_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Episode List */}
                  <div className="space-y-3">
                    {currentSeason?.episodes?.map((episode) => (
                      <EpisodeCard
                        key={episode.id}
                        episode={episode}
                        seasonNumber={parseInt(selectedSeason)}
                        isSubscribed={isSubscribed}
                      />
                    ))}
                    
                    {(!currentSeason?.episodes || currentSeason.episodes.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Tv className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No episodes available yet</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* Details/Collection Tab */}
              <TabsContent value="details" className="mt-4 space-y-4">
                {/* Cast & Crew */}
                {content.cast_members && content.cast_members.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Cast</h4>
                    <p className="text-sm text-foreground">
                      {content.cast_members.join(', ')}
                    </p>
                  </div>
                )}
                
                {content.director && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Director</h4>
                    <p className="text-sm text-foreground">{content.director}</p>
                  </div>
                )}

                {content.genre_tags && content.genre_tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Genres</h4>
                    <div className="flex flex-wrap gap-2">
                      {content.genre_tags.map((tag) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Views</h4>
                  <p className="text-sm text-foreground flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {content.view_count.toLocaleString()} views
                  </p>
                </div>
              </TabsContent>

              {/* Similar Content Tab */}
              <TabsContent value="similar" className="mt-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>More recommendations coming soon</p>
                </div>
              </TabsContent>

              {/* Trailers Tab */}
              <TabsContent value="trailers" className="mt-4">
                {content.trailer_url ? (
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe
                      src={content.trailer_url}
                      className="w-full h-full"
                      allowFullScreen
                      allow="autoplay; encrypted-media"
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No trailers available</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

// Action Button Component
const ActionButton = ({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex flex-col items-center gap-1.5 text-center transition-colors",
      disabled ? "opacity-50 cursor-not-allowed" : "hover:text-foreground",
      active ? "text-foreground" : "text-muted-foreground"
    )}
  >
    <div className={cn(
      "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
      active ? "bg-foreground text-background" : "border border-border"
    )}>
      <Icon className="w-5 h-5" />
    </div>
    <span className="text-[10px] md:text-xs max-w-[60px] truncate">{label}</span>
  </button>
);

// Episode Card Component
const EpisodeCard = ({
  episode,
  seasonNumber,
  isSubscribed,
}: {
  episode: {
    id: string;
    episode_number: number;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    runtime_minutes: number | null;
  };
  seasonNumber: number;
  isSubscribed: boolean;
}) => (
  <div className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
    {/* Thumbnail */}
    <div className="relative w-28 md:w-32 flex-shrink-0">
      <div className="aspect-video rounded-md overflow-hidden bg-muted">
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
        
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
      </div>
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0 py-1">
      <div className="flex items-start justify-between gap-2">
        <h5 className="font-medium text-sm text-foreground line-clamp-1">
          {episode.episode_number}. {episode.title}
        </h5>
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
          <Download className="w-4 h-4" />
        </Button>
      </div>
      {episode.runtime_minutes && (
        <span className="text-xs text-muted-foreground">{episode.runtime_minutes}m</span>
      )}
      {episode.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {episode.description}
        </p>
      )}
    </div>
  </div>
);
