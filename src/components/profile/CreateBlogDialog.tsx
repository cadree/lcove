import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Image,
  X,
  Loader2,
  FileText,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateBlogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateBlog: (data: {
    title: string;
    content: string;
    coverImage?: File;
    excerpt?: string;
    isPublished?: boolean;
  }) => Promise<void>;
}

export function CreateBlogDialog({
  open,
  onOpenChange,
  onCreateBlog,
}: CreateBlogDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setExcerpt("");
    setCoverImage(null);
    setCoverPreview(null);
    setIsPublished(false);
    setIsSubmitting(false);
    setShowPreview(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async () => {
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateBlog({
        title: title.trim(),
        content: content.trim(),
        coverImage: coverImage || undefined,
        excerpt: excerpt.trim() || undefined,
        isPublished,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to create blog:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPublish = title.trim() && content.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base font-medium">
              {showPreview ? 'Preview' : 'Write a Blog'}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="w-4 h-4 mr-2" />
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handlePublish}
              disabled={!canPublish || isSubmitting}
              className="font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                isPublished ? 'Publish' : 'Save Draft'
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <AnimatePresence mode="wait">
            {showPreview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                {/* Cover image preview */}
                {coverPreview && (
                  <div className="aspect-video mb-6 rounded-lg overflow-hidden">
                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                  </div>
                )}
                
                <h1 className="font-display text-3xl font-bold text-foreground mb-4">
                  {title || 'Untitled'}
                </h1>
                
                <div className="prose prose-invert max-w-none">
                  {content.split('\n').map((paragraph, i) => (
                    <p key={i} className="text-muted-foreground mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="edit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-6"
              >
                {/* Cover Image */}
                <div className="space-y-2">
                  <Label>Cover Image (optional)</Label>
                  {coverPreview ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden">
                      <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                        onClick={() => {
                          setCoverImage(null);
                          setCoverPreview(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full aspect-video border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
                    >
                      <Image className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Add cover image</span>
                    </button>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Your blog title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-display"
                  />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Write your blog content here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[300px] resize-none"
                  />
                </div>

                {/* Excerpt */}
                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt (optional)</Label>
                  <Textarea
                    id="excerpt"
                    placeholder="Brief summary for previews..."
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate from content
                  </p>
                </div>

                {/* Publish toggle */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-sm font-medium">Publish immediately</p>
                    <p className="text-xs text-muted-foreground">
                      {isPublished ? 'Blog will be visible to everyone' : 'Save as draft'}
                    </p>
                  </div>
                  <Switch
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
