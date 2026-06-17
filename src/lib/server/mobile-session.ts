import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/server/tindereo-auth";
import { mobileViewerHasProfile } from "@/lib/server/mobile-service";

export async function getOptionalMobileViewerId() {
  return getAuthenticatedUserId(await cookies());
}

export async function requireMobileViewerOrRedirect() {
  const viewerId = await getOptionalMobileViewerId();
  if (!viewerId) {
    redirect("/login");
  }

  try {
    if (!(await mobileViewerHasProfile(viewerId))) {
      redirect("/login");
    }
  } catch {
    redirect("/login");
  }
  return viewerId;
}

export async function redirectAuthenticatedUserToHome() {
  const viewerId = await getOptionalMobileViewerId();
  if (!viewerId) {
    return;
  }

  try {
    if (await mobileViewerHasProfile(viewerId)) {
      redirect("/inicio");
    }
  } catch {
    return;
  }

}
