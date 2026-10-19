import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";

interface BlogRow {
  id: string;
  user_id: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  author: string;
}

export default function BlogIndex() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-index"],
    queryFn: async (): Promise<BlogRow[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, user_id, title, excerpt, cover_image_url, published_at, created_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((row) => row.user_id))];
      const { data: authors } = ids.length
        ? await supabase.from("profiles_public").select("user_id, display_name").in("user_id", ids)
        : { data: [] };
      const names = new Map((authors ?? []).map((author) => [author.user_id, author.display_name]));
      return rows.map((row) => ({
        ...row,
        author: names.get(row.user_id) || "Member",
      }));
    },
  });

  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl px-4 py-6 pb-28">
        <PageHeader title="Blog" eyebrow="Archive" showBack backPath="/feed" />
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-[16px] bg-muted" />
        ) : posts.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground">No published posts yet.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const when = post.published_at || post.created_at;
              return (
                <Link key={post.id} to={`/blog/${post.id}`} className="file-panel block overflow-hidden">
                  {post.cover_image_url && (
                    <img src={post.cover_image_url} alt="" className="aspect-video w-full object-cover" />
                  )}
                  <span className="block px-4 py-3">
                    <span className="mono-label text-[8px] text-[hsl(var(--brand))]">File</span>
                    <span className="mt-1 block font-body text-[16px] font-extrabold text-foreground">{post.title}</span>
                    <span className="mt-1 block font-body text-sm text-muted-foreground">
                      {post.author}
                      {when ? ` · ${format(new Date(when), "MMMM d, yyyy")}` : ""}
                    </span>
                    {post.excerpt && <span className="mt-2 block font-body text-sm text-foreground">{post.excerpt}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
