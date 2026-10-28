import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function Home() {
  // getClaims() reads the clock (token expiry check); connection() marks this
  // as request-time work, same as the (app) layout AuthGuard.
  await connection();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  redirect(data?.claims ? "/dashboard" : "/auth/login");
}
