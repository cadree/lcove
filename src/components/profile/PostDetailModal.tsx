import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  MapPin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ProfilePost } from "@/types/post";

interface PostDetailModalProps {
  post: ProfilePost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner?: boolean;
  onDelete?: (postId: string) => void;
}

export function PostDetailModal({ 
  post, 
  open, 
  onOpenChange, 
  isOwner,
  onDelete,
}: PostDetailModalProps) {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [comment, setComment] = useState("");

  if (!post) return null;

  const displayName = post.profile?.display_name || 'Anonymous';
  const avatarUrl = post.profile?.avatar_url;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  const handleProfileClick = () => {
    onOpenChange(false);
    navigate(`/profile/${post.user_id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden max-h-[90vh]">
        <div className="flex flex-col md:flex-row h-full">
          {/* Media Section */}
          <div className="md:w-[60%] bg-black flex items-center justify-center">
            {post.media_type === 'video' ? (
              <video
                src={post.media_url || undefined}
                controls
                autoPlay
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
          <div className="md:w-[40%] flex flex-col bg-background">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={handleProfileClick}>
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
                    className="text-sm font-semibold text-foreground hover:underline"
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
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
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
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
                  </div>
                </div>
              )}

              {/* Comments placeholder */}
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No comments yet.</p>
                <p className="text-muted-foreground text-xs mt-1">Start the conversation.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsLiked(!isLiked)}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Heart 
                      className={cn(
                        "w-6 h-6",
                        isLiked ? "fill-red-500 text-red-500" : "text-foreground"
                      )} 
                    />
                  </button>
                  <button className="hover:opacity-70 transition-opacity">
                    <MessageCircle className="w-6 h-6 text-foreground" />
                  </button>
                  <button className="hover:opacity-70 transition-opacity">
                    <Send className="w-6 h-6 text-foreground" />
                  </button>
                </div>
                <button 
                  onClick={() => setIsSaved(!isSaved)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <Bookmark 
                    className={cn(
                      "w-6 h-6",
                      isSaved ? "fill-foreground" : ""
                    )} 
                  />
                </button>
              </div>

              <p className="text-sm font-semibold mb-1">0 likes</p>
              <p className="text-xs text-muted-foreground mb-3">{timeAgo}</p>

              {/* Comment input */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="flex-1 border-0 focus-visible:ring-0 px-0"
                />
                <Button 
                  variant="ghost" 
                  size="sm"
                  disabled={!comment.trim()}
                  className="text-primary font-semibold"
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
