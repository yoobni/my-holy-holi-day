import { eachDayOfInterval, format } from 'date-fns'
import { ko } from 'date-fns/locale'

import { Card } from '@/components/ui/card'
import { renderNameWithFallback } from './name-utils'

export type Week = {
  start: Date
  end: Date
}

export type WeekBar = {
  userId: number
  name: string
  startKey: string
  endKey: string
  weekIndex: number
  colStart: number
  colSpan: number
}

type UserMeta = {
  name: string
  color?: string | null
}

type Props = {
  weeks: Week[]
  weekBars: WeekBar[]
  userOrder: number[]
  userMetaMap: Map<number, UserMeta>
  getUserColor: (userId: number, name: string) => string
  holidaySet: Set<string>
  toYmd: (date: Date) => string
  currentMonth: Date
}

export function MonthTimeline({
  weeks,
  weekBars,
  userOrder,
  userMetaMap,
  getUserColor,
  holidaySet,
  toYmd,
  currentMonth,
}: Props) {
  return (
    <Card className='p-4'>
      <h2 className='mb-4 text-lg font-semibold'>
        {format(currentMonth, 'M월')} 타임라인
      </h2>
      <div className='flex flex-col gap-6'>
        {weeks.map((week, weekIndex) => {
          const barsForWeek = weekBars.filter(
            (bar) => bar.weekIndex === weekIndex
          )
          const usersInWeek = userOrder.filter((userId) =>
            barsForWeek.some((bar) => bar.userId === userId)
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
                          className={isHoliday ? 'text-red-400 font-semibold' : ''}
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
                    const meta = userMetaMap.get(userId)
                    if (!meta) return null
                    const laneBars = barsForWeek.filter(
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
                              title={`${meta.name} (${bar.startKey} ~ ${bar.endKey})`}
                              className='flex h-8 items-center rounded-full px-3 text-xs font-semibold text-zinc-900'
                              style={{
                                backgroundColor: getUserColor(userId, meta.name),
                              }}
                            >
                              <span className='truncate'>
                                <span className='sm:hidden'>
                                  {renderNameWithFallback(
                                    meta.name,
                                    bar.colSpan <= 1
                                  )}
                                </span>
                                <span className='hidden sm:inline'>
                                  {meta.name}
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
  )
}
