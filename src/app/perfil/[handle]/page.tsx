import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMobileProfileDetail } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";
import { PostCard, StoryStrip } from "@/components/mobile/mobile-feed";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params
}: {
  params: Promise<{ handle: string }>;
}) {
  const viewerId = await requireMobileViewerOrRedirect();
  const { handle } = await params;
  const detail = await getMobileProfileDetail(viewerId, handle);
  const storyClusters = detail.stories.length
    ? [
        {
          ownerId: detail.profile.id,
          ownerType: "user" as const,
          ownerLabel: `@${detail.profile.handle}`,
          ownerAvatarUrl: detail.profile.avatarUrl,
          unseenCount: detail.stories.filter((story) => !story.hasSeen).length,
          stories: detail.stories
        }
      ]
    : [];

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-[480px] px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link href="/buscar" className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <section className="rounded-[2rem] border border-[var(--line-soft)] bg-white/92 p-5 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
        <div className="flex items-center gap-4">
          {detail.profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.profile.avatarUrl} alt={`@${detail.profile.handle}`} className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--bg-soft)] text-2xl font-black">{detail.profile.handle.slice(0, 2).toUpperCase()}</span>
          )}
          <div>
            <div className="text-3xl font-black tracking-[-0.05em]">@{detail.profile.handle}</div>
            <div className="mt-1 text-sm text-[var(--text-soft)]">{detail.profile.displayName} · {detail.profile.city}</div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{detail.profile.bio || "Sin bio."}</p>
          </div>
        </div>
      </section>
      <div className="mt-5 space-y-4">
        {storyClusters.length ? <StoryStrip clusters={storyClusters} /> : null}
        {detail.posts.map((post) => <PostCard key={post.id} post={post} />)}
      </div>
    </main>
  );
}
