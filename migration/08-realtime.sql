-- ============================================
-- ETHER Migration: Realtime Configuration
-- Target: waafzlorvnozeujjhvxu
-- Generated: 2026-01-26
-- ============================================

-- Enable realtime for messages (chat)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for live streams
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;

-- Enable realtime for typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Enable realtime for stream viewers
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_viewers;

-- Enable realtime for stream reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_reactions;

-- Enable realtime for stream tips
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_tips;

-- Enable realtime for conversation updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Enable realtime for board items (collaborative editing)
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_items;
