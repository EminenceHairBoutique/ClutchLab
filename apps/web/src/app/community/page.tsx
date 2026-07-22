import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { PostComposer } from "@/components/community/post-composer";
import { getSessionUser } from "@/lib/auth/gateway";
import { getCommunityStore } from "@/lib/data/community-store";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Community",
  description: "Moderated settings shares, drill results, meta debates, and squad recruitment.",
};

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  discussion: "Discussion",
  question: "Question",
  settings: "Settings",
  layout: "Layout",
  drill_result: "Drill result",
  meta_debate: "Meta debate",
  squad_recruitment: "Squad LFG",
  correction: "Correction",
};

export default async function CommunityPage() {
  const user = await getSessionUser();
  const posts = await getCommunityStore().listPosts(user?.id ?? null);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Community</h1>
        <p className="text-sm text-muted">
          Moderated by rule and by humans: no cheats, macros, modified clients, account trading,
          or credential requests — ever. Factual claims need sources.
        </p>
      </div>
      <MockModeBanner />

      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>Share something tested</CardTitle>
            <CardDescription>
              Posts matching automated risk flags are held for review before appearing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PostComposer />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-4">
            <p className="text-sm text-muted">Sign in to post, comment, and report.</p>
            <Button asChild variant="accent">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {posts.length === 0 && (
          <p className="text-sm text-muted">No posts yet — start the first discussion.</p>
        )}
        {posts.map((post) => (
          <Link key={post.id} href={`/community/${post.id}`} className="block">
            <Card className="transition-colors hover:border-border-strong">
              <CardHeader className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{KIND_LABEL[post.kind] ?? post.kind}</Badge>
                  <CardTitle className="text-sm">{post.title}</CardTitle>
                  {post.status === "flagged" && post.isOwn && (
                    <Badge variant="warning">held for review</Badge>
                  )}
                  <span className="ml-auto text-xs text-faint">
                    {post.authorLabel} · {formatDate(post.createdAt)}
                  </span>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
