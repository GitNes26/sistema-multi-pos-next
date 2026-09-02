import { NextResponse } from "next/server";

/**
 * BigInt-safe JSON serialization.
 * JSON.stringify throws on BigInt values. This wrapper converts them to
 * numbers (safe for order/sale numbers that fit in JS Number range).
 */
export function safeJson(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  );
}

/**
 * Create a NextResponse with BigInt-safe JSON body.
 * Use this instead of NextResponse.json() when the data may contain BigInt fields.
 *
 * @example
 *   return jsonResponse({ ok: true, orderNumber: order.orderNumber });
 */
export function jsonResponse(
  data: unknown,
  init?: ResponseInit
): NextResponse {
  return new NextResponse(JSON.stringify(safeJson(data), null, process.env.NODE_ENV === "development" ? 2 : undefined), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
}

/**
 * Check if a value is a BigInt.
 */
export function isBigInt(value: unknown): value is bigint {
  return typeof value === "bigint";
}
