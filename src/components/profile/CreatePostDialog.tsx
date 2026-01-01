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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Image,
  Video,
  X,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Users,
  Accessibility,
  Settings,
  Smile,
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePost: (data: {
    content?: string;
    file?: File;
    files?: File[];
    mediaType?: 'photo' | 'video' | 'text' | 'collage';
    location?: string;
    altText?: string;
    commentsEnabled?: boolean;
  }) => Promise<void>;
  userAvatar?: string | null;
  userName?: string | null;
}

const STEPS = ['upload', 'preview', 'caption', 'metadata', 'publish'] as const;
type Step = typeof STEPS[number];

const MAX_CAPTION_LENGTH = 2200;
const MAX_COLLAGE_IMAGES = 10;

export function CreatePostDialog({
  open,
  onOpenChange,
  onCreatePost,
  userAvatar,
  userName,
}: CreatePostDialogProps) {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'collage' | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [altText, setAltText] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const multiImageInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setCurrentStep('upload');
    setSelectedFiles([]);
    setMediaPreviews([]);
    setMediaType(null);
    setCurrentPreviewIndex(0);
    setCaption("");
    setLocation("");
    setAltText("");
    setCommentsEnabled(true);
    setIsSubmitting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFiles([file]);
    setMediaType(type);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreviews([reader.result as string]);
      setCurrentStep('preview');
    };
    reader.readAsDataURL(file);
  };

  const handleMultiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_COLLAGE_IMAGES);
    if (files.length === 0) return;

    setSelectedFiles(files);
    setMediaType(files.length > 1 ? 'collage' : 'photo');

    const previews: string[] = [];
    let loadedCount = 0;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews[index] = reader.result as string;
        loadedCount++;
        if (loadedCount === files.length) {
          setMediaPreviews(previews);
          setCurrentStep('preview');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddMoreImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const totalFiles = [...selectedFiles, ...newFiles].slice(0, MAX_COLLAGE_IMAGES);
    
    if (totalFiles.length === selectedFiles.length) return;

    const newFilesToAdd = totalFiles.slice(selectedFiles.length);
    
    newFilesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreviews(prev => [...prev, reader.result as string].slice(0, MAX_COLLAGE_IMAGES));
      };
      reader.readAsDataURL(file);
    });

    setSelectedFiles(totalFiles);
    if (totalFiles.length > 1) {
      setMediaType('collage');
    }
  };

  const handleRemoveImage = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = mediaPreviews.filter((_, i) => i !== index);
    
    setSelectedFiles(newFiles);
    setMediaPreviews(newPreviews);
    
    if (newFiles.length === 0) {
      setMediaType(null);
      setCurrentStep('upload');
    } else if (newFiles.length === 1) {
      setMediaType('photo');
    }
    
    if (currentPreviewIndex >= newPreviews.length) {
      setCurrentPreviewIndex(Math.max(0, newPreviews.length - 1));
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      await onCreatePost({
        content: caption || undefined,
        file: selectedFiles[0] || undefined,
        files: selectedFiles.length > 1 ? selectedFiles : undefined,
        mediaType: mediaType || 'text',
        location: location || undefined,
        altText: altText || undefined,
        commentsEnabled,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload': return 'Create new post';
      case 'preview': return mediaPreviews.length > 1 ? `Preview (${currentPreviewIndex + 1}/${mediaPreviews.length})` : 'Preview';
      case 'caption': return 'Write a caption';
      case 'metadata': return 'Add details';
      case 'publish': return 'Share';
      default: return 'Create new post';
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'upload': return selectedFiles.length > 0;
      case 'preview': return true;
      case 'caption': return true;
      case 'metadata': return true;
      case 'publish': return true;
      default: return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 overflow-hidden max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStep !== 'upload' && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="text-base font-medium">{getStepTitle()}</DialogTitle>
          </div>
          {currentStep !== 'upload' && currentStep !== 'publish' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleNext}
              disabled={!canProceed()}
              className="text-primary font-semibold"
            >
              Next
            </Button>
          )}
          {currentStep === 'publish' && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handlePublish}
              disabled={isSubmitting}
              className="font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                'Share'
              )}
            </Button>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Upload */}
            {currentStep === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 flex flex-col items-center justify-center min-h-[400px]"
              >
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
                  <Image className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium text-foreground mb-2">
                  Drag photos and videos here
                </h3>
                <p className="text-muted-foreground text-sm mb-6 text-center">
                  Share your creative work with the community
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <Button onClick={() => imageInputRef.current?.click()} className="w-full">
                    <Image className="w-4 h-4 mr-2" />
                    Select Photo
                  </Button>
                  <Button variant="outline" onClick={() => multiImageInputRef.current?.click()} className="w-full">
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Create Collage (Multiple Photos)
                  </Button>
                  <Button variant="outline" onClick={() => videoInputRef.current?.click()} className="w-full">
                    <Video className="w-4 h-4 mr-2" />
                    Select Video
                  </Button>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'photo')}
                  className="hidden"
                />
                <input
                  ref={multiImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultiFileSelect}
                  className="hidden"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileSelect(e, 'video')}
                  className="hidden"
                />
              </motion.div>
            )}

            {/* Step 2: Preview */}
            {currentStep === 'preview' && mediaPreviews.length > 0 && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative"
              >
                <div className="aspect-square bg-black flex items-center justify-center overflow-hidden relative">
                  {mediaType === 'video' ? (
                    <video 
                      src={mediaPreviews[0]} 
                      controls 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img 
                      src={mediaPreviews[currentPreviewIndex]} 
                      alt="Preview" 
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* Navigation arrows for collage */}
                  {mediaPreviews.length > 1 && (
                    <>
                      {currentPreviewIndex > 0 && (
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80"
                          onClick={() => setCurrentPreviewIndex(prev => prev - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                      )}
                      {currentPreviewIndex < mediaPreviews.length - 1 && (
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80"
                          onClick={() => setCurrentPreviewIndex(prev => prev + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}

                  {/* Dots indicator */}
                  {mediaPreviews.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {mediaPreviews.map((_, index) => (
                        <button
                          key={index}
                          className={cn(
                            "w-2 h-2 rounded-full transition-colors",
                            index === currentPreviewIndex ? "bg-primary" : "bg-white/50"
                          )}
                          onClick={() => setCurrentPreviewIndex(index)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Remove current image button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                  onClick={() => handleRemoveImage(currentPreviewIndex)}
                >
                  <X className="w-4 h-4" />
                </Button>

                {/* Thumbnail strip for collage */}
                {mediaPreviews.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto bg-muted/30">
                    {mediaPreviews.map((preview, index) => (
                      <button
                        key={index}
                        className={cn(
                          "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors relative group",
                          index === currentPreviewIndex ? "border-primary" : "border-transparent"
                        )}
                        onClick={() => setCurrentPreviewIndex(index)}
                      >
                        <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(index);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </button>
                    ))}
                    {selectedFiles.length < MAX_COLLAGE_IMAGES && (
                      <label className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors flex-shrink-0">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleAddMoreImages}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Caption */}
            {currentStep === 'caption' && (
              <motion.div
                key="caption"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-4"
              >
                {/* Mini preview */}
                {mediaPreviews.length > 0 && (
                  <div className="flex items-start gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
                      {mediaType === 'video' ? (
                        <video src={mediaPreviews[0]} className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaPreviews[0]} alt="Preview" className="w-full h-full object-cover" />
                      )}
                      {mediaPreviews.length > 1 && (
                        <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                          +{mediaPreviews.length - 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">
                        {selectedFiles[0]?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {mediaType === 'collage' ? `${mediaPreviews.length} photos` : mediaType === 'photo' ? 'Photo' : 'Video'}
                      </p>
                    </div>
                  </div>
                )}

                {/* User info */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={userAvatar || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {userName?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">{userName || 'You'}</span>
                </div>

                {/* Caption input */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Write a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LENGTH))}
                    className="min-h-[150px] resize-none border-0 focus-visible:ring-0 p-0 text-base"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <Smile className="w-4 h-4" />
                    </Button>
                    <span className={cn(
                      caption.length > MAX_CAPTION_LENGTH * 0.9 && "text-amber-500",
                      caption.length >= MAX_CAPTION_LENGTH && "text-destructive"
                    )}>
                      {caption.length}/{MAX_CAPTION_LENGTH}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  Use @mentions to tag people and #hashtags to categorize your post
                </p>
              </motion.div>
            )}

            {/* Step 4: Metadata */}
            {currentStep === 'metadata' && (
              <motion.div
                key="metadata"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-4 space-y-4"
              >
                {/* Location */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    Add location
                  </Label>
                  <Input
                    placeholder="Add location..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                {/* Collaborators placeholder */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Tag collaborators
                  </Label>
                  <Input placeholder="Search for collaborators..." disabled />
                  <p className="text-xs text-muted-foreground">
                    Coming soon: Tag collaborators to feature the post on their profiles too
                  </p>
                </div>

                {/* Accessibility */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Accessibility className="w-4 h-4 text-muted-foreground" />
                    Accessibility
                  </Label>
                  <Textarea
                    placeholder="Write alt text for your media..."
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Alt text describes your photos for people with visual impairments
                  </p>
                </div>

                {/* Advanced settings */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Advanced settings
                  </Label>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Allow comments</p>
                      <p className="text-xs text-muted-foreground">
                        People can comment on this post
                      </p>
                    </div>
                    <Switch
                      checked={commentsEnabled}
                      onCheckedChange={setCommentsEnabled}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 5: Publish */}
            {currentStep === 'publish' && (
              <motion.div
                key="publish"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-4"
              >
                {/* Final preview */}
                <div className="rounded-lg overflow-hidden border border-border mb-4">
                  {/* Header */}
                  <div className="p-3 flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={userAvatar || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {userName?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{userName || 'You'}</p>
                      {location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {location}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Media */}
                  {mediaPreviews.length > 0 && (
                    <div className="aspect-square bg-black relative">
                      {mediaType === 'video' ? (
                        <video src={mediaPreviews[0]} controls className="w-full h-full object-contain" />
                      ) : (
                        <>
                          <img src={mediaPreviews[currentPreviewIndex]} alt="Preview" className="w-full h-full object-contain" />
                          {mediaPreviews.length > 1 && (
                            <>
                              {currentPreviewIndex > 0 && (
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80"
                                  onClick={() => setCurrentPreviewIndex(prev => prev - 1)}
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </Button>
                              )}
                              {currentPreviewIndex < mediaPreviews.length - 1 && (
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80"
                                  onClick={() => setCurrentPreviewIndex(prev => prev + 1)}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              )}
                              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                {mediaPreviews.map((_, index) => (
                                  <button
                                    key={index}
                                    className={cn(
                                      "w-2 h-2 rounded-full transition-colors",
                                      index === currentPreviewIndex ? "bg-primary" : "bg-white/50"
                                    )}
                                    onClick={() => setCurrentPreviewIndex(index)}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Caption preview */}
                  {caption && (
                    <div className="p-3">
                      <p className="text-sm text-foreground">
                        <span className="font-medium mr-1">{userName || 'You'}</span>
                        {caption.length > 100 ? `${caption.slice(0, 100)}...` : caption}
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  Your post will be shared with the community
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}