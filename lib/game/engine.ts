import { MAX_HEARTS, type PowerupKind, type SnakeSkin } from '@/lib/catalog'

export const COLS = 36
export const ROWS = 26
export const CELL = 22

export type Dir = 'up' | 'down' | 'left' | 'right'
type BeastType = 'imp' | 'bat' | 'ogre'

interface Pt {
  x: number
  y: number
}

interface Beast extends Pt {
  id: number
  type: BeastType
  hp: number
  cooldown: number
}

interface FloatText extends Pt {
  text: string
  color: string
  life: number
}

const VEC: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

const BEAST_BASE_DELAY: Record<BeastType, number> = { imp: 3, bat: 2, ogre: 4 }
const BEAST_POINTS: Record<BeastType, number> = { imp: 15, bat: 20, ogre: 40 }

const FREEZE_MS = 6000
const LEVEL_MS = 20000

export interface HudState {
  hearts: number
  shield: number
  score: number
  level: number
  kills: number
  length: number
  frozen: boolean
  inventory: Record<PowerupKind, number>
}

export interface RunResult {
  score: number
  kills: number
  durationSec: number
  level: number
}

export interface EngineOptions {
  skin: SnakeSkin
  beastSlowdown: number
  startShield: number
  appleBonus: number
  inventory: Record<PowerupKind, number>
  onHud: (hud: HudState) => void
  onGameOver: (result: RunResult) => void
  onPowerupUsed: (kind: PowerupKind) => void
}

const mod = (n: number, m: number) => ((n % m) + m) % m
const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y

function shortestDelta(from: number, to: number, size: number) {
  let d = mod(to - from, size)
  if (d > size / 2) d -= size
  return d
}

export class SnakeEngine {
  private snake: Pt[] = []
  private dir: Dir = 'right'
  private queue: Dir[] = []
  private apple: Pt = { x: 0, y: 0 }
  private heart: (Pt & { expires: number }) | null = null
  private beasts: Beast[] = []
  private nextBeastId = 1
  private texts: FloatText[] = []

  private hearts = MAX_HEARTS
  private shield = 0
  private invuln = 0
  private hitFlash = 0
  private score = 0
  private kills = 0
  private elapsed = 0
  private stepAcc = 0
  private spawnAcc = 0
  private freezeUntil = 0
  private tick = 0
  private inventory: Record<PowerupKind, number>
  over = false

  constructor(private opts: EngineOptions) {
    this.inventory = { ...opts.inventory }
    this.shield = opts.startShield
    const cy = Math.floor(ROWS / 2)
    const cx = Math.floor(COLS / 2)
    for (let i = 0; i < 4; i++) this.snake.push({ x: cx - i, y: cy })
    this.apple = this.randomFreeCell()
    this.emitHud()
  }

  get level() {
    return 1 + Math.floor(this.elapsed / LEVEL_MS)
  }

  private get frozen() {
    return this.elapsed < this.freezeUntil
  }

  private stepInterval() {
    return Math.max(70, 150 - (this.level - 1) * 7)
  }

  private maxBeasts() {
    return Math.min(16, 2 + Math.floor(this.level * 1.5))
  }

  private spawnInterval() {
    return Math.max(1200, 5000 - (this.level - 1) * 400)
  }

  setDirection(next: Dir) {
    const last = this.queue.length > 0 ? this.queue[this.queue.length - 1] : this.dir
    if (next === last || next === OPPOSITE[last]) return
    if (this.queue.length < 2) this.queue.push(next)
  }

  usePowerup(kind: PowerupKind) {
    if (this.over || this.inventory[kind] <= 0) return
    if (kind === 'heal' && this.hearts >= MAX_HEARTS) return
    if (kind === 'shield' && this.shield >= 3) return

    const head = this.snake[0]
    if (kind === 'shield') {
      this.shield++
      this.addText(head, 'SHIELD', '#67e8f9')
    } else if (kind === 'heal') {
      this.hearts++
      this.addText(head, '+1 HEART', '#fb4b6a')
    } else if (kind === 'freeze') {
      this.freezeUntil = this.elapsed + FREEZE_MS
      this.addText(head, 'FREEZE', '#67e8f9')
    } else {
      for (const b of this.beasts) {
        this.kills++
        this.score += BEAST_POINTS[b.type]
        this.addText(b, 'BOOM', '#fbbf24')
      }
      this.beasts = []
      this.hitFlash = 250
    }
    this.inventory[kind]--
    this.opts.onPowerupUsed(kind)
    this.emitHud()
  }

