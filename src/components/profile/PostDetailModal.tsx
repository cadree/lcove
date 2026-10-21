import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  MapPin,
  Trash2,
  Edit,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ProfilePost } from "@/types/post";
import { usePostInteractions } from "@/hooks/usePostInteractions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShareSheet } from "@/components/share/ShareSheet";
import { useOwnPostViewCounts } from "@/hooks/usePostViews";
import { useSharingActions } from "@/hooks/useSharing";
import { ownerOnlyInsight, repostedByLabel, shouldRecordPostView } from "@/lib/sharing";
import { supabase } from "@/integrations/supabase/client";
import { EmbedPlayer } from "@/components/feed/EmbedPlayer";
import { embedFromPost } from "@/lib/videoEmbed";

interface PostDetailModalProps {
  post: ProfilePost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner?: boolean;
  onDelete?: (postId: string) => void;
  onEdit?: (post: ProfilePost) => void;
}

export function PostDetailModal({ 
  post, 
  open, 
  onOpenChange, 
  onDelete,
  onEdit,
}: PostDetailModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const ownsPost = !!user && user.id === post?.user_id;
  const viewCounts = useOwnPostViewCounts(ownsPost);
  const { undoRepost } = useSharingActions();

  // Use the real interactions hook
  const {
    likesCount,
    hasLiked,
    comments,
    isSaved,
    toggleLike,
    addComment,
    toggleSave,
    isLiking,
    isCommenting,
    isSaving,
  } = usePostInteractions(post?.id || "");

  useEffect(() => {
    if (!open || !post || !shouldRecordPostView(user?.id, post.user_id)) return;
    void supabase.rpc('record_post_view', { p_post_id: post.id });
  }, [open, post, user?.id]);

  if (!post) return null;

  const insight = ownerOnlyInsight(ownsPost, viewCounts?.[post.id], likesCount);
  const embed = embedFromPost(post);
  const displayName = post.profile?.display_name || 'Anonymous';
  const avatarUrl = post.profile?.avatar_url;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  const handleProfileClick = () => {
    onOpenChange(false);
    navigate(`/profile/${post.user_id}`);
  };

  const handleDelete = () => {
    if (onDelete && post.id) {
      onDelete(post.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(post);
    }
  };

  const handleLike = () => {
    if (!user) {
      toast.error("Please sign in to like posts");
      return;
    }
    toggleLike();
  };

  const handleSave = () => {
    if (!user) {
      toast.error("Please sign in to save posts");
      return;
    }
    toggleSave();
  };

  const handlePostComment = () => {
    if (!user) {
      toast.error("Please sign in to comment");
      return;
    }
    if (!comment.trim()) return;
    addComment(comment.trim());
    setComment("");
  };

  const handleShare = () => {
    setShareOpen(true);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] w-full max-w-4xl gap-0 overflow-hidden border-border bg-card p-0">
          <VisuallyHidden>
            <DialogTitle>Post by {displayName}</DialogTitle>
          </VisuallyHidden>
          
          {/* Close button - always visible */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute right-3 top-3 z-50 h-11 w-11 rounded-[14px] bg-background/80 backdrop-blur-sm hover:bg-background"
            aria-label="Close post"
            role="button"
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="flex flex-col md:flex-row h-full">
            {/* Media Section */}
            <div className="md:w-[60%] bg-black flex items-center justify-center relative">
              {embed ? (
                <EmbedPlayer embed={embed} title={post.embed_title || post.content} className="max-h-[60vh] md:max-h-[80vh]" />
              ) : post.media_type === 'video' ? (
                <video
                  src={post.media_url || undefined}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-[60vh] md:max-h-[80vh] object-contain"
                />
              ) : (
                <img
                  src={post.media_url || undefined}
                  alt={post.content || 'Post'}
                  className="max-w-full max-h-[60vh] md:max-h-[80vh] object-contain"
                />
              )}
            </div>

            {/* Details Section */}
            <div className="flex flex-col bg-card md:w-[40%]">
              {post.repost && (
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
                  <button
                    type="button"
                    className="min-h-11 text-left text-sm text-muted-foreground"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/profile/${post.repost?.user_id}`);
                    }}
                  >
                    {repostedByLabel(post.repost.profile?.display_name)}
                  </button>
                  {user?.id === post.repost.user_id && (
                    <Button variant="ghost" size="sm" onClick={() => undoRepost.mutate(post.id)}>
                      Undo repost
                    </Button>
                  )}
                </div>
              )}
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleProfileClick}
                    role="button"
                    aria-label={`View ${displayName}'s profile`}
                  >
                    <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div>
                    <button 
                      onClick={handleProfileClick}
                      className="font-body text-sm font-bold text-foreground hover:underline"
                      role="button"
                    >
                      {displayName}
                    </button>
                    {post.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {post.location}
                      </p>
                    )}
                  </div>
                </div>
                
                {ownsPost ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-11 w-11"
                        aria-label="Post options"
                        role="button"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem onClick={handleEdit} className="cursor-pointer" role="menuitem">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Post
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteConfirm(true)} 
                        className="cursor-pointer text-destructive focus:text-destructive"
                        role="menuitem"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-11 w-11"
                    aria-label="More options"
                    role="button"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Content / Comments Area */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Original post caption */}
                {post.content && (
                  <div className="flex gap-3 mb-4">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm">
                        <span className="font-semibold mr-1">{displayName}</span>
                        {post.content}
                      </p>
                      <p className="mono-label mt-1 text-[9px] text-muted-foreground">{timeAgo}</p>
                    </div>
                  </div>
                )}

                {/* Comments */}
                {comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={c.profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {(c.profile?.display_name || 'A').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm">
                            <span className="font-semibold mr-1">{c.profile?.display_name || 'Anonymous'}</span>
                            {c.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">No comments yet.</p>
                    <p className="text-muted-foreground text-xs mt-1">Start the conversation.</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handleLike}
                      disabled={isLiking}
                      className="min-h-11 min-w-11 flex items-center justify-center hover:opacity-70 transition-opacity disabled:opacity-50"
                      aria-label={hasLiked ? "Unlike post" : "Like post"}
                      role="button"
                    >
                      <Heart 
                        className={cn(
                          "w-6 h-6",
                          hasLiked ? "fill-[#FF9FC8] text-[#FF9FC8]" : "text-foreground"
                        )} 
                      />
                    </button>
                    <button 
                      className="min-h-11 min-w-11 flex items-center justify-center hover:opacity-70 transition-opacity"
                      aria-label="View comments"
                      role="button"
                    >
                      <MessageCircle className="w-6 h-6 text-foreground" />
                    </button>
                    <button 
                      onClick={handleShare}
                      className="min-h-11 min-w-11 flex items-center justify-center hover:opacity-70 transition-opacity"
                      aria-label="Share post"
                      role="button"
                    >
                      <Send className="w-6 h-6 text-foreground" />
                    </button>
                  </div>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="min-h-11 min-w-11 flex items-center justify-center hover:opacity-70 transition-opacity disabled:opacity-50"
                    aria-label={isSaved ? "Unsave post" : "Save post"}
                    role="button"
                  >
                    <Bookmark 
                      className={cn(
                        "w-6 h-6",
                        isSaved ? "fill-foreground" : ""
                      )} 
                    />
                  </button>
                </div>

                {insight && (
                  <p className="text-xs text-muted-foreground mb-1">{insight}</p>
                )}
                <p className="mono-label mb-3 text-[9px] text-muted-foreground">{timeAgo}</p>

                {/* Comment input */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                    className="flex-1 border-0 focus-visible:ring-0 px-0"
                    aria-label="Add a comment"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handlePostComment}
                    disabled={!comment.trim() || isCommenting}
                    className="min-h-11 font-semibold text-primary"
                    role="button"
                  >
                    {isCommenting ? 'Posting...' : 'Post'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel role="button">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              role="button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        target={{
          kind: 'post',
          post: {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            media_url: post.media_url,
            media_type: post.media_type,
            profile: post.profile,
          },
        }}
      />
    </>
  );
}
