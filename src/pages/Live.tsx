import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  Radio, Plus, Users, Mic, ArrowLeft, Play, Pencil, 
  Clock, Eye, Coins, PlayCircle, Video, Headphones, Search 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveStreams, useGoLive, LiveStream } from '@/hooks/useLiveStreams';
import { LiveStreamCard } from '@/components/streaming/LiveStreamCard';
import { StreamViewer } from '@/components/streaming/StreamViewer';
import { CreateStreamDialog } from '@/components/streaming/CreateStreamDialog';
import { EditStreamDialog } from '@/components/streaming/EditStreamDialog';
import { useProfile } from '@/hooks/useProfile';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Compact stream card for "My Streams" section
const MyStreamCard: React.FC<{
  stream: LiveStream;
  onWatch: () => void;
  onEdit: () => void;
  onGoLive: () => void;
}> = ({ stream, onWatch, onEdit, onGoLive }) => {
  const { profile } = useProfile(stream.host_id);
  const goLive = useGoLive();
  
  const getStatus = () => {
    if (stream.is_live) return 'live';
    if (stream.started_at && stream.ended_at) return 'ended';
    return 'draft';
  };
  
  const status = getStatus();
  const hasReplay = status === 'ended' && stream.replay_available && stream.replay_url;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all">
        {/* Mobile-first vertical stack layout */}
        <div className="p-3 sm:p-4">
          {/* Top row: Thumbnail + Info */}
          <div className="flex gap-3 sm:gap-4">
            {/* Thumbnail - fixed size */}
            <div className="relative w-20 h-14 sm:w-28 sm:h-20 rounded-lg overflow-hidden bg-muted shrink-0">
              {stream.thumbnail_url ? (
                <img 
                  src={stream.thumbnail_url} 
                  alt={stream.title}
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: stream.thumbnail_focal_point 
                      ? `${stream.thumbnail_focal_point.x}% ${stream.thumbnail_focal_point.y}%`
                      : 'center'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <Radio className="h-5 w-5 sm:h-6 sm:w-6 text-primary/50" />
                </div>
              )}
              
              {/* Status badge */}
              {status === 'live' && (
                <Badge className="absolute top-1 left-1 bg-red-500 text-[9px] sm:text-[10px] px-1 py-0.5">
                  LIVE
                </Badge>
              )}
              {hasReplay && (
                <Badge className="absolute top-1 left-1 bg-primary text-[9px] sm:text-[10px] px-1 py-0.5">
                  <PlayCircle className="h-2 w-2 sm:h-2.5 sm:w-2.5 mr-0.5" />
                  REPLAY
                </Badge>
              )}
            </div>
            
            {/* Info - allow text to wrap */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <h3 className="font-medium text-sm sm:text-base line-clamp-2 leading-tight">{stream.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-0.5">
                {stream.description || 'No description'}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {stream.viewer_count}
                </span>
                {stream.total_tips > 0 && (
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    {stream.total_tips}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Bottom row: Actions - full width on mobile */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
            <Button 
              size="sm" 
              variant="outline"
              className="flex-1 h-9 text-xs sm:text-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            
            {status === 'live' ? (
              <Button 
                size="sm" 
                variant="destructive"
                className="flex-1 h-9 text-xs sm:text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  goLive.mutate({ streamId: stream.id, isLive: false });
                }}
              >
                End Stream
              </Button>
            ) : hasReplay ? (
              <Button 
                size="sm" 
                variant="default"
                className="flex-1 h-9 text-xs sm:text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onWatch();
                }}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Watch
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="default"
                className="flex-1 h-9 text-xs sm:text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onWatch();
                }}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Start
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// Featured live stream card
const FeaturedLiveCard: React.FC<{
  stream: LiveStream;
  onClick: () => void;
}> = ({ stream, onClick }) => {
  const { profile } = useProfile(stream.host_id);
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer"
      onClick={onClick}
    >
      <Card className="overflow-hidden bg-gradient-to-br from-red-500/20 via-card to-card border-red-500/30">
        <div className="relative aspect-video">
          {stream.thumbnail_url ? (
            <img 
              src={stream.thumbnail_url} 
              alt={stream.title}
              className="w-full h-full object-cover"
              style={{
                objectPosition: stream.thumbnail_focal_point 
                  ? `${stream.thumbnail_focal_point.x}% ${stream.thumbnail_focal_point.y}%`
                  : 'center'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500/30 to-primary/10">
              <Radio className="h-16 w-16 text-red-500/70 animate-pulse" />
            </div>
          )}
          
          {/* Live indicator */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <Badge className="bg-red-500 animate-pulse">
              <Radio className="h-3 w-3 mr-1" />
              LIVE NOW
            </Badge>
          </div>
          
          {/* Viewer count */}
          <div className="absolute bottom-3 right-3">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              <Users className="h-3 w-3 mr-1" />
              {stream.viewer_count} watching
            </Badge>
          </div>
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
        
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg">{stream.title}</h3>
          <div className="flex items-center gap-2 mt-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {profile?.display_name?.charAt(0) || 'D'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {profile?.display_name || 'DJ'}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const Live = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { streams: liveStreams, isLoading: loadingLive } = useLiveStreams(true);
  const { streams: allStreams, isLoading: loadingAll } = useLiveStreams(false);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [editingStream, setEditingStream] = useState<LiveStream | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle action param from FAB
  useEffect(() => {
    if (searchParams.get('action') === 'create' && user) {
      setShowCreate(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, user, setSearchParams]);

  const myStreams = allStreams.filter(s => s.host_id === user?.id);
  const otherStreams = allStreams.filter(s => s.host_id !== user?.id);
  
  // Filter streams by search query
  const filteredBrowseStreams = useMemo(() => {
    const streams = user ? otherStreams : allStreams;
    if (!searchQuery.trim()) return streams;
    
    const query = searchQuery.toLowerCase();
    return streams.filter(s => 
      s.title.toLowerCase().includes(query) || 
      (s.description && s.description.toLowerCase().includes(query))
    );
  }, [searchQuery, otherStreams, allStreams, user]);

  const filteredReplays = useMemo(() => {
    const replays = allStreams.filter(s => s.replay_available && s.replay_url);
    if (!searchQuery.trim()) return replays;
    
    const query = searchQuery.toLowerCase();
    return replays.filter(s => 
      s.title.toLowerCase().includes(query) || 
      (s.description && s.description.toLowerCase().includes(query))
    );
  }, [searchQuery, allStreams]);

  // Stats
  const totalLive = liveStreams.length;
  const totalReplays = allStreams.filter(s => s.replay_available && s.replay_url).length;

  return (
    <PageLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-primary/20 rounded-xl">
                      <Radio className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Live Streams</h1>
                  </div>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    Stream live DJ sets or watch the community
                  </p>
                </div>
              </div>
              
              {user && (
                <Button onClick={() => setShowCreate(true)} className="shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Start Streaming</span>
                  <span className="sm:hidden">Stream</span>
                </Button>
              )}
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-4 mt-6 ml-14">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500">
                <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">{totalLive} Live</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                <PlayCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{totalReplays} Replays</span>
              </div>
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              className="absolute -right-32 -top-32 w-64 h-64 rounded-full border border-primary/10"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              className="absolute -right-16 -top-16 w-32 h-32 rounded-full border border-primary/20"
            />
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* Featured Live Section */}
          {liveStreams.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse" />
                <h2 className="text-xl font-semibold">Live Now</h2>
              </div>
              
              {liveStreams.length === 1 ? (
                <div className="max-w-xl">
                  <FeaturedLiveCard 
                    stream={liveStreams[0]}
                    onClick={() => setSelectedStreamId(liveStreams[0].id)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveStreams.map((stream) => (
                    <LiveStreamCard 
                      key={stream.id} 
                      stream={stream}
                      onClick={() => setSelectedStreamId(stream.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Main Tabs */}
          <Tabs defaultValue={user ? "my" : "all"} className="w-full">
            <TabsList className="w-full sm:w-auto">
              {user && <TabsTrigger value="my" className="flex-1 sm:flex-none">My Streams</TabsTrigger>}
              <TabsTrigger value="all" className="flex-1 sm:flex-none">Browse</TabsTrigger>
              <TabsTrigger value="replays" className="flex-1 sm:flex-none">Replays</TabsTrigger>
            </TabsList>

            {/* My Streams Tab */}
            {user && (
              <TabsContent value="my" className="mt-6">
                {myStreams.length > 0 ? (
                  <div className="space-y-3">
                    {myStreams.map((stream) => (
                      <MyStreamCard
                        key={stream.id}
                        stream={stream}
                        onWatch={() => setSelectedStreamId(stream.id)}
                        onEdit={() => setEditingStream(stream)}
                        onGoLive={() => setSelectedStreamId(stream.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Video}
                    title="No streams yet"
                    description="Create your first stream to start broadcasting to the community."
                    action={{
                      label: "Create Stream",
                      onClick: () => setShowCreate(true)
                    }}
                  />
                )}
              </TabsContent>
            )}

            {/* Browse Tab */}
            <TabsContent value="all" className="mt-6 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search streams by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {loadingAll ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : filteredBrowseStreams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBrowseStreams.map((stream) => (
                    <LiveStreamCard 
                      key={stream.id} 
                      stream={stream}
                      onClick={() => setSelectedStreamId(stream.id)}
                    />
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description={`No streams match "${searchQuery}".`}
                />
              ) : (
                <EmptyState
                  icon={Headphones}
                  title="No streams to browse"
                  description="Be the first to share your sound with the community!"
                  action={user ? {
                    label: "Start Streaming",
                    onClick: () => setShowCreate(true)
                  } : undefined}
                />
              )}
            </TabsContent>

            {/* Replays Tab */}
            <TabsContent value="replays" className="mt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search replays..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {filteredReplays.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredReplays.map((stream) => (
                    <LiveStreamCard 
                      key={stream.id} 
                      stream={stream}
                      onClick={() => setSelectedStreamId(stream.id)}
                    />
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description={`No replays match "${searchQuery}".`}
                />
              ) : (
                <EmptyState
                  icon={PlayCircle}
                  title="No replays available"
                  description="Past streams with saved replays will appear here."
                />
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialogs */}
        <CreateStreamDialog 
          open={showCreate} 
          onClose={() => setShowCreate(false)} 
          onStreamCreated={(streamId) => setSelectedStreamId(streamId)}
        />

        <EditStreamDialog
          stream={editingStream}
          open={!!editingStream}
          onClose={() => setEditingStream(null)}
        />

        {selectedStreamId && (
          <StreamViewer
            streamId={selectedStreamId}
            open={!!selectedStreamId}
            onClose={() => setSelectedStreamId(null)}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default Live;
