import { motion } from "framer-motion";
import { FileText, Eye, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SquircleIcon } from "@/components/world/SquircleIcon";
import { Badge } from "@/components/ui/badge";
import { BlogPost } from "@/hooks/useProfileBlogs";

interface ProfileBlogsGridProps {
  blogs: BlogPost[];
  onBlogClick: (blog: BlogPost) => void;
  isLoading?: boolean;
  isOwner?: boolean;
}

export function ProfileBlogsGrid({ blogs, onBlogClick, isLoading, isOwner }: ProfileBlogsGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (blogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <SquircleIcon icon={FileText} fill="bone" size={52} className="mb-4" />
        <h3 className="ether-title mb-2 text-xl text-foreground">Write Your Story</h3>
        <p className="text-muted-foreground text-sm max-w-[250px]">
          Share your thoughts, experiences, and creative process.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blogs.map((blog, index) => (
        <motion.button
          key={blog.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="file-panel w-full overflow-hidden text-left transition-colors hover:border-[hsl(var(--scan))]"
          onClick={() => onBlogClick(blog)}
        >
          <div className="flex">
            {/* Cover image */}
            {blog.cover_image_url && (
              <div className="w-32 h-32 flex-shrink-0">
                <img 
                  src={blog.cover_image_url} 
                  alt={blog.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {/* Content */}
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="ether-title line-clamp-1 text-lg text-foreground">
                  {blog.title}
                </h3>
                {isOwner && !blog.is_published && (
                  <Badge variant="secondary" className="flex-shrink-0">
                    Draft
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {blog.excerpt || blog.content.slice(0, 150)}
              </p>
              
              <div className="mono-label flex items-center gap-4 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDistanceToNow(new Date(blog.created_at), { addSuffix: true })}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {blog.is_published ? 'Published' : 'Draft'}
                </span>
              </div>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
