import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

interface CommentThreadProps {
  comments: Comment[];
  onAddComment: (content: string, parentId?: string) => void;
  onDeleteComment: (commentId: string) => void;
  isCommenting: boolean;
}

const CommentItem = ({
  comment,
  onReply,
  onDelete,
  depth = 0,
}: {
  comment: Comment;
  onReply: (parentId: string) => void;
  onDelete: (commentId: string) => void;
  depth?: number;
}) => {
  const { user } = useAuth();
  const [showReplies, setShowReplies] = useState(depth === 0);
  const isOwner = user?.id === comment.user_id;
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`${depth > 0 ? 'ml-8 pl-4 border-l border-border/30' : ''}`}
    >
      <div className="flex gap-3 py-3">
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarImage src={comment.profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
            {comment.profile?.display_name?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">
              {comment.profile?.display_name || 'User'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          
          <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          <div className="flex items-center gap-3 mt-2">
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReply(comment.id)}
                className="text-muted-foreground hover:text-foreground h-auto py-1 px-2 text-xs"
              >
                <Reply className="w-3 h-3 mr-1" />
                Reply
              </Button>
            )}
            
            {hasReplies && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplies(!showReplies)}
                className="text-muted-foreground hover:text-foreground h-auto py-1 px-2 text-xs"
              >
                {showReplies ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Hide replies
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
                  </>
                )}
              </Button>
            )}

            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(comment.id)}
                className="text-muted-foreground hover:text-destructive h-auto py-1 px-2 text-xs"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      <AnimatePresence>
        {showReplies && hasReplies && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {comment.replies!.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onReply={onReply}
                onDelete={onDelete}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CommentThread = ({
  comments,
  onAddComment,
  onDeleteComment,
  isCommenting,
}: CommentThreadProps) => {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim(), replyingTo || undefined);
    setNewComment('');
    setReplyingTo(null);
  };

  const handleReply = (parentId: string) => {
    setReplyingTo(parentId);
  };

  const replyingToComment = replyingTo
    ? comments.find(c => c.id === replyingTo) ||
      comments.flatMap(c => c.replies || []).find(r => r.id === replyingTo)
    : null;

  return (
    <div className="space-y-2">
      {/* Comment Input */}
      {user && (
        <div className="space-y-2">
          {replyingTo && replyingToComment && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Replying to</span>
              <span className="font-medium text-foreground">
                {replyingToComment.profile?.display_name || 'User'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(null)}
                className="h-auto py-0.5 px-1.5 text-xs"
              >
                Cancel
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <Textarea
              placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[60px] resize-none bg-muted/30 border-border/50 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />
          </div>
          
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isCommenting}
            >
              {isCommenting ? 'Posting...' : replyingTo ? 'Reply' : 'Comment'}
            </Button>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onDelete={onDeleteComment}
            />
          ))}
        </AnimatePresence>

        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No comments yet. Be the first to share your thoughts!
          </p>
        )}
      </div>
    </div>
  );
};

export default CommentThread;
