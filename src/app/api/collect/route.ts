import { NextResponse } from "next/server";
import { collectAll } from "@/lib/collectors";

export const maxDuration = 120;

export async function POST() {
  const startedAt = Date.now();
  try {
    const result = await collectAll();
    const elapsed = Date.now() - startedAt;

    return NextResponse.json({ ok: true, elapsed, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
