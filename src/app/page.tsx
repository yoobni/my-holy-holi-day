"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns"
import { ko } from "date-fns/locale"
import { toast } from "sonner"
import "react-day-picker/dist/style.css"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

const STORAGE_KEY = "offday-user"

type AllowedUser = {
  name: string
  birth: string
}

type OffdayItem = {
  date: string
  name: string
  createdAt: string
}

type StoredUser = {
  name: string
  birth: string
}

function dateFromYmd(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function normalizeBirth(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 8) {
    return digits.slice(2)
  }
  return digits
}

export default function Home() {
  const [allowedUsers, setAllowedUsers] = React.useState<AllowedUser[]>([])
  const [currentUser, setCurrentUser] = React.useState<StoredUser | null>(null)
  const [canEdit, setCanEdit] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(true)
  const [nameInput, setNameInput] = React.useState("")
  const [birthInput, setBirthInput] = React.useState("")
  const [offdays, setOffdays] = React.useState<OffdayItem[]>([])
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([])
  const [loading, setLoading] = React.useState(false)
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date())

  const offdayDateMap = React.useMemo(() => {
    const map = new Map<string, OffdayItem>()
    for (const item of offdays) {
      map.set(item.date, item)
    }
    return map
  }, [offdays])

  const myOffdayDates = React.useMemo(() => {
    if (!currentUser) return []
    return offdays
      .filter((item) => item.name === currentUser.name)
      .map((item) => dateFromYmd(item.date))
  }, [offdays, currentUser])

  const offdayByUser = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const item of offdays) {
      if (!map.has(item.name)) {
        map.set(item.name, new Set())
      }
      map.get(item.name)?.add(item.date)
    }
    return map
  }, [offdays])

  const offdayDates = React.useMemo(
    () => offdays.map((item) => dateFromYmd(item.date)),
    [offdays]
  )

  const selectedYmd = React.useMemo(
    () => selectedDates.map((date) => toYmd(date)).sort(),
    [selectedDates]
  )

  const fetchUsers = React.useCallback(async () => {
    const res = await fetch("/api/users", { cache: "no-store" })
    if (!res.ok) {
      throw new Error("Failed to load users")
    }
    const data = (await res.json()) as { allowedUsers: AllowedUser[] }
    setAllowedUsers(data.allowedUsers)
    return data.allowedUsers
  }, [])

  const fetchOffdays = React.useCallback(async () => {
    const res = await fetch("/api/offdays", { cache: "no-store" })
    if (!res.ok) {
      throw new Error("Failed to load offdays")
    }
    const data = (await res.json()) as { items: OffdayItem[] }
    setOffdays(data.items)
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
          const valid = users.some(
            (user) => user.name === parsed.name && user.birth === parsed.birth
          )
          if (valid) {
            setCurrentUser(parsed)
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
        toast.error("회원 정보를 불러오지 못했습니다.")
      }
    }

    init()
    fetchOffdays().catch(() => {
      toast.error("휴무일을 불러오지 못했습니다.")
    })

    return () => {
      mounted = false
    }
  }, [fetchUsers, fetchOffdays])

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
      toast.error("회원정보가 일치하지 않습니다. 읽기 전용으로 유지됩니다.")
      return
    }

    const stored: StoredUser = {
      name: matched.name,
      birth: normalizeBirth(matched.birth),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    setCurrentUser(stored)
    setCanEdit(true)
    setDialogOpen(false)
    toast.success("편집 권한이 부여되었습니다.")
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setCurrentUser(null)
    setCanEdit(false)
    setDialogOpen(true)
    setNameInput("")
    setBirthInput("")
  }

  const handleAddOffdays = async () => {
    if (!currentUser || selectedYmd.length === 0) return
    setLoading(true)
    try {
      const res = await fetch("/api/offdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: selectedYmd, name: currentUser.name }),
      })

      if (!res.ok) {
        throw new Error("등록 실패")
      }

      const result = (await res.json()) as {
        added: string[]
        skipped: string[]
      }

      if (result.added.length > 0) {
        toast.success(`등록 완료: ${result.added.join(", ")}`)
      }
      if (result.skipped.length > 0) {
        toast.info(`이미 등록됨: ${result.skipped.join(", ")}`)
      }

      setSelectedDates([])
      await fetchOffdays()
    } catch (error) {
      toast.error("휴무일 등록에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOffdays = async () => {
    if (selectedYmd.length === 0) return
    setLoading(true)
    try {
      const res = await fetch("/api/offdays", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: selectedYmd }),
      })

      if (!res.ok) {
        throw new Error("삭제 실패")
      }

      toast.success(`삭제 완료: ${selectedYmd.join(", ")}`)
      setSelectedDates([])
      await fetchOffdays()
    } catch (error) {
      toast.error("휴무일 삭제에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const isReadOnly = !canEdit

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-6 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">휴무일 캘린더</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isReadOnly ? "secondary" : "default"}>
              {isReadOnly ? "읽기 전용" : "편집 가능"}
            </Badge>
            {currentUser ? (
              <Badge variant="secondary">{currentUser.name}</Badge>
            ) : (
              <Badge variant="outline">미확인</Badge>
            )}
            <Button variant="outline" onClick={handleLogout}>
              로그아웃 / 정보 재입력
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <main className="grid gap-6 lg:grid-cols-1">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">달력</h2>
            <DayPicker
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates ?? [])}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ko}
              formatters={{
                formatCaption: (date) => format(date, "yyyy년 M월", { locale: ko }),
              }}
              modifiers={{ offday: myOffdayDates }}
              modifiersClassNames={{
                offday: "bg-emerald-100 text-emerald-900 font-semibold",
              }}
              className="rounded-lg"
            />
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">선택됨: {selectedYmd.length}</Badge>
              <Badge variant="outline">내 휴무일 표시됨</Badge>
            </div>
          </Card>
        </main>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">휴무 타임라인</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[140px_repeat(31,minmax(28px,1fr))] border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
                <div className="px-3 py-2">이름</div>
                {eachDayOfInterval({
                  start: startOfMonth(currentMonth),
                  end: endOfMonth(currentMonth),
                }).map((day) => (
                  <div
                    key={day.toISOString()}
                    className="flex flex-col items-center justify-center px-1 py-2"
                  >
                    <span>{format(day, "d")}</span>
                    <span className="text-[10px] text-zinc-400">
                      {format(day, "EEE", { locale: ko })}
                    </span>
                  </div>
                ))}
              </div>

              {allowedUsers.length === 0 && (
                <div className="px-4 py-6 text-sm text-zinc-500">
                  사용자 정보를 불러오는 중입니다.
                </div>
              )}
              {allowedUsers.map((user) => {
                const userDates = offdayByUser.get(user.name) ?? new Set()
                const days = eachDayOfInterval({
                  start: startOfMonth(currentMonth),
                  end: endOfMonth(currentMonth),
                })
                return (
                  <div
                    key={user.name}
                    className="grid grid-cols-[140px_repeat(31,minmax(28px,1fr))] border-b border-zinc-100 text-sm"
                  >
                    <div className="flex items-center gap-2 px-3 py-3">
                      <Badge variant="secondary">{user.name}</Badge>
                    </div>
                    {days.map((day) => {
                      const ymd = toYmd(day)
                      const hasOffday = userDates.has(ymd)
                      const prev = format(day, "d") !== "1" && userDates.has(
                        toYmd(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1))
                      )
                      const next = format(day, "d") !== format(endOfMonth(currentMonth), "d") && userDates.has(
                        toYmd(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1))
                      )
                      return (
                        <div key={ymd} className="relative h-10 px-1 py-2">
                          {hasOffday && (
                            <div
                              className={[
                                "absolute inset-y-2 left-0 right-0 bg-emerald-200",
                                !prev ? "rounded-l-full" : "",
                                !next ? "rounded-r-full" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            달력 월을 변경하면 타임라인도 같은 월 기준으로 업데이트됩니다.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold">휴무일 목록</h2>
          <div className="flex flex-col gap-3">
            {offdays.length === 0 && (
              <p className="text-sm text-zinc-500">등록된 휴무일이 없습니다.</p>
            )}
            {offdays.map((item) => (
              <div
                key={item.date}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.date}</Badge>
                  <span className="text-sm text-zinc-600">휴무자</span>
                  <Badge>{item.name}</Badge>
                </div>
                <span className="text-xs text-zinc-400">
                  {item.createdAt.replace("T", " ").replace("Z", "")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {selectedYmd.length > 0 && (
        <footer className="sticky bottom-0 z-10 border-t border-zinc-200 bg-white/95 px-6 py-4 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-zinc-600">선택된 날짜</span>
              {selectedYmd.map((date) => (
                <Badge key={date} variant="secondary">
                  {date}
                </Badge>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                disabled={isReadOnly || selectedYmd.length === 0 || loading}
                onClick={handleAddOffdays}
              >
                휴무일 지정
              </Button>
              <Button
                variant="outline"
                disabled={isReadOnly || selectedYmd.length === 0 || loading}
                onClick={handleDeleteOffdays}
              >
                휴무일 삭제
              </Button>
              {isReadOnly && (
                <span className="text-xs text-zinc-500">
                  읽기 전용 상태에서는 등록/삭제가 비활성화됩니다.
                </span>
              )}
            </div>
          </div>
        </footer>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open && !canEdit) {
            toast.info("읽기 전용으로 계속됩니다.")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>회원정보 입력</DialogTitle>
            <DialogDescription>
              이름과 생년월일이 등록된 사용자만 편집 가능합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="이름"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
            />
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="생년월일 (예: 990626)"
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
