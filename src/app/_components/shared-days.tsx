import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

type Props = {
  sharedThreshold: 2 | 3
  onChangeThreshold: (value: 2 | 3) => void
  items: { date: string; names: string[] }[]
  getColor: (name: string) => string
}

export function SharedDays({
  sharedThreshold,
  onChangeThreshold,
  items,
  getColor,
}: Props) {
  return (
    <Card className='p-4'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-lg font-semibold'>함께 쉬는 날</h2>
        <div className='flex items-center gap-2 text-sm'>
          <button
            type='button'
            onClick={() => onChangeThreshold(2)}
            className={`rounded-full px-3 py-1 ${
              sharedThreshold === 2
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            본인 제외 2명+
          </button>
          <button
            type='button'
            onClick={() => onChangeThreshold(3)}
            className={`rounded-full px-3 py-1 ${
              sharedThreshold === 3
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            본인 제외 3명+
          </button>
        </div>
      </div>
      <div className='flex flex-col gap-3'>
        {items.length === 0 ? (
          <p className='text-sm text-zinc-500'>
            이번 달에 함께 쉬는 날이 없습니다.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.date}
              className='flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2'
            >
              <Badge variant='secondary'>{item.date}</Badge>
              <span className='text-sm text-zinc-600'>함께 쉬는 사람</span>
              <div className='flex flex-wrap gap-2'>
                {item.names.map((name) => (
                  <Badge
                    key={name}
                    className='text-zinc-900'
                    style={{ backgroundColor: getColor(name) }}
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
