import { NextResponse } from "next/server";
import { MobileSchemaNotReadyError } from "@/lib/server/mobile-service";

export function mobileOk(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}

export function mobileError(error: unknown) {
  if (error instanceof MobileSchemaNotReadyError) {
    return NextResponse.json({ error: error.message, code: "schema-not-ready" }, { status: 503 });
  }

  if (error instanceof Error) {
    const message = error.message || "No se pudo completar la operacion.";
    const status = /iniciar sesion|necesitas/i.test(message)
      ? 401
      : /no puedes|invalido|caducado|duplicado|uso|seleccionar/i.test(message)
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json(
    { error: "No se pudo completar la operacion." },
    { status: 500 }
  );
}
