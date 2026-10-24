import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Menu, Star, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/navigation/BackButton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { callRpc } from '@/lib/rpc';
import { shotSessionEnabled } from '@/lib/shotSession';
import { useBookProgress, useBookmarks, useHighlights, useBookNotes } from '@/hooks/useBookProgress';
import { BOOK_PAGES, BOOK_CHAPTERS, TOTAL_PAGES, getChapterForPage, getPageByNumber } from '@/data/bookOfLcove';
import { toast } from 'sonner';

const BookOfLcove: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [savedPage, setSavedPage] = useState<number | null>(null);
  const [progressChecked, setProgressChecked] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [direction, setDirection] = useState(0);

  const { progress, progressLoading, updateProgress } = useBookProgress();
  const { bookmarks, addBookmark, removeBookmark, isPageBookmarked, getBookmarkForPage } = useBookmarks();
  const { highlights, importantHighlights, addHighlight } = useHighlights();
  const { notes, addNote, getNotesForPage } = useBookNotes();

  const currentPageData = getPageByNumber(currentPage);
  const currentChapter = getChapterForPage(currentPage);
  const pageNotes = getNotesForPage(currentPage);

  // Ask once, after the saved page has loaded, and only if it is past page 1.
  // Saving is held until that decision so the first visit does not overwrite
  // the saved page with page 1.
  useEffect(() => {
    if (!user || shotSessionEnabled()) return;
    callRpc("complete_novi_quest", { p_quest: "read_book" }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (progressLoading || progressChecked) return;
    setProgressChecked(true);
    const page = progress?.current_page ?? 1;
    if (page > 1) {
      setSavedPage(page);
      setShowContinuePrompt(true);
    }
  }, [progress, progressLoading, progressChecked]);

  useEffect(() => {
    if (!user || !progressChecked || showContinuePrompt || currentPage < 1) return;
    updateProgress(currentPage);
  }, [currentPage, user, updateProgress, progressChecked, showContinuePrompt]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= TOTAL_PAGES) {
      setDirection(page > currentPage ? 1 : -1);
      setCurrentPage(page);
    }
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  const handleContinue = () => {
    if (savedPage && savedPage > 1) setCurrentPage(savedPage);
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
          <h1 className="ether-title text-2xl">The Book of LCOVE</h1>
          <p className="text-muted-foreground">Please sign in to read</p>
          <Button onClick={() => navigate('/auth')}>Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
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
              className="file-panel max-w-md space-y-6 p-8 text-center"
            >
              <h2 className="ether-title text-xl">Continue where you left off?</h2>
              <p className="text-muted-foreground">
                You were on page {savedPage} of {TOTAL_PAGES}
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
      <header
        className="tab-bar relative z-40 shrink-0 border-b border-border px-4 pb-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <BackButton label="Back" fallback="/feed" className="shrink-0" />
          
          <div className="min-w-0 flex-1 text-center">
            <p className="mono-label truncate text-[10px] text-muted-foreground">
              {currentChapter?.title || 'The Book of LCOVE'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
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
              <SheetContent className="w-80 border-l border-border bg-card">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-6 py-4">
                    <div>
                      <h3 className="ether-title mb-3 text-lg">Chapters</h3>
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
                      <h3 className="ether-title mb-3 text-lg flex items-center gap-2">
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
                      <h3 className="ether-title mb-3 text-lg flex items-center gap-2">
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
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-6">
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
                  <p className="kicker text-center">
                    {currentPageData.chapter}
                  </p>
                )}
                
                {currentPageData.title && (
                  <h1 className="ether-title text-balance text-center text-2xl leading-tight sm:text-4xl">
                    {currentPageData.title}
                  </h1>
                )}

                <div className="lore space-y-4 text-lg leading-relaxed text-foreground">
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
      <footer
        className="tab-bar relative z-40 shrink-0 border-t border-border px-4 pt-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Progress bar */}
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted">
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
                <DialogContent className="border-border bg-card">
                  <DialogHeader>
                    <DialogTitle>Notes for Page {currentPage}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="border-border bg-background"
                    />
                    <Button onClick={handleAddNote} disabled={!noteText.trim()}>
                      Save Note
                    </Button>
                    {pageNotes.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-sm text-muted-foreground">Your notes:</p>
                        {pageNotes.map(note => (
                          <div key={note.id} className="rounded-[12px] bg-background p-3 text-sm">
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
