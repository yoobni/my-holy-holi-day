import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  birth: string
  onChangeName: (value: string) => void
  onChangeBirth: (value: string) => void
  onSubmit: () => void
}

export function AuthDialog({
  open,
  onOpenChange,
  name,
  birth,
  onChangeName,
  onChangeBirth,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            value={name}
            onChange={(event) => onChangeName(event.target.value)}
          />
          <Input
            type='text'
            inputMode='numeric'
            pattern='[0-9]*'
            placeholder='생년월일 (예: 990626)'
            value={birth}
            onChange={(event) => onChangeBirth(event.target.value)}
          />
          <Button onClick={onSubmit}>확인</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
