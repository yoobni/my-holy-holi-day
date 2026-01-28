import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

type Props = {
  todayKey: string
  isMyOffday: boolean
  todayNames: string[]
  tomorrowKey: string
  tomorrowNames: string[]
}

export function Summary({
  todayKey,
  isMyOffday,
  todayNames,
  tomorrowKey,
  tomorrowNames,
}: Props) {
  return (
    <Card className='p-4'>
      <h2 className='text-lg font-semibold'>금일 요약</h2>
      <div className='flex flex-wrap items-center gap-3 text-sm'>
        <Badge variant={isMyOffday ? 'default' : 'secondary'}>
          {isMyOffday ? '오늘은 내 휴무일' : '오늘은 근무일'}
        </Badge>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='outline'>오늘: {todayKey}</Badge>
        {todayNames.length === 0 ? (
          <span className='text-sm text-zinc-500'>
            오늘 휴무인 사람이 없습니다.
          </span>
        ) : (
          <>
            <span className='text-sm text-zinc-600'>오늘 쉬는 사람</span>
            {todayNames.map((name) => (
              <Badge key={name}>{name}</Badge>
            ))}
          </>
        )}
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='outline'>내일: {tomorrowKey}</Badge>
        {tomorrowNames.length === 0 ? (
          <span className='text-sm text-zinc-500'>
            내일 휴무인 사람이 없습니다.
          </span>
        ) : (
          <>
            <span className='text-sm text-zinc-600'>내일 쉬는 사람</span>
            {tomorrowNames.map((name) => (
              <Badge key={name}>{name}</Badge>
            ))}
          </>
        )}
      </div>
    </Card>
  )
}
