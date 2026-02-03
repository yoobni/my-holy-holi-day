'use client'

import * as React from 'react'
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'
import 'react-day-picker/dist/style.css'

import { Badge } from '@/components/ui/badge'
import { Summary } from './_components/summary'
import { CalendarSection } from './_components/calendar-section'
import { MonthTimeline } from './_components/month-timeline'
import { SharedDays } from './_components/shared-days'
import { SelectedFooter } from './_components/selected-footer'
import { AuthDialog } from './_components/auth-dialog'

const STORAGE_KEY = 'offday-user'

type AllowedUser = {
  id: number
  name: string
  birth: string
  color?: string
}

type OffdayItem = {
  date: string
  userId: number
  name: string
  user?: {
    id: number
    name: string
    color?: string | null
  }
  createdAt: string
}

type StoredUser = {
  id: number
  name: string
  birth: string
}

type OffBar = {
  userId: number
  name: string
  start: Date
  end: Date
  startKey: string
  endKey: string
  lane: number
}

type WeekBar = OffBar & {
  weekIndex: number
  colStart: number
  colSpan: number
}

function dateFromYmd(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toYmd(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function normalizeBirth(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 8) {
    return digits.slice(2)
  }
  return digits
}

function buildHolidaySet(year: number): Set<string> {
  const dates = new Set<string>()
  const addDate = (month: number, day: number) => {
    dates.add(toYmd(new Date(year, month - 1, day)))
  }
  const addRange = (month: number, start: number, end: number) => {
    for (let day = start; day <= end; day += 1) {
      addDate(month, day)
    }
  }

  addRange(2, 16, 18)
  addRange(3, 1, 2)
  addDate(5, 5)
  addDate(5, 24)
  addDate(5, 25)
  addDate(6, 6)
  addDate(8, 15)
  addDate(8, 17)
  addRange(9, 24, 27)
  addDate(10, 3)
  addDate(10, 9)
  addDate(12, 25)

  return dates
}

const fallbackColors = [
  '#CFE8FF',
  '#D7F5D1',
  '#FFE6B3',
  '#E8D8FF',
  '#FFE0B8',
  '#FAD8C6',
]

function getCalendarGridRange(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  return { start, end }
}

function groupOffdaysByUser(items: OffdayItem[]) {
  const map = new Map<number, Date[]>()
  for (const item of items) {
    if (!map.has(item.userId)) {
      map.set(item.userId, [])
    }
    map.get(item.userId)?.push(dateFromYmd(item.date))
  }
  return map
}

function buildBarsForName(
  userId: number,
  name: string,
  dates: Date[],
  gridStart: Date,
  gridEnd: Date,
  lane: number
): OffBar[] {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const bars: OffBar[] = []
  let cursorStart: Date | null = null
  let cursorEnd: Date | null = null

  for (const date of sorted) {
    if (!cursorStart) {
      cursorStart = date
      cursorEnd = date
      continue
    }
    const diff = differenceInCalendarDays(date, cursorEnd!)
    if (diff === 1) {
      cursorEnd = date
      continue
    }
    bars.push({
      userId,
      name,
      start: cursorStart,
      end: cursorEnd!,
      startKey: toYmd(cursorStart),
      endKey: toYmd(cursorEnd!),
      lane,
    })
    cursorStart = date
    cursorEnd = date
  }

  if (cursorStart && cursorEnd) {
    bars.push({
      userId,
      name,
      start: cursorStart,
      end: cursorEnd,
      startKey: toYmd(cursorStart),
      endKey: toYmd(cursorEnd),
      lane,
    })
  }

  return bars
    .map((bar) => {
      const start = bar.start < gridStart ? gridStart : bar.start
      const end = bar.end > gridEnd ? gridEnd : bar.end
      return {
        ...bar,
        start,
        end,
        startKey: toYmd(start),
        endKey: toYmd(end),
      }
    })
    .filter((bar) => bar.start <= bar.end)
}

function splitBarsByWeek(
  gridStart: Date,
  gridEnd: Date,
  bars: OffBar[]
): WeekBar[] {
  const weeks: { start: Date; end: Date }[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    const weekStart = cursor
    const weekEnd = addDays(weekStart, 6)
    weeks.push({ start: weekStart, end: weekEnd })
    cursor = addDays(cursor, 7)
  }

  const weekBars: WeekBar[] = []

  bars.forEach((bar) => {
    weeks.forEach((week, weekIndex) => {
      if (bar.end < week.start || bar.start > week.end) return
      const sliceStart = bar.start < week.start ? week.start : bar.start
      const sliceEnd = bar.end > week.end ? week.end : bar.end
      const colStart = differenceInCalendarDays(sliceStart, week.start) + 1
      const colSpan =
        differenceInCalendarDays(sliceEnd, sliceStart) + 1
      weekBars.push({
        ...bar,
        start: sliceStart,
        end: sliceEnd,
        startKey: toYmd(sliceStart),
        endKey: toYmd(sliceEnd),
        weekIndex,
        colStart,
        colSpan,
      })
    })
  })

  return weekBars
}

export default function Home() {
  const [currentUser, setCurrentUser] = React.useState<StoredUser | null>(null)
  const [canEdit, setCanEdit] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [authReady, setAuthReady] = React.useState(false)
  const [nameInput, setNameInput] = React.useState('')
  const [birthInput, setBirthInput] = React.useState('')
  const [offdays, setOffdays] = React.useState<OffdayItem[]>([])
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([])
  const [loading, setLoading] = React.useState(false)
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date())
  const [sharedThreshold, setSharedThreshold] = React.useState<2 | 3>(2)

  const myOffdayDates = React.useMemo(() => {
    if (!currentUser) return []
    return offdays
      .filter((item) => item.userId === currentUser.id)
      .map((item) => dateFromYmd(item.date))
  }, [offdays, currentUser])

  const { start: gridStart, end: gridEnd } = React.useMemo(
    () => getCalendarGridRange(currentMonth),
    [currentMonth]
  )

  const holidaySet = React.useMemo(
    () => buildHolidaySet(currentMonth.getFullYear()),
    [currentMonth]
  )

  const userMetaMap = React.useMemo(() => {
    const map = new Map<number, { name: string; color?: string | null }>()
    offdays.forEach((item, index) => {
      if (item.user) {
        map.set(item.userId, { name: item.user.name, color: item.user.color })
      } else if (!map.has(item.userId)) {
        map.set(item.userId, { name: item.name })
      }
    })
    return map
  }, [offdays])

  const timelineData = React.useMemo(() => {
    const grouped = groupOffdaysByUser(offdays)
    const userOrder = [...grouped.keys()].sort((a, b) => a - b)
    const bars: OffBar[] = []
    userOrder.forEach((userId, index) => {
      const dates = grouped.get(userId) ?? []
      const meta = userMetaMap.get(userId)
      if (!meta) return
      bars.push(
        ...buildBarsForName(userId, meta.name, dates, gridStart, gridEnd, index)
      )
    })
    const weekBars = splitBarsByWeek(gridStart, gridEnd, bars)
    const weeks = eachDayOfInterval({ start: gridStart, end: gridEnd })
      .filter((_, idx) => idx % 7 === 0)
      .map((weekStart) => ({
        start: weekStart,
        end: addDays(weekStart, 6),
      }))

    return {
      nameOrder: userOrder,
      weeks,
      weekBars,
    }
  }, [offdays, gridStart, gridEnd, userMetaMap])

  const getUserColor = React.useCallback(
    (userId: number, name: string) => {
      const meta = userMetaMap.get(userId)
      if (meta?.color) {
        return meta.color
      }
      const idx =
        Math.abs(
          name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        ) % fallbackColors.length
      return fallbackColors[idx]
    },
    [userMetaMap]
  )

  const myMonthlyOffdayCount = React.useMemo(() => {
    if (!currentUser) return 0
    const monthKey = format(currentMonth, 'yyyy-MM')
    return offdays.filter(
      (item) =>
        item.userId === currentUser.id && item.date.startsWith(monthKey)
    ).length
  }, [offdays, currentUser, currentMonth])

  const todayInfo = React.useMemo(() => {
    const today = new Date()
    const tomorrow = addDays(today, 1)
    const todayKey = toYmd(today)
    const tomorrowKey = toYmd(tomorrow)
    const todayNames = offdays
      .filter((item) => item.date === todayKey)
      .map((item) => item.name)
    const tomorrowNames = offdays
      .filter((item) => item.date === tomorrowKey)
      .map((item) => item.name)
    const uniqueTodayNames = Array.from(new Set(todayNames)).sort((a, b) =>
      a.localeCompare(b, 'ko')
    )
    const uniqueTomorrowNames = Array.from(new Set(tomorrowNames)).sort(
      (a, b) => a.localeCompare(b, 'ko')
    )
    const isMyOffday = currentUser
      ? offdays.some(
          (item) => item.date === todayKey && item.userId === currentUser.id
        )
      : false
    return {
      todayKey,
      tomorrowKey,
      isMyOffday,
      todayNames: uniqueTodayNames,
      tomorrowNames: uniqueTomorrowNames,
    }
  }, [offdays, currentUser])

  const sharedOffdays = React.useMemo(() => {
    if (!currentUser) return []
    const monthKey = format(currentMonth, 'yyyy-MM')
    const byDate = new Map<string, Set<string>>()
    offdays.forEach((item) => {
      if (!item.date.startsWith(monthKey)) return
      if (!byDate.has(item.date)) {
        byDate.set(item.date, new Set())
      }
      byDate.get(item.date)?.add(item.name)
    })

    return Array.from(byDate.entries())
      .filter(
        ([_, names]) =>
          names.has(currentUser.name) &&
          names.size >= sharedThreshold + 1
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, names]) => ({
        date,
        names: Array.from(names)
          .filter((name) => name !== currentUser.name)
          .sort((a, b) => a.localeCompare(b, 'ko')),
      }))
  }, [offdays, currentMonth, currentUser, sharedThreshold])

  const selectedYmd = React.useMemo(
    () => selectedDates.map((date) => toYmd(date)).sort(),
    [selectedDates]
  )

  const verifyUser = React.useCallback(async (name: string, birth: string) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birth }),
    })
    if (!res.ok) {
      throw new Error('Failed to verify user')
    }
    const data = (await res.json()) as { matched: AllowedUser | null }
    return data.matched
  }, [])

  const fetchOffdays = React.useCallback(async () => {
    const res = await fetch('/api/offdays', { cache: 'no-store' })
    if (!res.ok) {
      if (res.status === 404) {
        setOffdays([])
        return
      }
      throw new Error('Failed to load offdays')
    }
    const data = (await res.json()) as { items?: OffdayItem[] }
    setOffdays(Array.isArray(data.items) ? data.items : [])
  }, [])

  React.useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as StoredUser
          const matched = await verifyUser(
            parsed.name,
            normalizeBirth(parsed.birth)
          )
          if (matched) {
            setCurrentUser({
              id: matched.id,
              name: matched.name,
              birth: normalizeBirth(matched.birth),
            })
            setCanEdit(true)
            setDialogOpen(false)
          } else {
            setCurrentUser(null)
            setCanEdit(false)
            setDialogOpen(true)
          }
        } else {
          setDialogOpen(true)
        }
      } catch (error) {
        toast.error('회원 정보를 불러오지 못했습니다.')
        setDialogOpen(true)
      } finally {
        setAuthReady(true)
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [verifyUser])

  React.useEffect(() => {
    if (!canEdit) {
      setOffdays([])
      return
    }
    fetchOffdays().catch(() => {
      setOffdays([])
    })
  }, [canEdit, fetchOffdays])

  const handleDialogSubmit = async () => {
    const normalizedInputBirth = normalizeBirth(birthInput)
    const matched = await verifyUser(nameInput, normalizedInputBirth)

    if (!matched) {
      setCanEdit(false)
      setCurrentUser(null)
      toast.error('회원정보가 일치하지 않습니다. 읽기 전용으로 유지됩니다.')
      return
    }

    const stored: StoredUser = {
      id: matched.id,
      name: matched.name,
      birth: normalizeBirth(matched.birth),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    setCurrentUser(stored)
    setCanEdit(true)
    setDialogOpen(false)
    toast.success('편집 권한이 부여되었습니다.')
  }

  const handleAddOffdays = async () => {
    if (!currentUser || selectedYmd.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/offdays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: selectedYmd,
          name: currentUser.name,
          userId: currentUser.id,
        }),
      })

      if (!res.ok) {
        throw new Error('등록 실패')
      }

      const result = (await res.json()) as {
        added: string[]
        skipped: string[]
      }

      if (result.added.length > 0) {
        toast.success(`등록 완료: ${result.added.join(', ')}`)
      }
      if (result.skipped.length > 0) {
        toast.info(`이미 등록됨: ${result.skipped.join(', ')}`)
      }

      setSelectedDates([])
      await fetchOffdays()
    } catch (error) {
      toast.error('휴무일 등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOffdays = async () => {
    if (!currentUser || selectedYmd.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/offdays', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: selectedYmd, userId: currentUser.id }),
      })

      if (!res.ok) {
        throw new Error('삭제 실패')
      }

      toast.success(`삭제 완료: ${selectedYmd.join(', ')}`)
      setSelectedDates([])
      await fetchOffdays()
    } catch (error) {
      toast.error('휴무일 삭제에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleTimelineDateClick = React.useCallback(
    (dateKey: string) => {
      const names = offdays
        .filter((item) => item.date === dateKey)
        .map((item) => item.name)
      if (names.length === 0) {
        toast.info('휴무자가 없습니다')
        return
      }
      const uniqueNames = Array.from(new Set(names))
      const currentName = currentUser?.name
      const others = currentName
        ? uniqueNames.filter((name) => name !== currentName)
        : uniqueNames
      const shortNames = others.map((name) =>
        name.length > 1 ? name.slice(1) : name
      )
      const title = shortNames.length > 0 ? shortNames.join(' / ') : '휴무'
      const desc = `휴무자: ${uniqueNames.join(', ')}`

      window.location.href = `/api/calendar/ics?date=${encodeURIComponent(
        dateKey
      )}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}`
    },
    [offdays, currentUser]
  )

  const isReadOnly = !canEdit

  return (
    <div className='min-h-screen bg-zinc-50 text-zinc-900'>
      <header className='sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-6 py-4 shadow-sm backdrop-blur'>
        <div className='flex gap-3 flex-row items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold'>휴무일 캘린더</h1>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant={isReadOnly ? 'secondary' : 'default'}>
              {isReadOnly ? '읽기 전용' : '편집 가능'}
            </Badge>
            {currentUser ? (
              <Badge variant='secondary'>{currentUser.name}</Badge>
            ) : (
              <Badge variant='outline'>미확인</Badge>
            )}
          </div>
        </div>
      </header>

      <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10'>
        <Summary
          todayKey={todayInfo.todayKey}
          isMyOffday={todayInfo.isMyOffday}
          todayNames={todayInfo.todayNames}
          tomorrowKey={todayInfo.tomorrowKey}
          tomorrowNames={todayInfo.tomorrowNames}
        />
        <main className='grid gap-6 lg:grid-cols-1'>
          <CalendarSection
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            selectedDates={selectedDates}
            onSelectDates={(dates) => setSelectedDates(dates ?? [])}
            myOffdayDates={myOffdayDates}
            holidaySet={holidaySet}
            toYmd={toYmd}
            myMonthlyOffdayCount={myMonthlyOffdayCount}
            selectedCount={selectedYmd.length}
          />
        </main>

        <MonthTimeline
          weeks={timelineData.weeks}
          weekBars={timelineData.weekBars}
          userOrder={timelineData.nameOrder}
          userMetaMap={userMetaMap}
          getUserColor={getUserColor}
          holidaySet={holidaySet}
          toYmd={toYmd}
          currentMonth={currentMonth}
          onDateClick={handleTimelineDateClick}
        />

        <SharedDays
          sharedThreshold={sharedThreshold}
          onChangeThreshold={setSharedThreshold}
          items={sharedOffdays}
          getColor={(name) => {
            const color =
              Array.from(userMetaMap.values()).find((meta) => meta.name === name)
                ?.color ?? 'var(--muted)'
            return color
          }}
        />
      </div>

      <SelectedFooter
        selectedDates={selectedYmd}
        isReadOnly={isReadOnly}
        loading={loading}
        onAdd={handleAddOffdays}
        onDelete={handleDeleteOffdays}
      />

      <AuthDialog
        open={authReady && dialogOpen}
        onOpenChange={(open) => {
          if (!authReady) return
          setDialogOpen(open)
          if (!open && !canEdit) {
            toast.info('읽기 전용으로 계속됩니다.')
          }
        }}
        name={nameInput}
        birth={birthInput}
        onChangeName={setNameInput}
        onChangeBirth={setBirthInput}
        onSubmit={handleDialogSubmit}
      />
    </div>
  )
}
