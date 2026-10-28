'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Coins, Gamepad2, LogIn, LogOut, ShoppingBag } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { DEFAULT_PROGRESS, type PowerupKind, type Progress } from '@/lib/catalog'
import type { RunResult } from '@/lib/game/engine'
import { buyItem, consumePowerup, selectSnake, submitRun } from '@/app/actions/progress'
import { AuthDialog } from '@/components/auth-dialog'
import { GameBoard } from '@/components/game-board'
import { Shop } from '@/components/shop'

interface GameAppProps {
  user: { name: string } | null
  initialProgress: Progress | null
}

export function GameApp({ user, initialProgress }: GameAppProps) {
  const router = useRouter()
  const [progress, setProgress] = useState<Progress>(initialProgress ?? DEFAULT_PROGRESS)
  const [view, setView] = useState<'play' | 'shop'>('play')
  const [authOpen, setAuthOpen] = useState(false)
  const [shopError, setShopError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const signedIn = user !== null

  const handleRunEnd = useCallback(
    async (run: RunResult) => {
      if (!signedIn) return null
      const res = await submitRun({ score: run.score, kills: run.kills, durationSec: run.durationSec })
      if (!res.ok) return null
      setProgress(res.progress)
      return res.coinsEarned ?? 0
    },
    [signedIn],
  )

  const handleConsume = useCallback(
    (kind: PowerupKind) => {
      if (!signedIn) return
      consumePowerup(kind).then((res) => {
        if (res.ok) setProgress((prev) => ({ ...prev, powerups: res.progress.powerups }))
      })
    },
    [signedIn],
  )

  const handleBuy = (type: 'snake' | 'powerup', id: string) => {
    setShopError(null)
    startTransition(async () => {
      const res = await buyItem(type, id)
      if (res.ok) setProgress(res.progress)
      else setShopError(res.error)
    })
  }

  const handleSelect = (id: string) => {
    setShopError(null)
    startTransition(async () => {
      const res = await selectSnake(id)
      if (res.ok) setProgress(res.progress)
      else setShopError(res.error)
    })
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Snake <span className="text-primary">Quest</span>
        </h1>

        <nav aria-label="Main" className="flex rounded-lg border border-border bg-surface p-1">
          <NavButton active={view === 'play'} onClick={() => setView('play')} icon={<Gamepad2 className="size-4" aria-hidden="true" />}>
            Play
          </NavButton>
          <NavButton active={view === 'shop'} onClick={() => setView('shop')} icon={<ShoppingBag className="size-4" aria-hidden="true" />}>
            Shop
          </NavButton>
        </nav>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 font-mono text-sm text-gold">
            <Coins className="size-4" aria-hidden="true" />
            {progress.coins}
          </span>
          {signedIn ? (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-32 truncate text-sm text-muted sm:block">{user.name}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Log out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Log in
            </button>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div hidden={view !== 'play'}>
          <GameBoard
            progress={progress}
            signedIn={signedIn}
            onRunEnd={handleRunEnd}
            onConsume={handleConsume}
            onRequestSignIn={() => setAuthOpen(true)}
          />
        </div>
        {view === 'shop' && (
          <Shop
            progress={progress}
            signedIn={signedIn}
            pending={pending}
            error={shopError}
            onBuy={handleBuy}
            onSelect={handleSelect}
            onRequestSignIn={() => setAuthOpen(true)}
          />
        )}
      </main>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}

function NavButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
