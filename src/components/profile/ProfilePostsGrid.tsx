import { motion } from "framer-motion";
import { Play, ImageIcon } from "lucide-react";
import { ProfilePost } from "@/types/post";
import { postsForProfileGrid } from "@/lib/profilePosts";

interface ProfilePostsGridProps {
  posts: ProfilePost[];
  onPostClick: (post: ProfilePost) => void;
  isLoading?: boolean;
  isOwner?: boolean;
}

export function ProfilePostsGrid({ posts, onPostClick, isLoading, isOwner = false }: ProfilePostsGridProps) {
  const mediaPosts = postsForProfileGrid(posts);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (mediaPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
          <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-xl font-medium text-foreground mb-2">
          {isOwner ? "Share Photos" : "No photos yet"}
        </h3>
        <p className="text-muted-foreground text-sm max-w-[250px]">
          {isOwner
            ? "When you share photos, they will appear on your profile."
            : "No photos have been shared on this profile yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {mediaPosts.map((post, index) => (
        <motion.button
          key={post.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          className="aspect-square relative group overflow-hidden bg-muted"
          onClick={() => onPostClick(post)}
        >
          {post.media_url && post.media_type === 'video' ? (
            <>
              <video
                src={post.media_url}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute top-2 right-2">
                <Play className="w-4 h-4 text-white drop-shadow-lg" fill="white" />
              </div>
            </>
          ) : post.media_url ? (
            <img
              src={post.media_url}
              alt={post.content || 'Post'}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-2">
              <p className="text-xs text-foreground line-clamp-4">{post.content}</p>
            </div>
          )}
          
        </motion.button>
      ))}
    </div>
  );
}
