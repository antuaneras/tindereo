import { cookies } from "next/headers";
import { getAuthenticatedUserId } from "@/lib/server/tindereo-auth";
import { fetchManagedMediaObject } from "@/lib/server/tindereo-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetPath?: string[] }> }
) {
  try {
    const cookieStore = await cookies();
    const currentUserId = await getAuthenticatedUserId(cookieStore);
    if (!currentUserId) {
      return new Response("Necesitas iniciar sesion.", { status: 401 });
    }

    const { assetPath = [] } = await context.params;
    const joinedPath = assetPath.join("/").trim();
    if (!joinedPath) {
      return new Response("Archivo no encontrado.", { status: 404 });
    }

    const upstream = await fetchManagedMediaObject(joinedPath);
    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    const contentLength = upstream.headers.get("content-length");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    headers.set("Cache-Control", "private, max-age=300");

    return new Response(upstream.body, {
      headers,
      status: 200
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "No se pudo abrir el archivo.", {
      status: 404
    });
  }
}
