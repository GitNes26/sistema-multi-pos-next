import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.TEST_SERVER_TOKEN ?? "";
  const supplied = request.headers.get("x-test-server-token") ?? "";
  const database = process.env.DATABASE_URL ?? "";
  let validDatabase = false;
  try {
    const url = new URL(database);
    validDatabase = url.protocol === "mysql:" && /^multi_pos_test_[a-z0-9_]+$/.test(url.pathname.slice(1));
  } catch { /* disabled unless the URL is valid */ }
  if (process.env.TEST_DATABASE_CONFIRMED !== "true" || !validDatabase ||
      database !== process.env.TEST_DATABASE_URL || secret.length < 32 ||
      Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({ fingerprint: createHash("sha256").update(database).digest("hex") }, {
    headers: { "Cache-Control": "no-store" },
  });
}
