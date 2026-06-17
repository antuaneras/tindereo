"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, LogOut } from "lucide-react";
import { mobileLogout, updateViewerProfile } from "@/lib/mobile-api";
import { uploadManagedMediaFromClient } from "@/lib/tindereo-api";
import type { MobileProfileDetail } from "@/lib/mobile-types";

export function MobileProfileScreen({ initialProfile }: { initialProfile: MobileProfileDetail }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
          Perfil
        </div>
        <button
          type="button"
          onClick={async () => {
            await mobileLogout();
            router.replace("/login");
            router.refresh();
          }}
          className="flex h-12 items-center gap-2 rounded-2xl bg-white/90 px-4 text-sm font-semibold shadow-sm"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>

      <section className="rounded-[2rem] border border-[var(--line-soft)] bg-white/92 p-5 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
        <div className="flex items-center gap-4">
          <label className="relative block cursor-pointer">
            {profile.profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.profile.avatarUrl} alt={`@${profile.profile.handle}`} className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--bg-soft)] text-2xl font-black">
                {profile.profile.handle.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--text-main)] text-white">
              <Camera className="h-4 w-4" />
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                setPending(true);
                try {
                  const upload = await uploadManagedMediaFromClient(file, "avatar");
                  const next = await updateViewerProfile({
                    displayName: profile.profile.displayName,
                    city: profile.profile.city,
                    bio: profile.profile.bio,
                    avatarUrl: upload.assetRef,
                    coverUrl: profile.profile.coverUrl
                  });
                  setProfile((current) => ({ ...current, profile: { ...current.profile, avatarUrl: next.avatarUrl } }));
                } finally {
                  setPending(false);
                }
              }}
            />
          </label>
          <div className="min-w-0">
            <div className="text-3xl font-black tracking-[-0.05em]">@{profile.profile.handle}</div>
            <div className="mt-1 text-sm text-[var(--text-soft)]">{profile.profile.displayName} · {profile.profile.city}</div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{profile.profile.bio || "Sin bio aún."}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {[
          ["Creados", profile.createdEvents.length],
          ["Agenda", profile.joinedEvents.length],
          ["Amigos", profile.isFriend ? 1 : 0],
          ["Posts", profile.posts.length]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1.6rem] border border-[var(--line-soft)] bg-white/92 px-4 py-4 text-center shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-soft)]">{label}</div>
            <div className="mt-3 text-2xl font-black tracking-[-0.04em]">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-[var(--line-soft)] bg-white/92 p-5 shadow-sm">
        <div className="text-lg font-black tracking-[-0.04em]">Tus eventos</div>
        <div className="mt-4 space-y-3">
          {[...profile.createdEvents, ...profile.joinedEvents].slice(0, 6).map((event) => (
            <Link key={event.id} href={`/evento/${event.slug}`} className="block rounded-[1.6rem] bg-[var(--bg-soft)] px-4 py-4 text-sm font-semibold">
              {event.title}
            </Link>
          ))}
        </div>
      </section>

      {pending ? <div className="text-sm text-[var(--text-soft)]">Guardando cambios...</div> : null}
    </div>
  );
}
