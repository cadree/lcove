import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type CreatorRoleType = 'model' | 'chef' | 'dj' | 'dancer' | 'filmmaker' | 'photographer' | 'musician' | 'artist';

export interface CreatorRole {
  id: string;
  user_id: string;
  role_type: CreatorRoleType;
  is_active: boolean;
  display_order: number;
}

export interface PortfolioItem {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  media_url: string;
  media_type: string;
  tags: string[] | null;
  display_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
  display_order: number;
}

export interface DJMix {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  audio_url: string | null;
  cover_art_url: string | null;
  duration_seconds: number | null;
  genre: string | null;
  is_live: boolean;
  recorded_at: string | null;
  created_at: string;
}

export interface DanceVideo {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  style: string | null;
  song_title: string | null;
  song_artist: string | null;
  is_choreography: boolean;
  created_at: string;
}

export function useCreatorRoles(userId?: string) {
  return useQuery({
    queryKey: ['creator-roles', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_roles')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as CreatorRole[];
    },
    enabled: !!userId,
  });
}

export function useToggleCreatorRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (roleType: CreatorRoleType) => {
      // Check if role exists
      const { data: existing } = await supabase
        .from('creator_roles')
        .select('*')
        .eq('user_id', user?.id)
        .eq('role_type', roleType)
        .maybeSingle();

      if (existing) {
        // Toggle is_active
        const { error } = await supabase
          .from('creator_roles')
          .update({ is_active: !existing.is_active })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Create new role
        const { error } = await supabase
          .from('creator_roles')
          .insert({
            user_id: user?.id,
            role_type: roleType,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-roles'] });
      toast.success('Role updated');
    },
  });
}

// Portfolio hooks
export function usePortfolio(userId?: string) {
  return useQuery({
    queryKey: ['portfolio', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('user_id', userId!)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as PortfolioItem[];
    },
    enabled: !!userId,
  });
}

export function useAddPortfolioItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<PortfolioItem, 'id' | 'user_id' | 'created_at' | 'display_order'>) => {
      const { error } = await supabase
        .from('portfolio_items')
        .insert({ ...data, user_id: user?.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success('Portfolio item added');
    },
  });
}

// Menu hooks
export function useMenu(userId?: string) {
  return useQuery({
    queryKey: ['menu', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('user_id', userId!)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as MenuItem[];
    },
    enabled: !!userId,
  });
}

export function useAddMenuItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<MenuItem, 'id' | 'user_id' | 'display_order'>) => {
      const { error } = await supabase
        .from('menu_items')
        .insert({ ...data, user_id: user?.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      toast.success('Menu item added');
    },
  });
}

// DJ Mixes hooks
export function useDJMixes(userId?: string) {
  return useQuery({
    queryKey: ['dj-mixes', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dj_mixes')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DJMix[];
    },
    enabled: !!userId,
  });
}

export function useAddDJMix() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<DJMix, 'id' | 'user_id' | 'created_at'>) => {
      const { error } = await supabase
        .from('dj_mixes')
        .insert({ ...data, user_id: user?.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dj-mixes'] });
      toast.success('Mix added');
    },
  });
}

// Dance Videos hooks
export function useDanceVideos(userId?: string) {
  return useQuery({
    queryKey: ['dance-videos', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dance_videos')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DanceVideo[];
    },
    enabled: !!userId,
  });
}

export function useAddDanceVideo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<DanceVideo, 'id' | 'user_id' | 'created_at'>) => {
      const { error } = await supabase
        .from('dance_videos')
        .insert({ ...data, user_id: user?.id });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dance-videos'] });
      toast.success('Video added');
    },
  });
}

export const CREATOR_ROLE_CONFIG = {
  model: { label: 'Model', icon: '📸', tab: 'Portfolio' },
  chef: { label: 'Chef', icon: '👨‍🍳', tab: 'Menu' },
  dj: { label: 'DJ', icon: '🎧', tab: 'Mixes' },
  dancer: { label: 'Dancer', icon: '💃', tab: 'Choreography' },
  filmmaker: { label: 'Filmmaker', icon: '🎬', tab: 'Films' },
  photographer: { label: 'Photographer', icon: '📷', tab: 'Portfolio' },
  musician: { label: 'Musician', icon: '🎵', tab: 'Music' },
  artist: { label: 'Artist', icon: '🎨', tab: 'Gallery' },
} as const;
