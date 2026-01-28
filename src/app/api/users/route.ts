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

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string
    birth?: string
  }

  const name = typeof body.name === "string" ? body.name : ""
  const birth = typeof body.birth === "string" ? body.birth : ""

  if (!name || !birth) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("users")
    .select("id,name,birth,color")
    .eq("name", name)
    .eq("birth", birth)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { message: "Failed to verify user" },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json({ matched: null })
  }

  return NextResponse.json({ matched: data })
}
