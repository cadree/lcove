import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID');
const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, streamId } = await req.json();
    console.log(`Mux stream action: ${action}, streamId: ${streamId}, userId: ${user.id}`);

    if (action === 'create') {
      // Create a new Mux live stream
      const muxResponse = await fetch('https://api.mux.com/video/v1/live-streams', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${muxAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playback_policy: ['public'],
          new_asset_settings: {
            playback_policy: ['public'],
          },
          // Enable recording for replays
          recording: {
            mode: 'enabled'
          },
          // Reduced latency for better viewing experience
          latency_mode: 'low',
        }),
      });

      if (!muxResponse.ok) {
        const errorText = await muxResponse.text();
        console.error('Mux API error:', muxResponse.status, errorText);
        return new Response(JSON.stringify({ error: 'Failed to create Mux stream' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const muxData = await muxResponse.json();
      const liveStream = muxData.data;
      
      console.log('Mux stream created:', liveStream.id);

      // Return the credentials
      return new Response(JSON.stringify({
        mux_live_stream_id: liveStream.id,
        mux_playback_id: liveStream.playback_ids?.[0]?.id,
        rtmp_ingest_url: `rtmps://global-live.mux.com:443/app`,
        rtmp_stream_key: liveStream.stream_key,
        playback_url: `https://stream.mux.com/${liveStream.playback_ids?.[0]?.id}.m3u8`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      // Check stream status
      if (!streamId) {
        return new Response(JSON.stringify({ error: 'streamId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the stream from our DB to get the Mux ID
      const { data: stream, error: dbError } = await supabase
        .from('live_streams')
        .select('mux_live_stream_id, host_id')
        .eq('id', streamId)
        .single();

      if (dbError || !stream) {
        console.error('DB error:', dbError);
        return new Response(JSON.stringify({ error: 'Stream not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!stream.mux_live_stream_id) {
        return new Response(JSON.stringify({ status: 'not_obs', is_active: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const muxResponse = await fetch(`https://api.mux.com/video/v1/live-streams/${stream.mux_live_stream_id}`, {
        headers: {
          'Authorization': `Basic ${muxAuth}`,
        },
      });

      if (!muxResponse.ok) {
        console.error('Mux status error:', muxResponse.status);
        return new Response(JSON.stringify({ status: 'error', is_active: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const muxData = await muxResponse.json();
      const liveStream = muxData.data;
      
      // Update our DB if stream status changed
      const isActive = liveStream.status === 'active';
      const isIdle = liveStream.status === 'idle';
      
      // If stream became active and wasn't marked live, update it
      if (isActive) {
        await supabase
          .from('live_streams')
          .update({ 
            is_live: true, 
            started_at: new Date().toISOString() 
          })
          .eq('id', streamId)
          .is('started_at', null);
      }

      return new Response(JSON.stringify({
        status: liveStream.status, // idle, active, disabled
        is_active: isActive,
        is_idle: isIdle,
        recent_asset_ids: liveStream.recent_asset_ids || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'regenerate_key') {
      // Regenerate stream key
      if (!streamId) {
        return new Response(JSON.stringify({ error: 'streamId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the stream and verify ownership
      const { data: stream, error: dbError } = await supabase
        .from('live_streams')
        .select('mux_live_stream_id, host_id')
        .eq('id', streamId)
        .single();

      if (dbError || !stream) {
        return new Response(JSON.stringify({ error: 'Stream not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (stream.host_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!stream.mux_live_stream_id) {
        return new Response(JSON.stringify({ error: 'Not an OBS stream' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Reset the stream key via Mux API
      const muxResponse = await fetch(`https://api.mux.com/video/v1/live-streams/${stream.mux_live_stream_id}/reset-stream-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${muxAuth}`,
        },
      });

      if (!muxResponse.ok) {
        console.error('Mux reset key error:', muxResponse.status);
        return new Response(JSON.stringify({ error: 'Failed to regenerate key' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const muxData = await muxResponse.json();
      const newStreamKey = muxData.data.stream_key;

      // Update our DB with new key
      await supabase
        .from('live_streams')
        .update({ rtmp_stream_key: newStreamKey })
        .eq('id', streamId);

      console.log('Stream key regenerated for:', streamId);

      return new Response(JSON.stringify({
        rtmp_stream_key: newStreamKey,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_replay') {
      // Get replay URL for ended stream
      if (!streamId) {
        return new Response(JSON.stringify({ error: 'streamId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: stream, error: dbError } = await supabase
        .from('live_streams')
        .select('mux_live_stream_id')
        .eq('id', streamId)
        .single();

      if (dbError || !stream?.mux_live_stream_id) {
        return new Response(JSON.stringify({ error: 'Stream not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the live stream to find recent assets
      const muxResponse = await fetch(`https://api.mux.com/video/v1/live-streams/${stream.mux_live_stream_id}`, {
        headers: {
          'Authorization': `Basic ${muxAuth}`,
        },
      });

      if (!muxResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to get replay' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const muxData = await muxResponse.json();
      const assetIds = muxData.data.recent_asset_ids || [];

      if (assetIds.length === 0) {
        return new Response(JSON.stringify({ replay_url: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the most recent asset
      const assetResponse = await fetch(`https://api.mux.com/video/v1/assets/${assetIds[0]}`, {
        headers: {
          'Authorization': `Basic ${muxAuth}`,
        },
      });

      if (!assetResponse.ok) {
        return new Response(JSON.stringify({ replay_url: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const assetData = await assetResponse.json();
      const playbackId = assetData.data.playback_ids?.[0]?.id;

      if (playbackId) {
        const replayUrl = `https://stream.mux.com/${playbackId}.m3u8`;
        
        // Update our DB with replay URL
        await supabase
          .from('live_streams')
          .update({ 
            replay_url: replayUrl,
            replay_available: true 
          })
          .eq('id', streamId);

        return new Response(JSON.stringify({ replay_url: replayUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ replay_url: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disable') {
      // Disable/end the stream
      if (!streamId) {
        return new Response(JSON.stringify({ error: 'streamId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: stream, error: dbError } = await supabase
        .from('live_streams')
        .select('mux_live_stream_id, host_id')
        .eq('id', streamId)
        .single();

      if (dbError || !stream) {
        return new Response(JSON.stringify({ error: 'Stream not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (stream.host_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Signal disconnect to Mux (this will trigger recording to finalize)
      if (stream.mux_live_stream_id) {
        await fetch(`https://api.mux.com/video/v1/live-streams/${stream.mux_live_stream_id}/complete`, {
          method: 'PUT',
          headers: {
            'Authorization': `Basic ${muxAuth}`,
          },
        });
      }

      // Update our DB
      await supabase
        .from('live_streams')
        .update({ 
          is_live: false, 
          ended_at: new Date().toISOString() 
        })
        .eq('id', streamId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Mux stream error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
