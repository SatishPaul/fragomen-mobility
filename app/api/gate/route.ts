import { NextResponse } from "next/server";
import { createGateToken, gateSessionMaxAge } from "@/lib/server/gate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  if (body?.password !== password) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("vm_auth", createGateToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: gateSessionMaxAge,
    path: "/",
  });
  return res;
}