  update(dtMs: number) {
    if (this.over) return
    const dt = Math.min(dtMs, 100)
    this.elapsed += dt
    this.invuln = Math.max(0, this.invuln - dt)
    this.hitFlash = Math.max(0, this.hitFlash - dt)

    this.spawnAcc += dt
    if (this.spawnAcc >= this.spawnInterval()) {
      this.spawnAcc = 0
      if (this.beasts.length < this.maxBeasts()) this.spawnBeast()
    }

    this.stepAcc += dt
    const interval = this.stepInterval()
    while (this.stepAcc >= interval && !this.over) {
      this.stepAcc -= interval
      this.step()
    }

    if (this.heart && this.elapsed > this.heart.expires) this.heart = null
    for (const t of this.texts) t.life -= dt
    this.texts = this.texts.filter((t) => t.life > 0)
    this.emitHud()
  }

  private step() {
    this.tick++
    if (this.queue.length > 0) this.dir = this.queue.shift() as Dir

    const head = this.snake[0]
    const v = VEC[this.dir]
    const nextHead = { x: mod(head.x + v.x, COLS), y: mod(head.y + v.y, ROWS) }
    const ate = same(nextHead, this.apple)

    const body = ate ? this.snake : this.snake.slice(0, -1)
    const selfHit = body.some((s) => same(s, nextHead))

    this.snake.unshift(nextHead)
    if (!ate) this.snake.pop()

    if (selfHit) this.damage()
    if (this.over) return

    for (const beast of [...this.beasts]) {
      if (same(beast, nextHead)) this.biteBeast(beast)
    }

    if (ate) {
      this.score += 10 + this.opts.appleBonus
      this.addText(nextHead, `+${10 + this.opts.appleBonus}`, '#bef264')
      this.apple = this.randomFreeCell()
      if (this.hearts < MAX_HEARTS && !this.heart && Math.random() < 0.3) {
        const cell = this.randomFreeCell()
        this.heart = { ...cell, expires: this.elapsed + 10000 }
      }
    }

    if (this.heart && same(this.heart, nextHead)) {
      this.heart = null
      if (this.hearts < MAX_HEARTS) this.hearts++
      this.addText(nextHead, '+1 HEART', '#fb4b6a')
    }

    this.moveBeasts()
  }

  private biteBeast(beast: Beast) {
    beast.hp--
    if (beast.hp <= 0) {
      this.beasts = this.beasts.filter((b) => b.id !== beast.id)
      this.kills++
      this.score += BEAST_POINTS[beast.type]
      this.addText(beast, `+${BEAST_POINTS[beast.type]}`, '#fbbf24')
    } else {
      const v = VEC[this.dir]
      beast.x = mod(beast.x + v.x * 3, COLS)
      beast.y = mod(beast.y + v.y * 3, ROWS)
      this.addText(beast, 'HIT', '#fdba74')
    }
  }

  private moveBeasts() {
    if (this.frozen) return
    const head = this.snake[0]
    const attackers: Beast[] = []

    for (const b of this.beasts) {
      b.cooldown--
      if (b.cooldown > 0) continue
      b.cooldown = Math.max(1, BEAST_BASE_DELAY[b.type] - Math.floor((this.level - 1) / 4))
      if (Math.random() < this.opts.beastSlowdown) continue

      const dx = shortestDelta(b.x, head.x, COLS)
      const dy = shortestDelta(b.y, head.y, ROWS)

      if (b.type === 'bat' && Math.random() < 0.3) {
        const options = Object.values(VEC)
        const r = options[Math.floor(Math.random() * options.length)]
        b.x = mod(b.x + r.x, COLS)
        b.y = mod(b.y + r.y, ROWS)
      } else if (dx === 0 && dy === 0) {
        // already on the head
      } else {
        let moveX = Math.abs(dx) >= Math.abs(dy)
        if (dx !== 0 && dy !== 0 && Math.random() < 0.25) moveX = !moveX
        if (dx === 0) moveX = false
        if (dy === 0) moveX = true
        if (moveX) b.x = mod(b.x + Math.sign(dx), COLS)
        else b.y = mod(b.y + Math.sign(dy), ROWS)
      }

      if (this.snake.some((s) => same(s, b))) attackers.push(b)
    }

    for (const b of attackers) {
      this.beasts = this.beasts.filter((o) => o.id !== b.id)
      this.addText(b, 'CHOMP', '#fb4b6a')
      this.damage()
      if (this.over) return
    }
  }

