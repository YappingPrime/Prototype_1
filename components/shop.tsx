'use client'

import { useState } from 'react'
import { Bomb, Check, Coins, Heart, Shield, Snowflake } from 'lucide-react'
import {
  MAX_POWERUP_STACK,
  POWERUPS,
  SNAKES,
  type PowerupKind,
  type Progress,
  type SnakeSkin,
} from '@/lib/catalog'

interface ShopProps {
  progress: Progress
  signedIn: boolean
  pending: boolean
  error: string | null
  onBuy: (type: 'snake' | 'powerup', id: string) => void
  onSelect: (id: string) => void
  onRequestSignIn: () => void
}

const POWERUP_ICONS: Record<PowerupKind, typeof Shield> = {
  shield: Shield,
  bomb: Bomb,
  freeze: Snowflake,
  heal: Heart,
}

export function Shop({ progress, signedIn, pending, error, onBuy, onSelect, onRequestSignIn }: ShopProps) {
  const [tab, setTab] = useState<'snakes' | 'powerups'>('snakes')

  return (
    <section aria-label="Shop" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Shop categories" className="flex rounded-lg border border-border bg-surface p-1">
          {(['snakes', 'powerups'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              {t === 'powerups' ? 'Power-ups' : 'Snakes'}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-2 font-mono text-gold">
          <Coins className="size-4" aria-hidden="true" />
          {progress.coins} coins
        </p>
      </div>

      {!signedIn && (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          <button type="button" onClick={onRequestSignIn} className="font-medium text-primary hover:underline">
            Log in
          </button>{' '}
          to earn coins from your runs and buy items. Your purchases are saved to your account.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {tab === 'snakes' ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SNAKES.map((snake) => {
            const owned = progress.ownedSnakes.includes(snake.id)
            const equipped = progress.selectedSnake === snake.id
            const affordable = progress.coins >= snake.price
            return (
              <li
                key={snake.id}
                className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 ${
                  equipped ? 'border-primary' : 'border-border'
                }`}
              >
                <SkinPreview skin={snake.skin} />
                <div className="flex-1">
                  <h3 className="font-semibold">{snake.name}</h3>
                  <p className="mt-1 text-pretty text-sm text-muted">{snake.description}</p>
                </div>
                {owned ? (
                  <button
                    type="button"
                    disabled={equipped || pending || !signedIn}
                    onClick={() => onSelect(snake.id)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 py-2 text-sm font-semibold transition hover:border-primary disabled:opacity-70 disabled:hover:border-border"
                  >
                    {equipped && <Check className="size-4 text-primary" aria-hidden="true" />}
                    {equipped ? 'Equipped' : 'Equip'}
                  </button>
                ) : (
                  <BuyButton
                    price={snake.price}
                    disabled={pending || !signedIn || !affordable}
                    onClick={() => onBuy('snake', snake.id)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {POWERUPS.map((p) => {
            const Icon = POWERUP_ICONS[p.id]
            const count = progress.powerups[p.id]
            const full = count >= MAX_POWERUP_STACK
            return (
              <li key={p.id} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {p.name} <span className="font-mono text-xs text-muted">key {p.hotkey}</span>
                  </h3>
                  <p className="text-pretty text-sm text-muted">{p.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    Owned: <span className="font-mono text-foreground">{count}</span> / {MAX_POWERUP_STACK}
                  </p>
                </div>
                <div className="w-28 shrink-0">
                  <BuyButton
                    price={p.price}
                    label={full ? 'Full' : undefined}
                    disabled={pending || !signedIn || full || progress.coins < p.price}
                    onClick={() => onBuy('powerup', p.id)}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function BuyButton({
  price,
  label,
  disabled,
  onClick,
}: {
  price: number
  label?: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label ?? (
        <>
          <Coins className="size-4" aria-hidden="true" />
          {price}
        </>
      )}
    </button>
  )
}

function SkinPreview({ skin }: { skin: SnakeSkin }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-background p-3" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="size-6 rounded-md"
          style={{ background: i % 2 === 0 ? skin.body : skin.accent, opacity: i % 2 === 0 ? 1 : 0.85 }}
        />
      ))}
      <span className="size-7 rounded-lg" style={{ background: skin.head }} />
    </div>
  )
}
