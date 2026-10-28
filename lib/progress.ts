import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { playerProgress } from '@/lib/db/schema'
import { POWERUPS, SNAKES, type PowerupKind, type Progress } from '@/lib/catalog'

type Row = typeof playerProgress.$inferSelect

export function toProgress(row: Row): Progress {
  const powerups = { shield: 0, bomb: 0, freeze: 0, heal: 0 } as Record<PowerupKind, number>
  for (const p of POWERUPS) {
    const n = Number(row.powerups?.[p.id] ?? 0)
    powerups[p.id] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }
  const owned = row.ownedSnakes.filter((id) => SNAKES.some((s) => s.id === id))
  if (!owned.includes('classic')) owned.unshift('classic')
  return {
    coins: row.coins,
    highScore: row.highScore,
    totalRuns: row.totalRuns,
    selectedSnake: owned.includes(row.selectedSnake) ? row.selectedSnake : 'classic',
    ownedSnakes: owned,
    powerups,
  }
}

export async function loadProgress(userId: string): Promise<Progress> {
  await db.insert(playerProgress).values({ userId }).onConflictDoNothing()
  const [row] = await db.select().from(playerProgress).where(eq(playerProgress.userId, userId))
  return toProgress(row)
}