  private damage() {
    if (this.invuln > 0) return
    if (this.shield > 0) {
      this.shield--
      this.invuln = 800
      this.addText(this.snake[0], 'BLOCKED', '#67e8f9')
      return
    }
    this.hearts--
    this.invuln = 1600
    this.hitFlash = 350
    if (this.hearts <= 0) {
      this.hearts = 0
      this.over = true
      this.emitHud()
      this.opts.onGameOver({
        score: this.score,
        kills: this.kills,
        durationSec: Math.floor(this.elapsed / 1000),
        level: this.level,
      })
    }
  }

  private spawnBeast() {
    const r = Math.random()
    const type: BeastType =
      this.level >= 5 && r < 0.25 ? 'ogre' : this.level >= 3 && r < 0.55 ? 'bat' : 'imp'
    const head = this.snake[0]
    let cell = this.randomFreeCell()
    for (let i = 0; i < 20; i++) {
      const dist =
        Math.abs(shortestDelta(head.x, cell.x, COLS)) +
        Math.abs(shortestDelta(head.y, cell.y, ROWS))
      if (dist >= 10) break
      cell = this.randomFreeCell()
    }
    this.beasts.push({
      id: this.nextBeastId++,
      type,
      x: cell.x,
      y: cell.y,
      hp: type === 'ogre' ? 2 : 1,
      cooldown: BEAST_BASE_DELAY[type],
    })
  }

  private randomFreeCell(): Pt {
    for (let i = 0; i < 200; i++) {
      const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
      if (!this.snake.some((s) => same(s, c)) && !this.beasts.some((b) => same(b, c))) return c
    }
    return { x: 0, y: 0 }
  }

  private addText(at: Pt, text: string, color: string) {
    this.texts.push({ x: at.x, y: at.y, text, color, life: 900 })
  }

  private emitHud() {
    this.opts.onHud({
      hearts: this.hearts,
      shield: this.shield,
      score: this.score,
      level: this.level,
      kills: this.kills,
      length: this.snake.length,
      frozen: this.frozen,
      inventory: { ...this.inventory },
    })
  }

  draw(ctx: CanvasRenderingContext2D) {
    const w = COLS * CELL
    const h = ROWS * CELL
    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = '#0d1612'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#12201a'
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }

    this.drawApple(ctx)
    if (this.heart) this.drawHeart(ctx, this.heart)
    for (const b of this.beasts) this.drawBeast(ctx, b)
    this.drawSnake(ctx)

