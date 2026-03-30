import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/feedback",
  "/api/inquiries"
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    || pathname.startsWith("/_next")
    || pathname.startsWith("/api/cron");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const authPassword = process.env.DASHBOARD_PASSWORD;
  if (!authPassword) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("tsp-auth");
  if (cookie?.value === authPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const encoded = authHeader.replace("Basic ", "");
    try {
      const decoded = Buffer.from(encoded, "base64").toString();
      const [, password] = decoded.split(":");
      if (password === authPassword) {
        const response = NextResponse.next();
        response.cookies.set("tsp-auth", authPassword, { httpOnly: true, sameSite: "lax", maxAge: 86400 * 7 });
        return response;
      }
    } catch {
      // Invalid auth header
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="TSP Dashboard"' }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
