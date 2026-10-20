import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image, Video, Mic, X, Loader2, Smile, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageComposerProps {
  onSend: (content?: string, file?: File, mediaType?: 'image' | 'video' | 'audio') => Promise<void>;
  onTyping: () => void;
  isSending: boolean;
}

const EMOJIS = ["😀", "😂", "😍", "🔥", "👏", "🎉", "❤️", "💯", "🙌", "✨", "😭", "🤔", "👀", "💪", "🎬", "🎵"];

const MessageComposer = ({ onSend, onTyping, isSending }: MessageComposerProps) => {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: 'image' | 'video' | 'audio' = 'image';
    if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    setMediaType(type);
    setSelectedFile(file);

    if (type !== 'audio') {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(file.name);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!content.trim() && !selectedFile) return;

    await onSend(
      content.trim() || undefined,
      selectedFile || undefined,
      mediaType || undefined
    );

    setContent('');
    clearFile();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping();
  };

  const insertEmoji = (emoji: string) => {
    const field = textareaRef.current;
    const start = field?.selectionStart ?? content.length;
    const end = field?.selectionEnd ?? content.length;
    const next = `${content.slice(0, start)}${emoji}${content.slice(end)}`;
    setContent(next);
    onTyping();
    requestAnimationFrame(() => {
      field?.focus();
      const caret = start + emoji.length;
      field?.setSelectionRange(caret, caret);
    });
  };

  const pickMedia = (accept: string) => {
    fileInputRef.current?.setAttribute("accept", accept);
    fileInputRef.current?.click();
  };

  return (
    <div 
      className="border-t border-border bg-background p-4"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}
    >
      {/* File Preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-3 relative inline-block"
          >
            {mediaType === 'image' && (
              <img
                src={preview}
                alt="Preview"
                className="max-h-32 rounded-lg object-cover"
              />
            )}
            {mediaType === 'video' && (
              <video
                src={preview}
                className="max-h-32 rounded-lg"
                controls
              />
            )}
            {mediaType === 'audio' && (
              <div className="px-4 py-2 rounded-lg bg-muted flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">{preview}</span>
              </div>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={clearFile}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
            >
              <X className="w-3 h-3" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Send a photo"
            onClick={() => pickMedia("image/*")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Image className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Send a video"
            onClick={() => pickMedia("video/*")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Video className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach a file"
            onClick={() => pickMedia("image/*,video/*,audio/*")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder="Message..."
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="min-h-[44px] max-h-32 resize-none rounded-[14px] border-border bg-input pr-12"
            rows={1}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen((open) => !open)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground w-8 h-8"
          >
            <Smile className="w-5 h-5" />
          </Button>
          {emojiOpen && (
            <div className="absolute bottom-12 right-0 z-10 grid w-56 grid-cols-8 gap-1 rounded-[14px] border border-border bg-popover p-2 text-popover-foreground shadow-md">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-base hover:bg-accent"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={(!content.trim() && !selectedFile) || isSending}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-[14px]"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default MessageComposer;
