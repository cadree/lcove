import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, Radio, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/seo/PageMeta";
import { shareLink, buildShareUrl } from "@/lib/shareLink";
import { WebRTCStreamViewer } from "@/components/streaming/WebRTCStreamViewer";
import { ReplayPlayer } from "@/components/streaming/ReplayPlayer";
import { useAuth } from "@/contexts/AuthContext";

type PublicStream = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  stream_type: string;
  external_url: string | null;
  thumbnail_url: string | null;
  is_live: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  viewer_count: number | null;
  replay_available: boolean | null;
  replay_url: string | null;
  playback_url: string | null;
};

function embed(stream: PublicStream) {
  if (stream.stream_type === "youtube" && stream.external_url) {
    const videoId = stream.external_url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1];
    if (videoId) {
      return <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen title={stream.title} />;
    }
  }
  if (stream.stream_type === "twitch" && stream.external_url) {
    const channel = stream.external_url.match(/twitch\.tv\/([A-Za-z0-9_]+)/)?.[1];
    if (channel) {
      return <iframe className="h-full w-full" src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`} allowFullScreen title={stream.title} />;
    }
  }
  if (stream.stream_type === "soundcloud" && stream.external_url) {
    return (
      <iframe
        className="h-full w-full"
        scrolling="no"
        allow="autoplay"
        title={stream.title}
        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(stream.external_url)}&auto_play=true&hide_related=true&show_comments=false&visual=true`}
      />
    );
  }
  if (stream.replay_available && stream.replay_url && stream.ended_at) {
    return <ReplayPlayer src={stream.replay_url} poster={stream.thumbnail_url} className="h-full w-full" />;
  }
  if (stream.stream_type === "webrtc" && stream.is_live) {
    return (
      <WebRTCStreamViewer
        streamId={stream.id}
        hostId={stream.host_id}
        isLive
        viewerCount={stream.viewer_count || 0}
        thumbnailUrl={stream.thumbnail_url}
      />
    );
  }
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <Radio className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{stream.ended_at ? "This stream has ended." : "The host has not started yet."}</p>
      </div>
    </div>
  );
}

export default function PublicLivePage() {
  const { streamId } = useParams();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["public-live", streamId],
    enabled: !!streamId,
    queryFn: async () => {
      const { data: stream, error } = await supabase
        .from("consumer_live_streams")
        .select("id, host_id, title, description, stream_type, external_url, thumbnail_url, is_live, started_at, ended_at, viewer_count, replay_available, replay_url, playback_url")
        .eq("id", streamId!)
        .maybeSingle();
      if (error) throw error;
      if (!stream?.host_id) return null;
      const { data: host } = await supabase
        .from("consumer_creators")
        .select("display_name, avatar_url")
        .eq("user_id", stream.host_id)
        .maybeSingle();
      return { stream: stream as PublicStream, host };
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl space-y-4 bg-background px-4 py-8">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <Radio className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-display font-bold">Stream not found</h1>
          <p className="mt-2 text-muted-foreground">This live room is not available.</p>
        </div>
      </div>
    );
  }

  const { stream, host } = data;
  const shareUrl = buildShareUrl.live(stream.id);
  const shareImage = stream.thumbnail_url?.startsWith("https://") ? stream.thumbnail_url : undefined;

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title={`${stream.title} · Ether`} description={stream.description || "Live on Ether"} image={shareImage} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Card className="overflow-hidden border-border/50">
          <div className="relative aspect-video bg-black">
            {embed(stream)}
          </div>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                {stream.is_live && <Badge className="mb-2">Live</Badge>}
                <h1 className="text-2xl font-display font-bold">{stream.title}</h1>
                <p className="text-sm text-muted-foreground">{host?.display_name || "Ether"}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="icon" onClick={() => shareLink({ url: shareUrl })}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => shareLink({ title: stream.title, url: shareUrl })}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {stream.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{stream.description}</p>}
            {user?.id === stream.host_id && (
              <Button variant="outline" asChild>
                <Link to={`/live?stream=${stream.id}`}>Open host controls</Link>
              </Button>
            )}
            {!user && (
              <p className="text-sm text-muted-foreground">
                Watching does not need an account. Chat and the feed are for members.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
