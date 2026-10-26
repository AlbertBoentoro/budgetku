import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PASSKEY_SESSION_COOKIE, verifyPasskeySession } from "@/lib/passkey/session";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;
  const isPublicRequest =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/service-worker.js";

  if (!user && !isPublicRequest) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  const passkeyExempt =
    pathname === "/service-worker.js" ||
    pathname === "/api/auth/logout" ||
    pathname === "/auth/passkey" ||
    pathname.startsWith("/auth/passkey-recovery") ||
    pathname.startsWith("/api/auth/passkey");
  const userId =
    user && typeof user.sub === "string" ? user.sub : null;

  if (
    userId &&
    !passkeyExempt &&
    process.env.PASSKEY_SESSION_SECRET
  ) {
    const { data: settings, error } = await supabase
      .from("user_settings")
      .select("passkey_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Passkey state could not be checked:", error.message);
      const unavailable = NextResponse.json(
        { error: "Account security settings are temporarily unavailable." },
        { status: 503 },
      );
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        unavailable.cookies.set(cookie);
      });
      return unavailable;
    }

    if (settings?.passkey_enabled) {
      const session = request.cookies.get(PASSKEY_SESSION_COOKIE)?.value;
      const unlocked = await verifyPasskeySession(session, userId);
      if (!unlocked) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/passkey";
        url.search = "";
        url.searchParams.set(
          "next",
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
        );
        const redirect = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirect.cookies.set(cookie);
        });
        return redirect;
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
