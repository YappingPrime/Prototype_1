export type PowerupKind = 'shield' | 'bomb' | 'freeze' | 'heal'

export interface SnakeSkin {
  head: string
  body: string
  accent: string
}

export interface SnakePerks {
  coinBonus: number
  beastSlowdown: number
  startShield: number
  appleBonus: number
}

export interface SnakeItem {
  id: string
  name: string
  description: string
  price: number
  skin: SnakeSkin
  perks: SnakePerks
}

export interface PowerupItem {
  id: PowerupKind
  name: string
  description: string
  price: number
  hotkey: string
}

const NO_PERKS: SnakePerks = { coinBonus: 0, beastSlowdown: 0, startShield: 0, appleBonus: 0 }

export const SNAKES: SnakeItem[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'The original green slitherer. No frills.',
    price: 0,
    skin: { head: '#bef264', body: '#65a30d', accent: '#d9f99d' },
    perks: NO_PERKS,
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Earns 15% more coins at the end of each run.',
    price: 200,
    skin: { head: '#fdba74', body: '#ea580c', accent: '#fed7aa' },
    perks: { ...NO_PERKS, coinBonus: 0.15 },
  },
  {
    id: 'frost',
    name: 'Frost',
    description: 'Beasts shiver and skip 25% of their moves.',
    price: 350,
    skin: { head: '#a5f3fc', body: '#0891b2', accent: '#ecfeff' },
    perks: { ...NO_PERKS, beastSlowdown: 0.25 },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Every apple is worth 5 bonus points.',
    price: 500,
    skin: { head: '#6ee7b7', body: '#059669', accent: '#d1fae5' },
    perks: { ...NO_PERKS, appleBonus: 5 },
  },
  {
    id: 'golden',
    name: 'Golden',
    description: 'Earns 35% more coins at the end of each run.',
    price: 800,
    skin: { head: '#fde68a', body: '#d97706', accent: '#fffbeb' },
    perks: { ...NO_PERKS, coinBonus: 0.35 },
  },
  {
    id: 'shadow',
    name: 'Shadow',
    description: 'Starts every run with a free shield.',
    price: 1200,
    skin: { head: '#c4b5fd', body: '#6d28d9', accent: '#ede9fe' },
    perks: { ...NO_PERKS, startShield: 1 },
  },
]

export const POWERUPS: PowerupItem[] = [
  {
    id: 'shield',
    name: 'Shield',
    description: 'Blocks the next hit you take.',
    price: 40,
    hotkey: '1',
  },
  {
    id: 'bomb',
    name: 'Bomb',
    description: 'Blasts every beast on the board.',
    price: 60,
    hotkey: '2',
  },
  {
    id: 'freeze',
    name: 'Freeze',
    description: 'Freezes all beasts for 6 seconds.',
    price: 50,
    hotkey: '3',
  },
  {
    id: 'heal',
    name: 'Heal',
    description: 'Restores one heart (max 3).',
    price: 80,
    hotkey: '4',
  },
]

export const MAX_POWERUP_STACK = 9
export const MAX_HEARTS = 3

export interface Progress {
  coins: number
  highScore: number
  totalRuns: number
  selectedSnake: string
  ownedSnakes: string[]
  powerups: Record<PowerupKind, number>
}

export const DEFAULT_PROGRESS: Progress = {
  coins: 0,
  highScore: 0,
  totalRuns: 0,
  selectedSnake: 'classic',
  ownedSnakes: ['classic'],
  powerups: { shield: 0, bomb: 0, freeze: 0, heal: 0 },
}

export function getSnake(id: string): SnakeItem {
  return SNAKES.find((s) => s.id === id) ?? SNAKES[0]
}

export function isPowerupKind(value: unknown): value is PowerupKind {
  return POWERUPS.some((p) => p.id === value)
}
