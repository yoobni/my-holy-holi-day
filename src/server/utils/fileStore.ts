import fs from "fs/promises"
import path from "path"

const dataDir = path.join(process.cwd(), "data")

export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const filePath = path.join(dataDir, fileName)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as T
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== "ENOENT") {
      throw error
    }
    await writeJson(fileName, fallback)
    return fallback
  }
}

export async function writeJson<T>(fileName: string, data: T): Promise<void> {
  const filePath = path.join(dataDir, fileName)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp`
  const payload = JSON.stringify(data, null, 2)
  await fs.writeFile(tmpPath, payload, "utf-8")
  await fs.rename(tmpPath, filePath)
}
