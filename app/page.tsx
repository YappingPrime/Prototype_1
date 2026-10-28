import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { loadProgress } from '@/lib/progress'
import { GameApp } from '@/components/game-app'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = session?.user ?? null
  const progress = user ? await loadProgress(user.id) : null

  return <GameApp key={user?.id ?? 'guest'} user={user ? { name: user.name } : null} initialProgress={progress} />
}
