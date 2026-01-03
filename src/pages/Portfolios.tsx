import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Image, User, Loader2, Play } from "lucide-react";
import { Link } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

interface PortfolioPost {
  id: string;
  media_url: string | null;
  media_type: string;
  content: string | null;
  user_id: string;
  created_at: string;
  creator: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
}

const Portfolios = () => {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["community-portfolio-posts"],
    queryFn: async () => {
      // Get portfolio posts from all users
      const { data: portfolioPosts, error } = await supabase
        .from("posts")
        .select("id, media_url, media_type, content, user_id, created_at")
        .eq("post_type", "portfolio")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(portfolioPosts?.map((p) => p.user_id) || [])];
      
      if (userIds.length === 0) return [];

      // Fetch profiles for all users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, city")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));

      return portfolioPosts?.map((post) => ({
        ...post,
        creator: profileMap.get(post.user_id) || null,
      })) as PortfolioPost[];
    },
  });

  return (
    <PageLayout>
      <PageHeader title="Portfolios" />
      <div className="space-y-6 px-4">
        <p className="text-muted-foreground text-sm px-1">
          Explore creative work from the community
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link to={`/profile/${post.user_id}`}>
                  <div className="glass rounded-2xl overflow-hidden hover:bg-accent/30 transition-colors group">
                    {/* Media */}
                    <div className="aspect-square relative bg-accent/20">
                      {post.media_url ? (
                        post.media_type === "video" ? (
                          <>
                            <video
                              src={post.media_url}
                              className="absolute inset-0 w-full h-full object-cover"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                                <Play className="w-5 h-5 text-white fill-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img
                            src={post.media_url}
                            alt="Portfolio work"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Image className="w-10 h-10 text-muted-foreground/50" />
                        </div>
                      )}
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Creator Info */}
                    <div className="p-3 flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={post.creator?.avatar_url || undefined} />
                        <AvatarFallback>
                          <User className="w-3 h-3" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {post.creator?.display_name || "Creator"}
                        </p>
                        {post.creator?.city && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {post.creator.city}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Image}
            title="No portfolio work yet"
            description="Be the first to share your creative work!"
          />
        )}
      </div>
    </PageLayout>
  );
};

export default Portfolios;
