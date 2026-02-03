import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function toIcsDate(date: string) {
  return date.replace(/-/g, '')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const title = searchParams.get('title') ?? '휴무'
  const desc = searchParams.get('desc') ?? ''

  if (!date) {
    return NextResponse.json({ message: 'date is required' }, { status: 400 })
  }

  const start = toIcsDate(date)
  const dt = new Date(date)
  const endDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1)
  const end = toIcsDate(
    `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  )

  const uid = `offday-${date}-${Math.random().toString(36).slice(2)}`
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Offday Calendar//KO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
    desc ? `DESCRIPTION:${escapeIcs(desc)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="offday-${date}.ics"`,
    },
  })
}
