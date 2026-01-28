import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Props = {
  selectedDates: string[]
  isReadOnly: boolean
  loading: boolean
  onAdd: () => void
  onDelete: () => void
}

export function SelectedFooter({
  selectedDates,
  isReadOnly,
  loading,
  onAdd,
  onDelete,
}: Props) {
  if (selectedDates.length === 0) return null

  return (
    <footer className='sticky bottom-0 z-10 border-t border-zinc-200 bg-white/95 px-6 py-4 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-wrap items-center gap-2 text-sm'>
          <span className='text-zinc-600'>선택된 날짜</span>
          {selectedDates.map((date) => (
            <Badge key={date} variant='secondary'>
              {date}
            </Badge>
          ))}
        </div>
        <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center'>
          <div className='grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto'>
            <Button
              className='w-full sm:w-auto sm:flex-1'
              disabled={isReadOnly || selectedDates.length === 0 || loading}
              onClick={onAdd}
            >
              휴무일 지정
            </Button>
            <Button
              className='w-full sm:w-auto sm:flex-1'
              variant='outline'
              disabled={isReadOnly || selectedDates.length === 0 || loading}
              onClick={onDelete}
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
  )
}
