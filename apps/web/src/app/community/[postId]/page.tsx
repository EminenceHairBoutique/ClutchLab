import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { toggleReactionAction } from "@/app/community/actions";
import { CommentForm } from "@/components/community/comment-form";
import { ReportForm } from "@/components/community/report-form";
import { getSessionUser } from "@/lib/auth/gateway";
import { getCommunityStore } from "@/lib/data/community-store";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Post" };

export const dynamic = "force-dynamic";

const REACTION_LABEL: Record<string, string> = {
  like: "👍 Like",
  insightful: "💡 Insightful",
  tested_it: "🧪 Tested it",
};

interface PostPageProps {
  params: Promise<{ postId: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const user = await getSessionUser();
  const { postId } = await params;
  const post = await getCommunityStore().getPost(postId, user?.id ?? null);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/community" className="hover:text-accent">Community</Link> / {post.title}
      </nav>

      {post.status === "flagged" && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          Held for moderator review{post.autoFlagReason ? ` — ${post.autoFlagReason}` : ""}. Only
          you can see it right now.
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{post.kind.replace("_", " ")}</Badge>
            <CardTitle>{post.title}</CardTitle>
          </div>
          <p className="text-xs text-faint">
            {post.authorLabel} · {formatDate(post.createdAt)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm text-foreground">{post.body}</p>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(REACTION_LABEL).map(([kind, label]) => (
              <form key={kind} action={toggleReactionAction}>
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="kind" value={kind} />
                <Button type="submit" size="sm" variant="outline" disabled={!user}>
                  {label}
                  {post.reactions[kind] ? ` · ${post.reactions[kind]}` : ""}
                </Button>
              </form>
            ))}
          </div>
          {user && <ReportForm entityType="post" entityId={post.id} />}
        </CardContent>
      </Card>

      <section aria-labelledby="comments-heading" className="space-y-3">
        <h2 id="comments-heading" className="text-lg font-semibold tracking-tight">
          Comments ({post.comments.length})
        </h2>
        {post.comments.map((comment) => (
          <Card key={comment.id}>
            <CardContent className="p-3">
              <p className="text-sm">{comment.body}</p>
              <p className="mt-1 text-xs text-faint">
                {comment.authorLabel} · {formatDate(comment.createdAt)}
              </p>
            </CardContent>
          </Card>
        ))}
        {user ? (
          <CommentForm postId={post.id} />
        ) : (
          <p className="text-sm text-muted">
            <Link href="/login" className="text-accent hover:underline">Sign in</Link> to comment.
          </p>
        )}
      </section>
    </div>
  );
}
