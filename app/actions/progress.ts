'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playerProgress } from '@/lib/db/schema'
import {
  MAX_POWERUP_STACK,
  POWERUPS,
  SNAKES,
  getSnake,
  isPowerupKind,
  type Progress,
} from '@/lib/catalog'
import { loadProgress, toProgress } from '@/lib/progress'

export interface RunSummary {
  score: number
  kills: number
  durationSec: number
}

export type ActionResult =
  | { ok: true; progress: Progress; coinsEarned?: number }
  | { ok: false; error: string }

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

function clampInt(value: unknown, max: number) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, max)
}

export async function submitRun(run: RunSummary): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { ok: false, error: 'Sign in to save your progress.' }

  const durationSec = clampInt(run.durationSec, 60 * 60)
  const score = Math.min(clampInt(run.score, 1_000_000), durationSec * 30 + 30)
  const kills = Math.min(clampInt(run.kills, 10_000), durationSec)

  await loadProgress(userId)

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(playerProgress)
      .where(eq(playerProgress.userId, userId))
      .for('update')
    const current = toProgress(row)
    const snake = getSnake(current.selectedSnake)
    const base = Math.floor(score / 10) + kills
    const coinsEarned = Math.round(base * (1 + snake.perks.coinBonus))

    const [updated] = await tx
      .update(playerProgress)
      .set({
        coins: current.coins + coinsEarned,
        highScore: Math.max(current.highScore, score),
        totalRuns: current.totalRuns + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerProgress.userId, userId))
      .returning()
    return { ok: true as const, progress: toProgress(updated), coinsEarned }
  })
}

export async function consumePowerup(kind: string): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { ok: false, error: 'Not signed in.' }
  if (!isPowerupKind(kind)) return { ok: false, error: 'Unknown power-up.' }

  await loadProgress(userId)

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(playerProgress)
      .where(eq(playerProgress.userId, userId))
      .for('update')
    const current = toProgress(row)
    if (current.powerups[kind] <= 0) return { ok: false as const, error: 'None left.' }
    const [updated] = await tx
      .update(playerProgress)
      .set({
        powerups: { ...current.powerups, [kind]: current.powerups[kind] - 1 },
        updatedAt: new Date(),
      })
      .where(eq(playerProgress.userId, userId))
      .returning()
    return { ok: true as const, progress: toProgress(updated) }
  })
}

export async function buyItem(type: 'snake' | 'powerup', id: string): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { ok: false, error: 'Sign in to shop.' }

  await loadProgress(userId)

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(playerProgress)
      .where(eq(playerProgress.userId, userId))
      .for('update')
    const current = toProgress(row)

    if (type === 'snake') {
      const snake = SNAKES.find((s) => s.id === id)
      if (!snake) return { ok: false as const, error: 'Unknown snake.' }
      if (current.ownedSnakes.includes(snake.id)) {
        return { ok: false as const, error: 'You already own this snake.' }
      }
      if (current.coins < snake.price) return { ok: false as const, error: 'Not enough coins.' }
      const [updated] = await tx
        .update(playerProgress)
        .set({
          coins: current.coins - snake.price,
          ownedSnakes: [...current.ownedSnakes, snake.id],
          updatedAt: new Date(),
        })
        .where(eq(playerProgress.userId, userId))
        .returning()
      return { ok: true as const, progress: toProgress(updated) }
    }

    const powerup = POWERUPS.find((p) => p.id === id)
    if (!powerup) return { ok: false as const, error: 'Unknown power-up.' }
    if (current.powerups[powerup.id] >= MAX_POWERUP_STACK) {
      return { ok: false as const, error: `You can hold at most ${MAX_POWERUP_STACK}.` }
    }
    if (current.coins < powerup.price) return { ok: false as const, error: 'Not enough coins.' }
    const [updated] = await tx
      .update(playerProgress)
      .set({
        coins: current.coins - powerup.price,
        powerups: { ...current.powerups, [powerup.id]: current.powerups[powerup.id] + 1 },
        updatedAt: new Date(),
      })
      .where(eq(playerProgress.userId, userId))
      .returning()
    return { ok: true as const, progress: toProgress(updated) }
  })
}

export async function selectSnake(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  if (!userId) return { ok: false, error: 'Sign in to change snakes.' }

  const current = await loadProgress(userId)
  if (!current.ownedSnakes.includes(id)) return { ok: false, error: 'You do not own this snake.' }

  const [updated] = await db
    .update(playerProgress)
    .set({ selectedSnake: id, updatedAt: new Date() })
    .where(eq(playerProgress.userId, userId))
    .returning()
  return { ok: true, progress: toProgress(updated) }
}
