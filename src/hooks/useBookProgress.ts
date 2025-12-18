import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TOTAL_PAGES } from '@/data/bookOfLcove';

export interface BookProgress {
  id: string;
  user_id: string;
  current_page: number;
  total_pages: number;
  last_read_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  page_number: number;
  title: string | null;
  created_at: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  page_number: number;
  highlighted_text: string;
  is_important: boolean;
  created_at: string;
}

export interface BookNote {
  id: string;
  user_id: string;
  page_number: number;
  note_text: string;
  created_at: string;
  updated_at: string;
}

export const useBookProgress = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch reading progress
  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['book-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('book_reading_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as BookProgress | null;
    },
    enabled: !!user?.id,
  });

  // Update reading progress
  const updateProgress = useMutation({
    mutationFn: async (pageNumber: number) => {
      if (!user?.id) return;
      
      const { data: existing } = await supabase
        .from('book_reading_progress')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('book_reading_progress')
          .update({ 
            current_page: pageNumber, 
            last_read_at: new Date().toISOString() 
          })
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('book_reading_progress')
          .insert([{ 
            user_id: user.id, 
            current_page: pageNumber,
            total_pages: TOTAL_PAGES
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-progress', user?.id] });
    },
  });

  return {
    progress,
    progressLoading,
    updateProgress: updateProgress.mutate,
  };
};

export const useBookmarks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ['book-bookmarks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('book_bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('page_number', { ascending: true });
      
      if (error) throw error;
      return data as Bookmark[];
    },
    enabled: !!user?.id,
  });

  const addBookmark = useMutation({
    mutationFn: async ({ pageNumber, title }: { pageNumber: number; title?: string }) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('book_bookmarks')
        .insert([{ user_id: user.id, page_number: pageNumber, title }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-bookmarks', user?.id] });
    },
  });

  const removeBookmark = useMutation({
    mutationFn: async (bookmarkId: string) => {
      const { error } = await supabase
        .from('book_bookmarks')
        .delete()
        .eq('id', bookmarkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-bookmarks', user?.id] });
    },
  });

  const isPageBookmarked = useCallback((pageNumber: number) => {
    return bookmarks.some(b => b.page_number === pageNumber);
  }, [bookmarks]);

  const getBookmarkForPage = useCallback((pageNumber: number) => {
    return bookmarks.find(b => b.page_number === pageNumber);
  }, [bookmarks]);

  return {
    bookmarks,
    isLoading,
    addBookmark: addBookmark.mutate,
    removeBookmark: removeBookmark.mutate,
    isPageBookmarked,
    getBookmarkForPage,
  };
};

export const useHighlights = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: highlights = [], isLoading } = useQuery({
    queryKey: ['book-highlights', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('book_highlights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Highlight[];
    },
    enabled: !!user?.id,
  });

  const addHighlight = useMutation({
    mutationFn: async ({ pageNumber, text, isImportant = false }: { pageNumber: number; text: string; isImportant?: boolean }) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('book_highlights')
        .insert([{ 
          user_id: user.id, 
          page_number: pageNumber, 
          highlighted_text: text,
          is_important: isImportant
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-highlights', user?.id] });
    },
  });

  const toggleImportant = useMutation({
    mutationFn: async ({ highlightId, isImportant }: { highlightId: string; isImportant: boolean }) => {
      const { error } = await supabase
        .from('book_highlights')
        .update({ is_important: isImportant })
        .eq('id', highlightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-highlights', user?.id] });
    },
  });

  const removeHighlight = useMutation({
    mutationFn: async (highlightId: string) => {
      const { error } = await supabase
        .from('book_highlights')
        .delete()
        .eq('id', highlightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-highlights', user?.id] });
    },
  });

  const getHighlightsForPage = useCallback((pageNumber: number) => {
    return highlights.filter(h => h.page_number === pageNumber);
  }, [highlights]);

  const importantHighlights = highlights.filter(h => h.is_important);

  return {
    highlights,
    importantHighlights,
    isLoading,
    addHighlight: addHighlight.mutate,
    toggleImportant: toggleImportant.mutate,
    removeHighlight: removeHighlight.mutate,
    getHighlightsForPage,
  };
};

export const useBookNotes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['book-notes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('book_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as BookNote[];
    },
    enabled: !!user?.id,
  });

  const addNote = useMutation({
    mutationFn: async ({ pageNumber, text }: { pageNumber: number; text: string }) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('book_notes')
        .insert([{ 
          user_id: user.id, 
          page_number: pageNumber, 
          note_text: text
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-notes', user?.id] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ noteId, text }: { noteId: string; text: string }) => {
      const { error } = await supabase
        .from('book_notes')
        .update({ note_text: text })
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-notes', user?.id] });
    },
  });

  const removeNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('book_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book-notes', user?.id] });
    },
  });

  const getNotesForPage = useCallback((pageNumber: number) => {
    return notes.filter(n => n.page_number === pageNumber);
  }, [notes]);

  return {
    notes,
    isLoading,
    addNote: addNote.mutate,
    updateNote: updateNote.mutate,
    removeNote: removeNote.mutate,
    getNotesForPage,
  };
};
