import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  selectedDates: Date[]
  onSelectDates: (dates: Date[] | undefined) => void
  myOffdayDates: Date[]
  holidaySet: Set<string>
  toYmd: (date: Date) => string
  myMonthlyOffdayCount: number
  selectedCount: number
}

export function CalendarSection({
  currentMonth,
  onMonthChange,
  selectedDates,
  onSelectDates,
  myOffdayDates,
  holidaySet,
  toYmd,
  myMonthlyOffdayCount,
  selectedCount,
}: Props) {
  return (
    <Card className='px-4 py-4'>
      <h2 className='mb-4 text-lg font-semibold'>달력</h2>
      <DayPicker
        mode='multiple'
        selected={selectedDates}
        onSelect={onSelectDates}
        month={currentMonth}
        onMonthChange={onMonthChange}
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
        <Badge variant='outline'>이번 달 휴무일: {myMonthlyOffdayCount}개</Badge>
        <Badge variant='secondary'>선택됨: {selectedCount}</Badge>
        <Badge variant='outline'>본인 휴무일만 표시</Badge>
      </div>
    </Card>
  )
}
