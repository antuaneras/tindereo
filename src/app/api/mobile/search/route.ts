import { getMobileSearch, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewerId = await requireMobileViewerId();
    const searchParams = new URL(request.url).searchParams;
    const query = searchParams.get("q") ?? "";
    return mobileOk(
      await getMobileSearch(viewerId, query, {
        city: searchParams.get("city") ?? "",
        when: (searchParams.get("when") as "all" | "live" | "today" | "week" | "month" | null) ?? "all",
        visibility: (searchParams.get("visibility") as "all" | "public" | "private" | null) ?? "all",
        category: searchParams.get("category") ?? ""
      })
    );
  } catch (error) {
    return mobileError(error);
  }
}
