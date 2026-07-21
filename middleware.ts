import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const isProtectedPage = ["/create", "/dashboard", "/profile", "/admin"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const publicApis = new Set(["/api/gate", "/api/webhooks/outstand"]);
  const isProtectedApi = pathname.startsWith("/api/") && !publicApis.has(pathname);

  if (!user && isProtectedApi) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!user && isProtectedPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
