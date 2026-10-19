import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function BlogPostPage() {
  const { blogId } = useParams<{ blogId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["blog-post", blogId],
    enabled: !!blogId,
    queryFn: async () => {
      const { data: post, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", blogId!)
        .maybeSingle();
      if (error) throw error;
      if (!post) return null;
      const { data: author } = await supabase
        .from("profiles_public")
        .select("display_name, avatar_url, user_id")
        .eq("user_id", post.user_id)
        .maybeSingle();
      return { post, author };
    },
  });

  const post = data?.post;
  const hidden = post && !post.is_published && post.user_id !== user?.id;
  const authorName = data?.author?.display_name || "Member";
  const when = post?.published_at || post?.created_at;

  return (
    <PageLayout>
      <article className="mx-auto max-w-2xl px-4 py-6 pb-28">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-2"
          onClick={() => {
            const index = window.history.state?.idx;
            if (typeof index === "number" && index > 0) navigate(-1);
            else if (post) navigate(`/profile/${post.user_id}`);
            else navigate("/feed");
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        ) : isError || !post || hidden ? (
          <div className="space-y-3 text-center">
            <h1 className="ether-title text-2xl">Post unavailable</h1>
            <Button asChild variant="outline">
              <Link to="/feed">Go home</Link>
            </Button>
          </div>
        ) : (
          <div className="file-panel space-y-4 p-4 sm:p-6">
            {post.cover_image_url && (
              <img
                src={post.cover_image_url}
                alt=""
                className="aspect-video w-full object-cover"
              />
            )}
            <p className="kicker">Blog</p>
            <h1 className="ether-title text-3xl leading-tight text-foreground">{post.title}</h1>
            <p className="font-body text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{authorName}</span>
              {when ? ` · ${format(new Date(when), "MMMM d, yyyy")}` : ""}
            </p>
            <div className="space-y-4 text-base leading-relaxed text-foreground">
              {(post.content || "").split("\n").map((paragraph, index) => (
                <p key={index}>{paragraph || "\u00a0"}</p>
              ))}
            </div>
          </div>
        )}
      </article>
    </PageLayout>
  );
}
