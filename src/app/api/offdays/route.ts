import { NextResponse } from "next/server"
import { readJson, writeJson } from "@/server/utils/fileStore"

export const runtime = "nodejs"

type OffdayItem = {
  date: string
  name: string
  createdAt: string
}

type OffdaysPayload = {
  items: OffdayItem[]
}

const fallbackOffdays: OffdaysPayload = {
  items: [],
}

function uniqueDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort()
}

function sortItems(items: OffdayItem[]): OffdayItem[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date))
}

// 내부용: 보안 고려 없음
export async function GET() {
  const data = await readJson("offdays.json", fallbackOffdays)
  return NextResponse.json({ items: sortItems(data.items) })
}

export async function POST(request: Request) {
  const body = (await request.json()) as { dates?: string[]; name?: string }
  const dates = Array.isArray(body.dates) ? uniqueDates(body.dates) : []
  const name = typeof body.name === "string" ? body.name : ""

  if (!name || dates.length === 0) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    )
  }

  const data = await readJson("offdays.json", fallbackOffdays)
  const existingDates = new Set(data.items.map((item) => item.date))
  const added: string[] = []
  const skipped: string[] = []

  for (const date of dates) {
    if (existingDates.has(date)) {
      skipped.push(date)
      continue
    }
    data.items.push({ date, name, createdAt: new Date().toISOString() })
    existingDates.add(date)
    added.push(date)
  }

  data.items = sortItems(data.items)
  await writeJson("offdays.json", data)

  return NextResponse.json({ added, skipped })
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { dates?: string[] }
  const dates = Array.isArray(body.dates) ? uniqueDates(body.dates) : []

  if (dates.length === 0) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    )
  }

  const data = await readJson("offdays.json", fallbackOffdays)
  const dateSet = new Set(dates)
  const before = data.items.length
  data.items = sortItems(data.items.filter((item) => !dateSet.has(item.date)))
  const deletedCount = before - data.items.length

  await writeJson("offdays.json", data)

  return NextResponse.json({ deleted: dates, deletedCount })
}
