import React, { useState } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radio, Plus, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveStreams, useGoLive } from '@/hooks/useLiveStreams';
import { LiveStreamCard } from '@/components/streaming/LiveStreamCard';
import { StreamViewer } from '@/components/streaming/StreamViewer';
import { CreateStreamDialog } from '@/components/streaming/CreateStreamDialog';
import { motion } from 'framer-motion';

const Live = () => {
  const { user } = useAuth();
  const { streams: liveStreams, isLoading: loadingLive } = useLiveStreams(true);
  const { streams: allStreams, isLoading: loadingAll } = useLiveStreams(false);
  const goLive = useGoLive();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  const myStreams = allStreams.filter(s => s.host_id === user?.id);

  return (
    <PageLayout>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-background to-background p-8">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <Radio className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Live DJ Sets</h1>
                <p className="text-muted-foreground">Stream live or tune in to community DJs</p>
              </div>
            </div>
            
            {user && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Start Streaming
              </Button>
            )}
          </div>
          
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute -right-20 -top-20 w-64 h-64 rounded-full border border-primary/20"
            />
          </div>
        </div>

        {/* Live Now Section */}
        {liveStreams.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              <h2 className="text-xl font-semibold">Live Now</h2>
              <span className="text-sm text-muted-foreground">({liveStreams.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveStreams.map((stream) => (
                <LiveStreamCard 
                  key={stream.id} 
                  stream={stream}
                  onClick={() => setSelectedStreamId(stream.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Tabs for browsing */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Streams</TabsTrigger>
            {user && <TabsTrigger value="my">My Streams</TabsTrigger>}
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {loadingAll ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : allStreams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allStreams.map((stream) => (
                  <LiveStreamCard 
                    key={stream.id} 
                    stream={stream}
                    onClick={() => setSelectedStreamId(stream.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No streams yet</h3>
                <p className="text-muted-foreground mb-4">Be the first to go live!</p>
                {user && (
                  <Button onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Start Streaming
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {user && (
            <TabsContent value="my" className="mt-4">
              {myStreams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myStreams.map((stream) => (
                    <div key={stream.id} className="relative">
                      <LiveStreamCard 
                        stream={stream}
                        onClick={() => setSelectedStreamId(stream.id)}
                      />
                      <div className="absolute bottom-4 left-4 right-4">
                        <Button
                          variant={stream.is_live ? 'destructive' : 'default'}
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            goLive.mutate({ streamId: stream.id, isLive: !stream.is_live });
                          }}
                        >
                          {stream.is_live ? 'End Stream' : 'Go Live'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">You haven't created any streams yet</p>
                  <Button onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Stream
                  </Button>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Create Stream Dialog */}
        <CreateStreamDialog open={showCreate} onClose={() => setShowCreate(false)} />

        {/* Stream Viewer */}
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
