// "How it works": a full-screen comic walkthrough opened from the main menu. Two chapters
// (the tool, then the methods and evidence report behind it), one page at a time. It is a native modal
// <dialog> (top layer, focus kept inside, Escape closes); Left/Right arrows turn the pages.
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react'
import { playSfx } from '../../../shared/sound'
import {
  PageCases,
  PageChecking,
  PageData,
  PageFeatured,
  PageLimits,
  PageLoop,
  PageMap,
  PageQuestion,
  PageReferences,
  PageReport,
  PageTable,
  PageTestInterval,
  PageTestSignificance,
  PageTestSlope,
  PageWhat,
  PageWho,
} from './pages'
import './HowItWorks.css'
import { L } from '../../../shared/i18n'

const CHAPTERS = [L('The tool', 'La herramienta'), L('Statistical rigour', 'Rigor estadístico')] as const

interface Page {
  chapter: 0 | 1
  title: string
  Body: ComponentType
}

const PAGES: Page[] = [
  { chapter: 0, title: L("A detective game about Spain's climate", 'Un juego de detectives sobre el clima de España'), Body: PageWhat },
  { chapter: 0, title: L('Made for curious minds, not statisticians', 'Hecho para mentes curiosas, no para estadísticos'), Body: PageWho },
  { chapter: 0, title: L('How an investigation works', 'Cómo funciona una investigación'), Body: PageLoop },
  { chapter: 0, title: L('Featured cases, or any spot on the map', 'Casos destacados, o cualquier punto del mapa'), Body: PageCases },
  { chapter: 1, title: L('Methods and evidence report', 'Informe de métodos y pruebas'), Body: PageReport },
  { chapter: 1, title: L('The question', 'La pregunta'), Body: PageQuestion },
  { chapter: 1, title: L('The data: three NASA products', 'Los datos: tres productos de la NASA'), Body: PageData },
  { chapter: 1, title: L('How a trend is tested: the slope', 'Cómo se prueba una tendencia: la pendiente'), Body: PageTestSlope },
  { chapter: 1, title: L('How a trend is tested: real or noise?', 'Cómo se prueba una tendencia: ¿real o ruido?'), Body: PageTestSignificance },
  { chapter: 1, title: L('How a trend is tested: the 95 % interval', 'Cómo se prueba una tendencia: el intervalo del 95 %'), Body: PageTestInterval },
  { chapter: 1, title: L('Checking the detective', 'Poniendo a prueba al detective'), Body: PageChecking },
  { chapter: 1, title: L('What the data show: the featured places', 'Lo que muestran los datos: los lugares destacados'), Body: PageFeatured },
  { chapter: 1, title: L('The featured series, in numbers', 'Las series destacadas, en cifras'), Body: PageTable },
  { chapter: 1, title: L('What the data show: the whole map', 'Lo que muestran los datos: todo el mapa'), Body: PageMap },
  { chapter: 1, title: L('What the evidence does not say', 'Lo que las pruebas no dicen'), Body: PageLimits },
  { chapter: 1, title: L('References', 'Referencias'), Body: PageReferences },
]

const firstOf = (chapter: number) => PAGES.findIndex((p) => p.chapter === chapter)

export default function HowItWorks({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(0)

  const page = PAGES[index]
  const isFirst = index === 0
  const isLast = index === PAGES.length - 1
  const inChapter = PAGES.filter((p) => p.chapter === page.chapter)
  const posInChapter = index - firstOf(page.chapter) + 1

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    nextRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  // A new page starts at its top
  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 })
  }, [index])

  const go = (to: number) => setIndex(Math.max(0, Math.min(PAGES.length - 1, to)))

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.key === 'ArrowRight' && !isLast) {
      event.preventDefault()
      playSfx('click')
      go(index + 1)
    } else if (event.key === 'ArrowLeft' && !isFirst) {
      event.preventDefault()
      playSfx('click')
      go(index - 1)
    }
  }

  const Body = page.Body

  return (
    <dialog
      ref={dialogRef}
      className="how"
      aria-modal="true"
      aria-labelledby="how-title"
      aria-describedby="how-page-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={onKeyDown}
    >
      <div className="how__frame">
        <header className="how__head">
          <h1 id="how-title" className="how__label">
            {L('How it works', 'Cómo funciona')}
          </h1>
          <nav className="how__chapters" aria-label={L('Chapters', 'Capítulos')}>
            {CHAPTERS.map((name, c) => (
              <button
                key={name}
                type="button"
                className="how__chapter"
                aria-current={page.chapter === c ? 'true' : undefined}
                data-sfx="click"
                onClick={() => go(firstOf(c))}
              >
                <span className="how__chapter-n">
                  {L('Chapter', 'Capítulo')} {c + 1}
                </span>
                {name}
              </button>
            ))}
          </nav>
          <button type="button" className="how__close" data-sfx="close" onClick={onClose}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
            {L('Close', 'Cerrar')}
          </button>
        </header>

        <div ref={stageRef} className="how__stage">
          <article key={index} className={`how__page how__page--ch${page.chapter + 1}`}>
            <p className="how__kicker">
              {L('Chapter', 'Capítulo')} {page.chapter + 1} · {CHAPTERS[page.chapter]}
              <span className="how__kicker-count">
                {posInChapter} / {inChapter.length}
              </span>
            </p>
            <h2 id="how-page-title" className="how__title">
              {page.title}
            </h2>
            <Body />
          </article>
        </div>

        <footer className="how__foot">
          <button
            type="button"
            className="how__nav how__nav--back"
            aria-disabled={isFirst}
            data-sfx={isFirst ? 'off' : 'click'}
            onClick={() => !isFirst && go(index - 1)}
          >
            <span aria-hidden="true">◀</span> {L('Back', 'Atrás')}
          </button>
          <ol className="how__dots" aria-label={L('Pages', 'Páginas')}>
            {PAGES.map((p, i) => (
              <li key={p.title} className={i > 0 && p.chapter !== PAGES[i - 1].chapter ? 'how__dot-item how__dot-item--split' : 'how__dot-item'}>
                <button
                  type="button"
                  className={`how__dot how__dot--ch${p.chapter + 1}`}
                  aria-label={L(`Page ${i + 1}: ${p.title}`, `Página ${i + 1}: ${p.title}`)}
                  aria-current={i === index ? 'step' : undefined}
                  data-sfx="click"
                  onClick={() => go(i)}
                />
              </li>
            ))}
          </ol>
          <button
            ref={nextRef}
            type="button"
            className="how__nav how__nav--next"
            data-sfx={isLast ? 'confirm' : 'click'}
            onClick={() => (isLast ? onClose() : go(index + 1))}
          >
            {isLast ? L('Close file', 'Cerrar expediente') : L('Next', 'Siguiente')} <span aria-hidden="true">▶</span>
          </button>
          <p className="how__sr" aria-live="polite">
            {L(`Page ${index + 1} of ${PAGES.length}: ${page.title}`, `Página ${index + 1} de ${PAGES.length}: ${page.title}`)}
          </p>
        </footer>
      </div>
    </dialog>
  )
}
