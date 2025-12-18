import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Menu, X, Star, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useBookProgress, useBookmarks, useHighlights, useBookNotes } from '@/hooks/useBookProgress';
import { BOOK_PAGES, BOOK_CHAPTERS, TOTAL_PAGES, getChapterForPage, getPageByNumber } from '@/data/bookOfLcove';
import { toast } from 'sonner';

const BookOfLcove: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [direction, setDirection] = useState(0);

  const { progress, updateProgress } = useBookProgress();
  const { bookmarks, addBookmark, removeBookmark, isPageBookmarked, getBookmarkForPage } = useBookmarks();
  const { highlights, importantHighlights, addHighlight } = useHighlights();
  const { notes, addNote, getNotesForPage } = useBookNotes();

  const currentPageData = getPageByNumber(currentPage);
  const currentChapter = getChapterForPage(currentPage);
  const pageNotes = getNotesForPage(currentPage);

  // Check for saved progress on mount
  useEffect(() => {
    if (progress && progress.current_page > 1 && currentPage === 1) {
      setShowContinuePrompt(true);
    }
  }, [progress]);

  // Save progress when page changes
  useEffect(() => {
    if (user && currentPage > 0) {
      updateProgress(currentPage);
    }
  }, [currentPage, user]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= TOTAL_PAGES) {
      setDirection(page > currentPage ? 1 : -1);
      setCurrentPage(page);
    }
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  const handleContinue = () => {
    if (progress) {
      setCurrentPage(progress.current_page);
    }
    setShowContinuePrompt(false);
  };

  const handleStartFresh = () => {
    setCurrentPage(1);
    setShowContinuePrompt(false);
  };

  const toggleBookmark = () => {
    const existing = getBookmarkForPage(currentPage);
    if (existing) {
      removeBookmark(existing.id);
      toast.success('Bookmark removed');
    } else {
      addBookmark({ pageNumber: currentPage, title: currentPageData?.title });
      toast.success('Page bookmarked');
    }
  };

  const handleAddNote = () => {
    if (noteText.trim()) {
      addNote({ pageNumber: currentPage, text: noteText });
      setNoteText('');
      toast.success('Note saved');
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      addHighlight({ pageNumber: currentPage, text });
      toast.success('Text highlighted');
      selection.removeAllRanges();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-serif">The Book of LCOVE</h1>
          <p className="text-muted-foreground">Please sign in to read</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0a08] text-[#e8e0d5] relative overflow-hidden">
      {/* Paper texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

      {/* Continue Reading Prompt */}
      <AnimatePresence>
        {showContinuePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#1a1512] rounded-lg p-8 max-w-md text-center space-y-6 border border-primary/20"
            >
              <h2 className="text-xl font-serif">Continue where you left off?</h2>
              <p className="text-muted-foreground">
                You were on page {progress?.current_page} of {TOTAL_PAGES}
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={handleStartFresh}>Start Fresh</Button>
                <Button onClick={handleContinue}>Continue Reading</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-[#0d0a08] to-transparent pb-8 pt-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <X className="h-5 w-5" />
          </Button>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              {currentChapter?.title || 'The Book of LCOVE'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleBookmark}>
              {isPageBookmarked(currentPage) ? (
                <BookmarkCheck className="h-5 w-5 text-primary" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-80 bg-[#1a1512] border-l-primary/20">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-6 py-4">
                    <div>
                      <h3 className="font-serif text-lg mb-3">Chapters</h3>
                      <div className="space-y-2">
                        {BOOK_CHAPTERS.map(ch => (
                          <button
                            key={ch.number}
                            onClick={() => goToPage(ch.startPage)}
                            className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-primary/10 transition-colors ${
                              currentPage >= ch.startPage && currentPage <= ch.endPage ? 'bg-primary/20 text-primary' : ''
                            }`}
                          >
                            <span className="text-muted-foreground mr-2">{ch.number}.</span>
                            {ch.title}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Separator className="bg-primary/20" />

                    <div>
                      <h3 className="font-serif text-lg mb-3 flex items-center gap-2">
                        <Bookmark className="h-4 w-4" /> Bookmarks
                      </h3>
                      {bookmarks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No bookmarks yet</p>
                      ) : (
                        <div className="space-y-2">
                          {bookmarks.map(b => (
                            <button
                              key={b.id}
                              onClick={() => goToPage(b.page_number)}
                              className="w-full text-left px-3 py-2 rounded text-sm hover:bg-primary/10"
                            >
                              Page {b.page_number} {b.title && `- ${b.title}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator className="bg-primary/20" />

                    <div>
                      <h3 className="font-serif text-lg mb-3 flex items-center gap-2">
                        <Star className="h-4 w-4" /> Key Takeaways
                      </h3>
                      {importantHighlights.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Mark passages as important to see them here</p>
                      ) : (
                        <div className="space-y-2">
                          {importantHighlights.slice(0, 5).map(h => (
                            <div key={h.id} className="px-3 py-2 rounded bg-primary/10 text-sm">
                              <p className="line-clamp-2">"{h.highlighted_text}"</p>
                              <p className="text-xs text-muted-foreground mt-1">Page {h.page_number}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-32 px-4 min-h-screen flex items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentPage}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto w-full"
            onMouseUp={handleTextSelection}
          >
            {currentPageData && (
              <article className="space-y-6">
                {currentPageData.chapter && (
                  <p className="text-primary text-sm uppercase tracking-widest text-center">
                    {currentPageData.chapter}
                  </p>
                )}
                
                {currentPageData.title && (
                  <h1 className="text-3xl md:text-4xl font-serif text-center leading-tight">
                    {currentPageData.title}
                  </h1>
                )}

                <div className="space-y-4 font-serif text-lg leading-relaxed text-[#c9c0b5]">
                  {currentPageData.content.map((paragraph, i) => (
                    <p key={i} className={paragraph.startsWith('•') ? 'pl-4' : ''}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#0d0a08] to-transparent pt-8 pb-6 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Progress bar */}
          <div className="h-1 bg-[#2a2520] rounded-full mb-4 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(currentPage / TOTAL_PAGES) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={prevPage} 
              disabled={currentPage <= 1}
              className="gap-2"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <StickyNote className="h-5 w-5" />
                    {pageNotes.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-xs flex items-center justify-center">
                        {pageNotes.length}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#1a1512] border-primary/20">
                  <DialogHeader>
                    <DialogTitle>Notes for Page {currentPage}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="bg-[#0d0a08] border-primary/20"
                    />
                    <Button onClick={handleAddNote} disabled={!noteText.trim()}>
                      Save Note
                    </Button>
                    {pageNotes.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-sm text-muted-foreground">Your notes:</p>
                        {pageNotes.map(note => (
                          <div key={note.id} className="p-3 bg-[#0d0a08] rounded text-sm">
                            {note.note_text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <span className="text-sm text-muted-foreground">
                {currentPage} / {TOTAL_PAGES}
              </span>
            </div>

            <Button 
              variant="ghost" 
              onClick={nextPage} 
              disabled={currentPage >= TOTAL_PAGES}
              className="gap-2"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BookOfLcove;
