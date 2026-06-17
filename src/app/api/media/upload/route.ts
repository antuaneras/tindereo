import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server/tindereo-auth";
import {
  buildManagedMediaProxyUrl,
  uploadManagedMedia
} from "@/lib/server/tindereo-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePurpose(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "post" as const;
  }

  return value === "avatar" || value === "chat" || value === "story" ? value : "post";
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const currentUserId = await getAuthenticatedUserId(cookieStore);
    if (!currentUserId) {
      return NextResponse.json({ error: "Necesitas iniciar sesion para subir archivos." }, { status: 401 });
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "No se ha recibido ningun archivo." }, { status: 400 });
    }

    const assetRef = await uploadManagedMedia({
      bytes: await fileEntry.arrayBuffer(),
      contentType: fileEntry.type || "application/octet-stream",
      fileName: fileEntry.name || "upload",
      ownerId: currentUserId,
      purpose: normalizePurpose(formData.get("purpose"))
    });

    return NextResponse.json({
      assetRef,
      previewUrl: buildManagedMediaProxyUrl(assetRef)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo subir el archivo."
      },
      { status: 500 }
    );
  }
}
