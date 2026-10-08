import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { loadCity, type CityData } from './scene/lib/cityData'
import { Overlay } from './ui/Overlay'
import { useScrollTimeline } from './timeline/useScrollTimeline'
import { SCROLL_STRETCH } from './timeline/rhythm'

const Experience = lazy(() => import('./scene/Experience').then((m) => ({ default: m.Experience })))

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

export default function App() {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<CityData | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    loadCity().then(setData).catch((e) => console.error(e))
  }, [])

  // give the GPU a moment to compile before inviting the first scroll
  useEffect(() => {
    if (!data) return
    const t = setTimeout(() => setReady(true), 900)
    return () => clearTimeout(t)
  }, [data])

  useScrollTimeline(root, track, ready)

  return (
    <div ref={root} className="app">
      <Suspense fallback={null}>{data && <Experience data={data} />}</Suspense>
      <Overlay ready={ready} />
      {/* the rests lengthen the page; the pace between them stays a little brisker than before */}
      <div ref={track} className="scroll-track" style={{ height: `${Math.round(1350 * SCROLL_STRETCH)}vh` }} />
    </div>
  )
}
