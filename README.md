# 휴무일 캘린더 (Supabase 저장)

내부용 단일 페이지 앱입니다. 데이터는 Supabase에 저장됩니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경 변수

로컬에서는 `.env.local`에 아래 값을 넣어야 합니다.

```
SUPABASE_URL=... 
SUPABASE_ANON_KEY=...
```

Vercel 배포 시에도 동일한 키를 환경변수로 등록해야 합니다.

## 데이터 구조 (Supabase)

### users
- `id` (PK)
- `name`
- `birth` (6자리: 예 `990626`)
- `color`

### offdays
- `date` (DATE)
- `user_id` (FK -> users.id)
- `name`
- `created_at`
- `unique(date, user_id)`

## 보안 관련 주의

내부용이므로 **보안(서명, JWT, HTTPOnly, CSRF 등)을 전혀 고려하지 않습니다.**

## 사용 시나리오

1) 최초 접속 → 회원정보 입력(로컬 저장)
2) 달력에서 휴무일 선택 → 휴무일 지정
3) 달력/타임라인에서 휴무일 표시 확인
4) 여러 날짜 선택 → 일괄 삭제
5) 로그아웃(로컬 저장 삭제)
