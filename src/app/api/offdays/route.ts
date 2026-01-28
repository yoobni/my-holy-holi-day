import { NextResponse } from "next/server"
import { supabase } from "@/server/utils/supabase"

export const runtime = "nodejs"

type OffdayItem = {
  date: string
  userId: number
  name: string
  createdAt: string
}

type OffdaysPayload = {
  items: OffdayItem[]
}

function uniqueDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort()
}

function sortItems(items: OffdayItem[]): OffdayItem[] {
  return [...items].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return byDate
    return a.userId - b.userId
  })
}

// 내부용: 보안 고려 없음
export async function GET() {
  const { data, error } = await supabase
    .from("offdays")
    .select("date,user_id,name,created_at,users(id,name,color)")
    .order("date", { ascending: true })
    .order("user_id", { ascending: true })

  if (error) {
    return NextResponse.json(
      { message: "Failed to load offdays" },
      { status: 500 }
    )
  }

  const items =
    data?.map((item) => {
      const user = Array.isArray(item.users) ? item.users[0] : item.users
      return {
        date: item.date,
        userId: item.user_id,
        name: user?.name ?? item.name,
        user: user
          ? { id: user.id, name: user.name, color: user.color }
          : undefined,
        createdAt: item.created_at,
      }
    }) ?? []

  return NextResponse.json({ items: sortItems(items) })
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    dates?: string[]
    name?: string
    userId?: number
  }
  const dates = Array.isArray(body.dates) ? uniqueDates(body.dates) : []
  const name = typeof body.name === "string" ? body.name : ""
  const userId = typeof body.userId === "number" ? body.userId : null

  if (!name || dates.length === 0 || userId === null) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("offdays")
    .select("date")
    .eq("user_id", userId)
    .in("date", dates)

  if (existingError) {
    return NextResponse.json(
      { message: "Failed to read offdays" },
      { status: 500 }
    )
  }

  const existingSet = new Set(existing?.map((row) => row.date) ?? [])
  const added: string[] = []
  const skipped: string[] = []

  const toInsert = dates
    .filter((date) => {
      if (existingSet.has(date)) {
        skipped.push(date)
        return false
      }
      added.push(date)
      return true
    })
    .map((date) => ({
      date,
      user_id: userId,
      name,
      created_at: new Date().toISOString(),
    }))

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("offdays")
      .insert(toInsert)

    if (insertError) {
      return NextResponse.json(
        { message: "Failed to save offdays" },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ added, skipped })
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { dates?: string[]; userId?: number }
  const dates = Array.isArray(body.dates) ? uniqueDates(body.dates) : []
  const userId = typeof body.userId === "number" ? body.userId : null

  if (dates.length === 0 || userId === null) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    )
  }

  const { error: deleteError } = await supabase
    .from("offdays")
    .delete()
    .in("date", dates)
    .eq("user_id", userId)

  if (deleteError) {
    return NextResponse.json(
      { message: "Failed to delete offdays" },
      { status: 500 }
    )
  }

  return NextResponse.json({ deleted: dates, deletedCount: dates.length })
}
