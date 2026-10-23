import { useState, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Link2, Video, X, Loader2, Send } from 'lucide-react';
import { usePosts } from '@/hooks/usePosts';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { VideoLinkField } from '@/components/feed/VideoLinkField';
import { InlineError } from '@/components/ui/inline-error';
import { writeError } from '@/lib/writeError';
import { assertCleanText } from '@/lib/objectionableText';
import type { EmbedDraft } from '@/lib/videoEmbed';
interface PostCreatorProps {
  avatarUrl?: string | null;
  displayName?: string | null;
}
const PostCreator = ({
  avatarUrl,
  displayName
}: PostCreatorProps) => {
  const {
    user
  } = useAuth();
  const {
    createPost
  } = usePosts();
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'text'>('text');
  const [isExpanded, setIsExpanded] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [embed, setEmbed] = useState<EmbedDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  if (!user) return null;
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaType(type);
    setSelectedFile(file);
    setLinkUrl('');
    setEmbed(null);
    setIsExpanded(true);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Reset input value so the same file can be selected again
    e.target.value = '';
  };
  const handleSubmit = async () => {
    if (!content.trim() && !selectedFile && !embed) return;
    setError(null);
    try {
      assertCleanText(content);
      await createPost.mutateAsync({
        content: content.trim() || undefined,
        file: embed ? undefined : selectedFile || undefined,
        mediaType: embed ? 'video' : mediaType,
        embed: embed ?? undefined,
        inlineError: true,
      });
    } catch (err) {
      setError(writeError(err, 'Failed to create post'));
      return;
    }

    setContent('');
    setSelectedFile(null);
    setPreview(null);
    setMediaType('text');
    setLinkUrl('');
    setEmbed(null);
    setError(null);
    setIsExpanded(false);
  };
  const clearMedia = () => {
    setSelectedFile(null);
    setPreview(null);
    setMediaType('text');
  };
  return <motion.div layout className="glass-strong p-4 mb-6 rounded-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="w-10 h-10 border-2 border-border">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground">
            {displayName?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <Textarea placeholder="What's on your mind?" value={content} onChange={e => {
          setContent(e.target.value);
          setError(null);
          if (e.target.value.length > 0) setIsExpanded(true);
        }} onFocus={() => setIsExpanded(true)} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} className="min-h-[60px] resize-none bg-transparent border-none text-foreground placeholder:text-muted-foreground focus-visible:ring-0 px-4 py-2" />
          <InlineError id={errorId} message={error} />
        </div>
      </div>

      {/* Media Preview */}
      <AnimatePresence>
        {preview && <motion.div initial={{
        opacity: 0,
        height: 0
      }} animate={{
        opacity: 1,
        height: 'auto'
      }} exit={{
        opacity: 0,
        height: 0
      }} className="mt-4 relative rounded-xl overflow-hidden">
            {mediaType === 'video' ? <video src={preview} className="w-full max-h-[300px] object-cover rounded-xl" autoPlay loop muted playsInline /> : <img src={preview} alt="Preview" className="w-full max-h-[300px] object-cover rounded-xl" />}
            <Button variant="glass" size="icon" onClick={clearMedia} className="absolute top-2 right-2">
              <X className="w-4 h-4" />
            </Button>
          </motion.div>}
      </AnimatePresence>

      {(isExpanded || linkUrl || embed) && (
        <div className="mt-4">
          <VideoLinkField
            url={linkUrl}
            onUrlChange={(value) => {
              setLinkUrl(value);
              if (value.trim()) {
                setSelectedFile(null);
                setPreview(null);
                setMediaType('video');
                setIsExpanded(true);
              }
            }}
            onDraft={setEmbed}
          />
        </div>
      )}

      {/* Actions - Always visible */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => photoInputRef.current?.click()} className="text-muted-foreground hover:text-foreground gap-2 min-h-11">
            <Image className="w-4 h-4" />
            Photo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()} className="text-muted-foreground hover:text-foreground gap-2 min-h-11">
            <Video className="w-4 h-4" />
            Video
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(true)} className="text-muted-foreground hover:text-foreground gap-2 min-h-11">
            <Link2 className="w-4 h-4" />
            Link
          </Button>
        </div>

        <AnimatePresence>
          {(isExpanded || content.trim() || selectedFile || linkUrl || embed) && <motion.div initial={{
          opacity: 0,
          scale: 0.9
        }} animate={{
          opacity: 1,
          scale: 1
        }} exit={{
          opacity: 0,
          scale: 0.9
        }}>
              <Button onClick={handleSubmit} disabled={(!content.trim() && !selectedFile && !embed) || createPost.isPending} size="sm" className="gap-2">
                {createPost.isPending ? <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Posting...
                  </> : <>
                    <Send className="w-4 h-4" />
                    Post
                  </>}
              </Button>
            </motion.div>}
        </AnimatePresence>
      </div>

      {/* Separate file inputs for photo and video */}
      <input ref={photoInputRef} type="file" accept="image/*" onChange={e => handleFileSelect(e, 'photo')} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={e => handleFileSelect(e, 'video')} className="hidden" />
    </motion.div>;
};
export default PostCreator;