    if (this.frozen) {
      ctx.fillStyle = 'rgba(103, 232, 249, 0.12)'
      ctx.fillRect(0, 0, w, h)
    }
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(251, 75, 106, ${Math.min(0.35, this.hitFlash / 1000)})`
      ctx.fillRect(0, 0, w, h)
    }

    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life / 400)
      ctx.fillStyle = t.color
      ctx.fillText(t.text, t.x * CELL + CELL / 2, t.y * CELL - (900 - t.life) / 40)
    }
    ctx.globalAlpha = 1
  }

  private drawApple(ctx: CanvasRenderingContext2D) {
    const cx = this.apple.x * CELL + CELL / 2
    const cy = this.apple.y * CELL + CELL / 2
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(cx, cy + 1, CELL * 0.36, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#65a30d'
    ctx.fillRect(cx - 1, cy - CELL * 0.4, 2, 5)
  }

  private drawHeart(ctx: CanvasRenderingContext2D, p: Pt) {
    const cx = p.x * CELL + CELL / 2
    const cy = p.y * CELL + CELL / 2
    const pulse = 1 + Math.sin(this.elapsed / 120) * 0.1
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(pulse, pulse)
    ctx.fillStyle = '#fb4b6a'
    ctx.beginPath()
    ctx.moveTo(0, 7)
    ctx.bezierCurveTo(-12, -1, -7, -10, 0, -4)
    ctx.bezierCurveTo(7, -10, 12, -1, 0, 7)
    ctx.fill()
    ctx.restore()
  }

  private drawBeast(ctx: CanvasRenderingContext2D, b: Beast) {
    const x = b.x * CELL
    const y = b.y * CELL
    const cx = x + CELL / 2
    const cy = y + CELL / 2

    if (b.type === 'imp') {
      ctx.fillStyle = '#e11d48'
      ctx.beginPath()
      ctx.roundRect(x + 2, y + 3, CELL - 4, CELL - 5, 5)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x + 4, y + 5)
      ctx.lineTo(x + 6, y)
      ctx.lineTo(x + 9, y + 5)
      ctx.moveTo(x + CELL - 4, y + 5)
      ctx.lineTo(x + CELL - 6, y)
      ctx.lineTo(x + CELL - 9, y + 5)
      ctx.fill()
    } else if (b.type === 'bat') {
      const flap = Math.sin(this.elapsed / 70) * 3
      ctx.fillStyle = '#a855f7'
      ctx.beginPath()
      ctx.moveTo(cx, cy - 3)
      ctx.lineTo(x - 2, cy - 6 + flap)
      ctx.lineTo(x + 3, cy + 4)
      ctx.lineTo(cx, cy + 6)
      ctx.lineTo(x + CELL - 3, cy + 4)
      ctx.lineTo(x + CELL + 2, cy - 6 + flap)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillStyle = b.hp > 1 ? '#c2410c' : '#9a3412'
      ctx.beginPath()
      ctx.roundRect(x, y + 1, CELL, CELL - 1, 6)
      ctx.fill()
      ctx.fillStyle = '#fde68a'
      ctx.beginPath()
      ctx.moveTo(x + 2, y + 4)
      ctx.lineTo(x - 1, y - 2)
      ctx.lineTo(x + 7, y + 2)
      ctx.moveTo(x + CELL - 2, y + 4)
      ctx.lineTo(x + CELL + 1, y - 2)
      ctx.lineTo(x + CELL - 7, y + 2)
      ctx.fill()
    }

    ctx.fillStyle = '#fff7ed'
    ctx.fillRect(cx - 5, cy - 3, 3, 3)
    ctx.fillRect(cx + 2, cy - 3, 3, 3)
    ctx.fillStyle = '#111'
    ctx.fillRect(cx - 4, cy - 2, 1.5, 2)
    ctx.fillRect(cx + 3, cy - 2, 1.5, 2)
  }

  private drawSnake(ctx: CanvasRenderingContext2D) {
    const { head, body, accent } = this.opts.skin
    const blink = this.invuln > 0 && Math.floor(this.elapsed / 80) % 2 === 0
    ctx.globalAlpha = blink ? 0.4 : 1

    for (let i = this.snake.length - 1; i >= 1; i--) {
      const s = this.snake[i]
      ctx.fillStyle = i % 2 === 0 ? body : accent
      ctx.globalAlpha = (blink ? 0.4 : 1) * (i % 2 === 0 ? 1 : 0.85)
      ctx.beginPath()
      ctx.roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 6)
      ctx.fill()
    }
    ctx.globalAlpha = blink ? 0.4 : 1

    const h = this.snake[0]
    ctx.fillStyle = head
    ctx.beginPath()
    ctx.roundRect(h.x * CELL, h.y * CELL, CELL, CELL, 7)
    ctx.fill()

    const v = VEC[this.dir]
    const cx = h.x * CELL + CELL / 2
    const cy = h.y * CELL + CELL / 2
    const px = -v.y
    const py = v.x
    for (const side of [-1, 1]) {
      const ex = cx + v.x * 4 + px * side * 4
      const ey = cy + v.y * 4 + py * side * 4
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex, ey, 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#0a110e'
      ctx.beginPath()
      ctx.arc(ex + v.x, ey + v.y, 1.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    if (this.shield > 0) {
      ctx.strokeStyle = '#67e8f9'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, CELL * 0.85, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}
