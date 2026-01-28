'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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

  addRange(2, 14, 18)
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

function renderNameWithFallback(name: string, useShort: boolean) {
  if (!useShort) return name
  return name.slice(0, 1)
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
  const [allowedUsers, setAllowedUsers] = React.useState<AllowedUser[]>([])
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

  const userColorMap = React.useMemo(() => {
    const map = new Map<number, string>()
    allowedUsers.forEach((user, index) => {
      const color = user.color ?? fallbackColors[index % fallbackColors.length]
      map.set(user.id, color)
    })
    return map
  }, [allowedUsers])

  const timelineData = React.useMemo(() => {
    const grouped = groupOffdaysByUser(offdays)
    const nameOrder = [...grouped.keys()].sort((a, b) => a - b)
    const bars: OffBar[] = []
    nameOrder.forEach((userId, index) => {
      const dates = grouped.get(userId) ?? []
      const user = allowedUsers.find((item) => item.id === userId)
      if (!user) return
      bars.push(
        ...buildBarsForName(userId, user.name, dates, gridStart, gridEnd, index)
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
      nameOrder,
      weeks,
      weekBars,
    }
  }, [offdays, gridStart, gridEnd, allowedUsers])

  const getUserColor = React.useCallback(
    (userId: number, name: string) => {
      if (userColorMap.has(userId)) {
        return userColorMap.get(userId)!
      }
      const idx =
        Math.abs(
          name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        ) % fallbackColors.length
      return fallbackColors[idx]
    },
    [userColorMap]
  )

  const myMonthlyOffdayCount = React.useMemo(() => {
    if (!currentUser) return 0
    const monthKey = format(currentMonth, 'yyyy-MM')
    return offdays.filter(
      (item) =>
        item.userId === currentUser.id && item.date.startsWith(monthKey)
    ).length
  }, [offdays, currentUser, currentMonth])

  const visibleOffdays = React.useMemo(() => {
    const monthKey = format(currentMonth, 'yyyy-MM')
    return offdays
      .filter((item) => item.date.startsWith(monthKey))
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date)
        if (byDate !== 0) return byDate
        return a.userId - b.userId
      })
  }, [offdays, currentMonth])

  const selectedYmd = React.useMemo(
    () => selectedDates.map((date) => toYmd(date)).sort(),
    [selectedDates]
  )

  const fetchUsers = React.useCallback(async () => {
    const res = await fetch('/api/users', { cache: 'no-store' })
    if (!res.ok) {
      throw new Error('Failed to load users')
    }
    const data = (await res.json()) as { allowedUsers: AllowedUser[] }
    setAllowedUsers(data.allowedUsers)
    return data.allowedUsers
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
        const users = await fetchUsers()
        if (!mounted) return
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as StoredUser
          const matched = users.find(
            (user) =>
              user.name === parsed.name &&
              normalizeBirth(user.birth) === normalizeBirth(parsed.birth)
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
  }, [fetchUsers, fetchOffdays])

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
    const matched = allowedUsers.find(
      (user) =>
        user.name === nameInput &&
        normalizeBirth(user.birth) === normalizedInputBirth
    )

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

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setCurrentUser(null)
    setCanEdit(false)
    setDialogOpen(true)
    setAuthReady(true)
    setNameInput('')
    setBirthInput('')
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
    if (selectedYmd.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/offdays', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: selectedYmd }),
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
        <main className='grid gap-6 lg:grid-cols-1'>
          <Card className='p-6'>
            <h2 className='mb-4 text-lg font-semibold'>달력</h2>
            <DayPicker
              mode='multiple'
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates ?? [])}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ko}
              formatters={{
                formatCaption: (date) => format(date, 'yyyy년 M월', { locale: ko }),
              }}
              components={{
                Chevron: ({ orientation }) =>
                  orientation === 'left' ? (
                    <ChevronLeft className='h-4 w-4 text-zinc-700' />
                  ) : (
                    <ChevronRight className='h-4 w-4 text-zinc-700' />
                  ),
              }}
              modifiers={{
                offday: myOffdayDates,
                holiday: (date) => holidaySet.has(toYmd(date)),
              }}
              modifiersClassNames={{
                offday: 'bg-emerald-100 text-emerald-900 font-semibold',
                selected: 'bg-sky-100 text-sky-900',
                holiday: 'text-red-600',
              }}
              classNames={{
                day: 'p-0 font-normal',
                day_button: 'h-9 w-9',
                day_today: 'border-2 border-amber-400 bg-amber-50 font-semibold',
              }}
              className='rounded-lg'
            />
            <div className='mt-4 flex flex-wrap gap-2 text-sm'>
              <Badge variant='outline'>
                이번 달 휴무일: {myMonthlyOffdayCount}개
              </Badge>
              <Badge variant='secondary'>선택됨: {selectedYmd.length}</Badge>
              <Badge variant='outline'>본인 휴무일만 표시</Badge>
            </div>
          </Card>
        </main>

        <Card className='p-6'>
          <h2 className='mb-4 text-lg font-semibold'>월 타임라인</h2>
          <div className='flex flex-col gap-6'>
            {timelineData.weeks.map((week, weekIndex) => {
              const weekBars = timelineData.weekBars.filter(
                (bar) => bar.weekIndex === weekIndex
              )
              const usersInWeek = timelineData.nameOrder.filter((userId) =>
                weekBars.some((bar) => bar.userId === userId)
              )

              return (
                <div key={week.start.toISOString()} className='space-y-2'>
                  <div className='grid grid-cols-7 gap-2 text-xs text-zinc-500'>
                    {eachDayOfInterval({ start: week.start, end: week.end }).map(
                      (day) => {
                        const isHoliday = holidaySet.has(toYmd(day))
                        return (
                          <div
                            key={day.toISOString()}
                            className='flex flex-col items-center rounded-md bg-zinc-50 py-1'
                          >
                            <span
                              className={
                                isHoliday ? 'text-red-400 font-semibold' : ''
                              }
                            >
                              {format(day, 'M/d')}
                            </span>
                            <span
                              className={
                                isHoliday
                                  ? 'text-[10px] text-red-300'
                                  : 'text-[10px] text-zinc-400'
                              }
                            >
                              {format(day, 'EEE', { locale: ko })}
                            </span>
                          </div>
                        )
                      }
                    )}
                  </div>

                  {usersInWeek.length === 0 ? (
                    <p className='text-xs text-zinc-400'>
                      이 주에 등록된 휴무가 없습니다.
                    </p>
                  ) : (
                    <div className='flex flex-col gap-2'>
                      {usersInWeek.map((userId) => {
                        const user = allowedUsers.find((item) => item.id === userId)
                        if (!user) return null
                        const laneBars = weekBars.filter(
                          (bar) => bar.userId === userId
                        )
                        return (
                          <div
                            key={`${weekIndex}-${userId}`}
                            className='grid grid-cols-7 gap-2'
                          >
                            {laneBars.map((bar) => (
                              <div
                                key={`${userId}-${bar.startKey}-${bar.endKey}`}
                                className='pointer-events-auto'
                                style={{
                                  gridColumn: `${bar.colStart} / span ${bar.colSpan}`,
                                }}
                              >
                                <div
                                  title={`${user.name} (${bar.startKey} ~ ${bar.endKey})`}
                                  className='flex h-8 items-center rounded-full px-3 text-xs font-semibold text-zinc-900'
                                  style={{
                                    backgroundColor: getUserColor(
                                      user.id,
                                      user.name
                                    ),
                                  }}
                                >
                                  <span className='truncate'>
                                    <span className='sm:hidden'>
                                      {renderNameWithFallback(
                                        user.name,
                                        bar.colSpan <= 1
                                      )}
                                    </span>
                                    <span className='hidden sm:inline'>
                                      {user.name}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            ))}
                            {laneBars.length === 0 && (
                              <div className='col-span-7 h-8 rounded-full bg-transparent' />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className='mt-3 text-xs text-zinc-500'>
            달력 월을 변경하면 타임라인도 동일한 월의 주 단위로 갱신됩니다.
          </p>
        </Card>

        <Card className='p-6'>
          <h2 className='mb-3 text-lg font-semibold'>휴무일 목록</h2>
          <div className='flex flex-col gap-3'>
            {visibleOffdays.length === 0 && (
              <p className='text-sm text-zinc-500'>등록된 휴무일이 없습니다.</p>
            )}
            {visibleOffdays.map((item) => (
              <div
                key={`${item.date}-${item.userId}`}
                className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2'
              >
                <div className='flex items-center gap-2'>
                  <Badge variant='secondary'>{item.date}</Badge>
                  <span className='text-sm text-zinc-600'>휴무자</span>
                  <Badge>{item.name}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {selectedYmd.length > 0 && (
        <footer className='sticky bottom-0 z-10 border-t border-zinc-200 bg-white/95 px-6 py-4 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur'>
          <div className='mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex flex-wrap items-center gap-2 text-sm'>
              <span className='text-zinc-600'>선택된 날짜</span>
              {selectedYmd.map((date) => (
                <Badge key={date} variant='secondary'>
                  {date}
                </Badge>
              ))}
            </div>
            <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center'>
              <div className='grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto'>
                <Button
                  className='w-full sm:w-auto sm:flex-1'
                  disabled={isReadOnly || selectedYmd.length === 0 || loading}
                  onClick={handleAddOffdays}
                >
                  휴무일 지정
                </Button>
                <Button
                  className='w-full sm:w-auto sm:flex-1'
                  variant='outline'
                  disabled={isReadOnly || selectedYmd.length === 0 || loading}
                  onClick={handleDeleteOffdays}
                >
                  휴무일 삭제
                </Button>
              </div>
              {isReadOnly && (
                <span className='text-xs text-zinc-500'>
                  읽기 전용 상태에서는 등록/삭제가 비활성화됩니다.
                </span>
              )}
            </div>
          </div>
        </footer>
      )}

      <Dialog
        open={authReady && dialogOpen}
        onOpenChange={(open) => {
          if (!authReady) return
          setDialogOpen(open)
          if (!open && !canEdit) {
            toast.info('읽기 전용으로 계속됩니다.')
          }
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>회원정보 입력</DialogTitle>
            <DialogDescription>
              이름과 생년월일이 등록된 사용자만 편집 가능합니다.
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-3'>
            <Input
              placeholder='이름'
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
            />
            <Input
              type='text'
              inputMode='numeric'
              pattern='[0-9]*'
              placeholder='생년월일 (예: 990626)'
              value={birthInput}
              onChange={(event) => setBirthInput(event.target.value)}
            />
            <Button onClick={handleDialogSubmit}>확인</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
