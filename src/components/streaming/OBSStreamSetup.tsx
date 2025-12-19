import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Eye, EyeOff, RefreshCw, ExternalLink, Check, Loader2, Radio, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OBSStreamSetupProps {
  streamId: string;
  rtmpIngestUrl: string | null;
  rtmpStreamKey: string | null;
  isLive: boolean;
  isHost: boolean;
  onStatusChange?: (isLive: boolean) => void;
}

type ConnectionStatus = 'offline' | 'connecting' | 'live';

export const OBSStreamSetup: React.FC<OBSStreamSetupProps> = ({
  streamId,
  rtmpIngestUrl,
  rtmpStreamKey,
  isLive,
  isHost,
  onStatusChange,
}) => {
  const { toast } = useToast();
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(isLive ? 'live' : 'offline');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [currentStreamKey, setCurrentStreamKey] = useState(rtmpStreamKey);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for stream status
  useEffect(() => {
    if (!isHost || !streamId) return;

    const checkStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mux-stream`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'status', streamId }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.is_active) {
            setConnectionStatus('live');
            if (!isLive && onStatusChange) {
              onStatusChange(true);
            }
          } else if (data.is_idle) {
            setConnectionStatus('offline');
          }
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 5 seconds when not live
    const interval = setInterval(() => {
      if (connectionStatus !== 'live') {
        setIsPolling(true);
        checkStatus().finally(() => setIsPolling(false));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [streamId, isHost, isLive, connectionStatus, onStatusChange]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRegenerateKey = async () => {
    setIsRegenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mux-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'regenerate_key', streamId }),
      });

      if (!response.ok) throw new Error('Failed to regenerate key');

      const data = await response.json();
      setCurrentStreamKey(data.rtmp_stream_key);
      toast({ title: 'Stream key regenerated', description: 'Your old key is now invalid.' });
    } catch (error) {
      console.error('Regenerate key error:', error);
      toast({ title: 'Failed to regenerate key', variant: 'destructive' });
    } finally {
      setIsRegenerating(false);
      setShowRegenerateDialog(false);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'live': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-muted-foreground';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'live': return 'OBS Connected — Live';
      case 'connecting': return 'Connecting...';
      default: return 'Waiting for OBS…';
    }
  };

  if (!isHost) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>This stream uses OBS. Waiting for the host to go live...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${getStatusColor()}`} />
          <span className="font-medium">{getStatusText()}</span>
          {isPolling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {connectionStatus === 'live' ? (
          <Badge className="bg-red-500">
            <Radio className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
        ) : (
          <Badge variant="secondary">
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </Badge>
        )}
      </div>

      {/* RTMP Server URL */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">RTMP Server URL</Label>
        <div className="flex gap-2">
          <Input
            value={rtmpIngestUrl || ''}
            readOnly
            className="font-mono text-sm bg-muted"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(rtmpIngestUrl || '', 'url')}
          >
            {copiedField === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Stream Key */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Stream Key</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={showStreamKey ? (currentStreamKey || '') : '••••••••••••••••••••'}
              readOnly
              className="font-mono text-sm bg-muted pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowStreamKey(!showStreamKey)}
            >
              {showStreamKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(currentStreamKey || '', 'key')}
          >
            {copiedField === 'key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Regenerate Key */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowRegenerateDialog(true)}
        disabled={isRegenerating}
        className="w-full"
      >
        {isRegenerating ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Regenerate Stream Key
      </Button>

      {/* How to Stream Guide */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-2">
        <p className="font-medium flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          How to stream with OBS
        </p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Open OBS and go to Settings → Stream</li>
          <li>Set Service to "Custom..."</li>
          <li>Paste the Server URL above</li>
          <li>Paste the Stream Key above</li>
          <li>Click "Start Streaming" in OBS</li>
        </ol>
      </div>

      {/* Download OBS Link */}
      <a
        href="https://obsproject.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
      >
        <ExternalLink className="h-4 w-4" />
        Download OBS
      </a>

      {/* Regenerate Key Confirmation */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Stream Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate your current stream key. You'll need to update the key in OBS to continue streaming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateKey} disabled={isRegenerating}>
              {isRegenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
