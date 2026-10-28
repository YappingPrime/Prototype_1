'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bomb,
  Coins,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Snowflake,
  Trophy,
} from 'lucide-react'
import {
  MAX_HEARTS,
  POWERUPS,
  getSnake,
  type PowerupKind,
  type Progress,
} from '@/lib/catalog'
import { CELL, COLS, ROWS, SnakeEngine, type Dir, type HudState, type RunResult } from '@/lib/game/engine'

type Status = 'idle' | 'playing' | 'paused' | 'over'

interface GameBoardProps {
  progress: Progress
  signedIn: boolean
  onRunEnd: (result: RunResult) => Promise<number | null>
  onConsume: (kind: PowerupKind) => void
  onRequestSignIn: () => void
}

const POWERUP_ICONS: Record<PowerupKind, typeof Shield> = {
  shield: Shield,
  bomb: Bomb,
  freeze: Snowflake,
  heal: Heart,
}

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}

const EMPTY_HUD: HudState = {
  hearts: MAX_HEARTS,
  shield: 0,
  score: 0,
  level: 1,
  kills: 0,
  length: 4,
  frozen: false,
  inventory: { shield: 0, bomb: 0, freeze: 0, heal: 0 },
}

export function GameBoard({ progress, signedIn, onRunEnd, onConsume, onRequestSignIn }: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SnakeEngine | null>(null)
  const statusRef = useRef<Status>('idle')
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const callbacksRef = useRef({ onRunEnd, onConsume })
  callbacksRef.current = { onRunEnd, onConsume }

  const [status, setStatusState] = useState<Status>('idle')
  const [hud, setHud] = useState<HudState>({ ...EMPTY_HUD, inventory: progress.powerups })
  const [result, setResult] = useState<RunResult | null>(null)
  const [coinsEarned, setCoinsEarned] = useState<number | null>(null)

  const snake = getSnake(progress.selectedSnake)

  const setStatus = useCallback((next: Status) => {
    statusRef.current = next
    setStatusState(next)
  }, [])

  const createEngine = useCallback(
    () =>
      new SnakeEngine({
        skin: snake.skin,
        beastSlowdown: snake.perks.beastSlowdown,
        startShield: snake.perks.startShield,
        appleBonus: snake.perks.appleBonus,
        inventory: progress.powerups,
        onHud: setHud,
        onGameOver: (run) => {
          setResult(run)
          setCoinsEarned(null)
          setStatus('over')
          callbacksRef.current.onRunEnd(run).then(setCoinsEarned)
        },
        onPowerupUsed: (kind) => callbacksRef.current.onConsume(kind),
      }),
    [snake, progress.powerups, setStatus],
  )

  useEffect(() => {
    if (statusRef.current === 'idle') engineRef.current = createEngine()
  }, [createEngine])

  const startGame = useCallback(() => {
    engineRef.current = createEngine()
    setResult(null)
    setCoinsEarned(null)
    setStatus('playing')
  }, [createEngine, setStatus])

  const togglePause = useCallback(() => {
    if (statusRef.current === 'playing') setStatus('paused')
    else if (statusRef.current === 'paused') setStatus('playing')
  }, [setStatus])

  const usePowerup = useCallback((kind: PowerupKind) => {
    if (statusRef.current === 'playing') engineRef.current?.usePowerup(kind)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      const engine = engineRef.current
      if (engine) {
        if (statusRef.current === 'playing') engine.update(dt)
        engine.draw(ctx)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      const dir = KEY_DIRS[e.key]
      if (dir && statusRef.current === 'playing') {
        e.preventDefault()
        engineRef.current?.setDirection(dir)
        return
      }
      if (e.key === ' ' || e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (statusRef.current === 'playing' || statusRef.current === 'paused') {
          e.preventDefault()
          togglePause()
        }
        return
      }
      const powerup = POWERUPS.find((p) => p.hotkey === e.key)
      if (powerup) usePowerup(powerup.id)
    }
    const onHidden = () => {
      if (document.hidden && statusRef.current === 'playing') setStatus('paused')
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [togglePause, usePowerup, setStatus])

  const onPointerDown = (e: React.PointerEvent) => {
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || statusRef.current !== 'playing') return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    engineRef.current?.setDirection(dir)
  }

  const steer = (dir: Dir) => engineRef.current?.setDirection(dir)

  return (
    <section aria-label="Game board" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-1" role="img" aria-label={`${hud.hearts} of ${MAX_HEARTS} hearts`}>
          {Array.from({ length: MAX_HEARTS }).map((_, i) => (
            <Heart
              key={i}
              className={`size-6 transition-transform ${
                i < hud.hearts ? 'fill-danger text-danger' : 'text-border'
              }`}
              aria-hidden="true"
            />
          ))}
          {hud.shield > 0 && (
            <span className="ml-2 flex items-center gap-1 rounded-md bg-ice/15 px-2 py-0.5 font-mono text-sm text-ice">
              <Shield className="size-4" aria-hidden="true" />
              {hud.shield}
            </span>
          )}
        </div>

        <dl className="flex items-center gap-5 font-mono text-sm">
          <Stat label="Score" value={hud.score} />
          <Stat label="Level" value={hud.level} />
          <Stat label="Kills" value={hud.kills} icon={<Skull className="size-3.5" aria-hidden="true" />} />
          <Stat label="Best" value={Math.max(progress.highScore, hud.score)} icon={<Trophy className="size-3.5 text-gold" aria-hidden="true" />} />
        </dl>

        <div className="flex items-center gap-2">
          {POWERUPS.map((p) => {
            const Icon = POWERUP_ICONS[p.id]
            const count = hud.inventory[p.id]
            return (
              <button
                key={p.id}
                type="button"
                disabled={status !== 'playing' || count <= 0}
                onClick={(e) => {
                  usePowerup(p.id)
                  e.currentTarget.blur()
                }}
                title={`${p.name} (${p.hotkey}): ${p.description}`}
                aria-label={`${p.name}, ${count} left, hotkey ${p.hotkey}`}
                className="relative flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="block h-auto w-full"
          aria-label="Snake game board"
        />

        {status !== 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
              {status === 'idle' && (
                <>
                  <h2 className="text-balance text-2xl font-bold">Snake Quest</h2>
                  <p className="text-pretty text-sm text-muted">
                    Eat apples, grab hearts and squash the beasts hunting you. You have 3 hearts. The
                    walls wrap around, and the beasts get nastier every 20 seconds.
                  </p>
                  <PrimaryButton onClick={startGame} icon={<Play className="size-4" aria-hidden="true" />}>
                    Start game
                  </PrimaryButton>
                  {!signedIn && (
                    <button
                      type="button"
                      onClick={onRequestSignIn}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Log in to save coins and unlock the shop
                    </button>
                  )}
                </>
              )}
              {status === 'paused' && (
                <>
                  <h2 className="text-2xl font-bold">Paused</h2>
                  <PrimaryButton onClick={togglePause} icon={<Play className="size-4" aria-hidden="true" />}>
                    Resume
                  </PrimaryButton>
                </>
              )}
              {status === 'over' && result && (
                <>
                  <h2 className="text-2xl font-bold text-danger">You were devoured</h2>
                  <dl className="grid w-full grid-cols-3 gap-2 font-mono">
                    <Result label="Score" value={result.score} />
                    <Result label="Kills" value={result.kills} />
                    <Result label="Level" value={result.level} />
                  </dl>
                  {signedIn ? (
                    <p className="flex items-center gap-2 text-sm text-gold">
                      <Coins className="size-4" aria-hidden="true" />
                      {coinsEarned === null ? 'Saving run...' : `+${coinsEarned} coins saved`}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={onRequestSignIn}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Log in to earn coins from your runs
                    </button>
                  )}
                  <PrimaryButton onClick={startGame} icon={<RotateCcw className="size-4" aria-hidden="true" />}>
                    Play again
                  </PrimaryButton>
                </>
              )}
            </div>
          </div>
        )}

        {status === 'playing' && (
          <button
            type="button"
            onClick={togglePause}
            aria-label="Pause"
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg bg-background/70 text-foreground backdrop-blur hover:bg-background"
          >
            <Pause className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 self-center md:hidden" aria-label="On-screen controls">
        <span />
        <DPad label="Up" onPress={() => steer('up')} icon={<ArrowUp className="size-5" />} />
        <span />
        <DPad label="Left" onPress={() => steer('left')} icon={<ArrowLeft className="size-5" />} />
        <DPad label="Down" onPress={() => steer('down')} icon={<ArrowDown className="size-5" />} />
        <DPad label="Right" onPress={() => steer('right')} icon={<ArrowRight className="size-5" />} />
      </div>

      <p className="hidden text-center text-xs text-muted md:block">
        Arrow keys / WASD to move, Space to pause, 1-4 to use power-ups.
      </p>
    </section>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center leading-tight">
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted">
        {icon}
        {label}
      </dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function Result({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function PrimaryButton({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition hover:brightness-110"
    >
      {icon}
      {children}
    </button>
  )
}

function DPad({ label, onPress, icon }: { label: string; onPress: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onPress}
      className="flex size-14 items-center justify-center rounded-xl border border-border bg-surface-2 active:bg-primary active:text-primary-foreground"
    >
      {icon}
    </button>
  )
}
