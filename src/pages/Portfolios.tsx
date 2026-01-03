import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Folder, User, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

interface PortfolioWithCreator {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
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
  const { data: portfolios, isLoading } = useQuery({
    queryKey: ["community-portfolios"],
    queryFn: async () => {
      // Get all portfolio folders with creator info
      const { data: folders, error } = await supabase
        .from("portfolio_folders")
        .select(`
          id,
          name,
          description,
          cover_image_url,
          user_id,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(folders?.map((f) => f.user_id) || [])];
      
      // Fetch profiles for all users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, city")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));

      return folders?.map((folder) => ({
        ...folder,
        creator: profileMap.get(folder.user_id) || null,
      })) as PortfolioWithCreator[];
    },
  });

  return (
    <PageLayout>
      <PageHeader title="Portfolios" />
      <div className="space-y-6 px-4">
        <p className="text-muted-foreground text-sm px-1">
          Explore creative portfolios from the community
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : portfolios && portfolios.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {portfolios.map((portfolio, index) => (
              <motion.div
                key={portfolio.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link to={`/profile/${portfolio.user_id}`}>
                  <div className="glass rounded-2xl overflow-hidden hover:bg-accent/30 transition-colors group">
                    {/* Cover Image */}
                    <div className="aspect-[4/3] relative bg-accent/20">
                      {portfolio.cover_image_url ? (
                        <img
                          src={portfolio.cover_image_url}
                          alt={portfolio.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Folder className="w-10 h-10 text-muted-foreground/50" />
                        </div>
                      )}
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      
                      {/* Folder name */}
                      <div className="absolute bottom-2 left-2 right-2">
                        <h3 className="text-white font-medium text-sm truncate">
                          {portfolio.name}
                        </h3>
                      </div>
                    </div>

                    {/* Creator Info */}
                    <div className="p-3 flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={portfolio.creator?.avatar_url || undefined} />
                        <AvatarFallback>
                          <User className="w-3 h-3" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {portfolio.creator?.display_name || "Creator"}
                        </p>
                        {portfolio.creator?.city && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {portfolio.creator.city}
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
            icon={Folder}
            title="No portfolios yet"
            description="Be the first to create a portfolio folder on your profile!"
          />
        )}
      </div>
    </PageLayout>
  );
};

export default Portfolios;
