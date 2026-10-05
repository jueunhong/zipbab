import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  await (await supabase()).auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
