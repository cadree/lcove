import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Radio, Users, Coins, PlayCircle, Clock } from 'lucide-react';
import { LiveStream } from '@/hooks/useLiveStreams';
import { useProfile } from '@/hooks/useProfile';

interface LiveStreamCardProps {
  stream: LiveStream;
  onClick?: () => void;
}

// Stream status helper
type StreamStatus = 'draft' | 'live' | 'ended';
const getStreamStatus = (stream: { is_live: boolean; ended_at: string | null }): StreamStatus => {
  if (stream.is_live) return 'live';
  if (stream.ended_at) return 'ended';
  return 'draft';
};

export const LiveStreamCard: React.FC<LiveStreamCardProps> = ({ stream, onClick }) => {
  const { profile } = useProfile(stream.host_id);
  const status = getStreamStatus(stream);
  const hasReplay = status === 'ended' && stream.replay_available && stream.replay_url;

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors bg-card/50 backdrop-blur-sm"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-muted">
        {stream.thumbnail_url ? (
          <img 
            src={stream.thumbnail_url} 
            alt={stream.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Radio className="h-12 w-12 text-primary/50" />
          </div>
        )}
        
        {status === 'live' ? (
          <Badge className="absolute top-2 left-2 bg-red-500 animate-pulse">
            <Radio className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
        ) : status === 'draft' ? (
          <Badge variant="secondary" className="absolute top-2 left-2 bg-background/80">
            <Clock className="h-3 w-3 mr-1" />
            PREVIEW
          </Badge>
        ) : hasReplay ? (
          <Badge className="absolute top-2 left-2 bg-primary">
            <PlayCircle className="h-3 w-3 mr-1" />
            REPLAY
          </Badge>
        ) : (
          <Badge variant="secondary" className="absolute top-2 left-2 bg-background/80">
            ENDED
          </Badge>
        )}

        <div className="absolute bottom-2 right-2 flex gap-2">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            <Users className="h-3 w-3 mr-1" />
            {stream.viewer_count}
          </Badge>
          {stream.total_tips > 0 && (
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              <Coins className="h-3 w-3 mr-1" />
              {stream.total_tips}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold truncate">{stream.title}</h3>
        
        <div className="flex items-center gap-2 mt-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {profile?.display_name?.charAt(0) || 'D'}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground truncate">
            {profile?.display_name || 'DJ'}
          </span>
        </div>

        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {stream.stream_type === 'webrtc' ? '📹 Camera/Mic' : 
             stream.stream_type === 'opus' ? '🎧 OPUS' :
             stream.stream_type === 'youtube' ? '▶️ YouTube' :
             stream.stream_type === 'twitch' ? '🟣 Twitch' :
             stream.stream_type === 'soundcloud' ? '🎵 SoundCloud' :
             stream.stream_type}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};