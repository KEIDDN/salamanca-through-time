import { beats, chapters, type Beat } from '../content/story'
import { travelTo } from '../timeline/scroller'

/** Each line sits in a mask and rises into place — type that behaves like film titles. */
function Lines({ lines, className }: { lines?: string[]; className: string }) {
  if (!lines?.length) return null
  return (
    <div className={className}>
      {lines.map((l) => (
        <span className="line" key={l}>
          <span>{l}</span>
        </span>
      ))}
    </div>
  )
}

function BeatView({ beat }: { beat: Beat }) {
  return (
    <div className={`beat beat--${beat.placement}${beat.display ? ' beat--display' : ''}`} data-beat={beat.id}>
      <Lines lines={beat.eyebrow ? [beat.eyebrow] : undefined} className="beat__eyebrow" />
      <Lines lines={beat.title} className="beat__title" />
      <Lines lines={beat.body} className="beat__body" />
    </div>
  )
}

export function Overlay({ ready }: { ready: boolean }) {
  return (
    <div className="overlay">
      <div className="film" aria-hidden />
      <div className="veil" data-veil />
      <div className="flash" data-flash />

      <header className="hud hud--top">
        <span className="brand">Salamanca</span>
        <span className="chapter">I — The Descent</span>
      </header>

      <div className="intro" data-intro>
        <span className="line intro__eyebrow"><span>Salamanca</span></span>
        <h1 className="intro__title">
          <span className="line"><span>A City</span></span>
          <span className="line"><span>Through Time</span></span>
        </h1>
      </div>

      <div className={`hint${ready ? ' hint--ready' : ''}`} data-hint>
        <span className="hint__label">{ready ? 'Scroll to explore' : 'Laying the first stone'}</span>
        <span className="hint__rule" />
      </div>

      {beats.map((b) => (
        <BeatView key={b.id} beat={b} />
      ))}

      <footer className="hud hud--bottom">
        <span className="year" aria-live="off">
          <span data-year>2026</span>
        </span>
        <span className="credit">Map data © OpenStreetMap contributors</span>
      </footer>

      <nav className="progress" aria-label="Chapters">
        <span className="progress__fill" />
        {chapters.map((c) => (
          <button key={c.label} className="progress__stop" style={{ top: `${c.at}%` }} onClick={() => travelTo(c.at)}>
            <span className="progress__label">{c.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
