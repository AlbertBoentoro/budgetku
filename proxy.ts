import { updateSession } from "@/lib/supabase/proxy";
import { isStagingEmailLoginAllowed } from "@/lib/auth/staging-email-login";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // The public preview gallery contains only synthetic fixture data and has
  // no database mutations. Production and all other routes retain auth.
  const isDemoRoute = request.nextUrl.pathname === "/testing" ||
    request.nextUrl.pathname.startsWith("/testing/");
  if (isDemoRoute && isStagingEmailLoginAllowed()) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
