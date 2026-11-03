import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate. It only checks whether a session cookie is present;
 * the real validation happens in `requireUser` / `requireUserPage` against the
 * database. This keeps Proxy fast and avoids trusting unverified cookies.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => {
    const plain =
      name === "better-auth.session_token" ||
      name.startsWith("better-auth.session_token.");
    const secure =
      name === "__Secure-better-auth.session_token" ||
      name.startsWith("__Secure-better-auth.session_token.");
    return plain || secure;
  });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|icons|manifest.webmanifest|sw.js|offline.html|favicon.ico).*)",
  ],
};
