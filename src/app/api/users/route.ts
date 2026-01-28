import { NextResponse } from "next/server"
import { readJson } from "@/server/utils/fileStore"

export const runtime = "nodejs"

const fallbackUsers = {
  allowedUsers: [
    { name: "고유빈", birth: "1990-01-01" },
    { name: "안준혁", birth: "1990-01-01" },
    { name: "윤철민", birth: "1990-01-01" },
    { name: "우태웅", birth: "1990-01-01" },
    { name: "조용성", birth: "1990-01-01" },
    { name: "김지훈", birth: "1990-01-01" },
  ],
}

// 내부용: 보안 고려 없음
export async function GET() {
  const data = await readJson("users.json", fallbackUsers)
  return NextResponse.json(data)
}
