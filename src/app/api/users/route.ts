import { NextResponse } from "next/server"
import { supabase } from "@/server/utils/supabase"

export const runtime = "nodejs"

// 내부용: 보안 고려 없음
export async function GET() {
  const { data, error } = await supabase
    .from("users")
    .select("id,name,birth,color")
    .order("id")

  if (error) {
    return NextResponse.json(
      { message: "Failed to load users" },
      { status: 500 }
    )
  }

  return NextResponse.json({ allowedUsers: data ?? [] })
}
