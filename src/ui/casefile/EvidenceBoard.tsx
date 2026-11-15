// Evidence board (docs/evidence_board.md): a detective's cork board that replaces the quiz steps
// for cases whose script has `board`. Centre: the witness's polaroid and claim. Around it, the
// items pinned face down. Opening one zooms it (board dimmed) to its hands-on task; once solved,
// the player links it to the claim (supports / contradicts / says nothing). A right link pulls a
// red string from the item's pin to the claim, flips the card face up with a coloured tag and
// stamps its clue into the notebook. When every item is linked: the board summary, then the
// player's own conclusion (same screen as the case file), which hands over to the case-closed screen.
// Escape: closes the open card, else the summary or conclusion, else asks to leave the case.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEFAULT_OUTFIT } from '../../shared/outfit'
import type { EvidenceItem, EvidenceRelation } from '../../shared/tutorial'
import type { Witness } from '../../shared/witness'
import EvidenceCard from './board/EvidenceCard'
import { KIND_LABEL, RELATION_TAG } from './board/labels'
import { Conclusion, Header } from './CaseFile'
import { DetectiveFigure, WitnessFigure } from './Figure'
import { fixText } from './format'
import { useKeyShield } from './keys'
import type { LoadedTutorial } from './loader'
import Notebook, { type NotebookClue } from './Notebook'
import './CaseFile.css'
import './board/EvidenceBoard.css'

interface Props {
  tutorial: LoadedTutorial
  witness?: Witness
  onClose: () => void
  onConcluded: (conclusion: string, clues: NotebookClue[]) => void
}

/** Card centres on the board (percent of the cork area), clockwise from the top left */
const SLOTS: Record<number, [number, number][]> = {
  1: [[16, 26]],
  2: [[16, 26], [84, 26]],
  3: [[16, 26], [84, 26], [50, 84]],
  4: [[16, 26], [84, 26], [84, 76], [16, 76]],
  5: [[16, 24], [50, 17], [84, 24], [80, 78], [20, 78]],
  6: [[16, 24], [50, 17], [84, 24], [84, 76], [50, 86], [16, 76]],
}
const TILT = [-3, 2, -1.5, 2.5, -2, 1.5]

type Pt = { x: number; y: number }

export default function EvidenceBoard({ tutorial, witness, onClose, onConcluded }: Props) {
  const { script, data } = tutorial
  const board = script.board
  const items = (board?.items ?? []).slice(0, 6)
  const claim = script.scene?.claim
  const [open, setOpen] = useState<string | null>(null)
  const [solved, setSolved] = useState<ReadonlySet<string>>(() => new Set())
  /** item ids in the order they were linked */
  const [linked, setLinked] = useState<string[]>([])
  const [fresh, setFresh] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'summary' | 'conclusion'>('board')
  const [text, setText] = useState('')
  const [confirming, setConfirming] = useState(false)
  const allLinked = items.length > 0 && linked.length === items.length

  const clues: NotebookClue[] = linked.flatMap((id, i) => {
    const it = items.find((x) => x.id === id)
    return it ? [{ id, n: i + 1, text: fixText(it.clue) }] : []
  })

  // ---- native modal dialog: focus stays inside, the game behind is inert
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialogRef.current
    if (d && !d.open) d.showModal()
    return () => {
      if (d?.open) d.close()
    }
  }, [])

  // ---- focus back on the card that was open
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const lastOpen = useRef<string | null>(null)
  const closeCard = () => {
    setOpen(null)
    const id = lastOpen.current
    window.setTimeout(() => id && cardRefs.current.get(id)?.focus({ preventScroll: true }), 0)
  }

  // ---- keyboard: Escape steps back one level; other keys never reach the game
  useKeyShield(() => {
    if (confirming) setConfirming(false)
    else if (open) closeCard()
    else if (view !== 'board') setView('board')
    else setConfirming(true)
  })

  // Opens the summary a moment after the last string is pinned (cleared if the board closes first)
  const summaryTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(summaryTimer.current), [])

  const link = (id: string) => {
    setLinked((l) => (l.includes(id) ? l : [...l, id]))
    setFresh(id)
    closeCard()
    if (linked.length + 1 === items.length) summaryTimer.current = window.setTimeout(() => setView('summary'), 1500)
  }

  // ---- red strings: measured from the pins on screen
  const corkRef = useRef<HTMLDivElement>(null)
  const pinRefs = useRef(new Map<string, HTMLSpanElement>())
  const claimPinRef = useRef<HTMLSpanElement>(null)
  const [pins, setPins] = useState<{ claim: Pt | null; items: Record<string, Pt> }>({ claim: null, items: {} })
  const measure = useCallback(() => {
    const cork = corkRef.current
    if (!cork) return
    const r = cork.getBoundingClientRect()
    const at = (el: Element | null | undefined): Pt | null => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      // relative to the cork's padding box (the strings' SVG), inside its wooden frame
      return { x: b.left + b.width / 2 - r.left - cork.clientLeft, y: b.top + b.height / 2 - r.top - cork.clientTop }
    }
    const its: Record<string, Pt> = {}
    pinRefs.current.forEach((el, id) => {
      const p = at(el)
      if (p) its[id] = p
    })
    setPins({ claim: at(claimPinRef.current), items: its })
  }, [])
  useLayoutEffect(() => {
    measure()
    const cork = corkRef.current
    if (!cork) return
    const ro = new ResizeObserver(measure)
    ro.observe(cork)
    // the cards (and the dialog) settle after their entrance animations
    const dialog = dialogRef.current
    dialog?.addEventListener('animationend', measure)
    const t = window.setTimeout(measure, 1400)
    return () => {
      ro.disconnect()
      dialog?.removeEventListener('animationend', measure)
      window.clearTimeout(t)
    }
  }, [measure])
  // and once more whenever a string is added (cheap: a few rectangles)
  useEffect(() => {
    if (linked.length) measure()
  }, [linked.length, measure])

  const slots = SLOTS[Math.max(1, items.length)] ?? SLOTS[6]
  const openItem = items.find((i) => i.id === open) ?? null
  const progress = `${linked.length} / ${items.length} linked`

  if (!board) return null

  return (
    <dialog ref={dialogRef} className="evboard" aria-label={`Evidence board: ${board.title}`} onCancel={(e) => e.preventDefault()}>
      <div className="evboard__layout">
        <div className="evboard__main">
          <header className="evboard__head">
            <div className="evboard__titles">
              <p className="evboard__label">Evidence board · {script.title}</p>
              <h1 className="evboard__title">{board.title}</h1>
            </div>
            {allLinked && view === 'board' ? (
              <div className="evboard__instructions evboard__instructions--done">
                <span>Every card is linked. Time to decide.</span>
                <button type="button" className="evbtn evbtn--primary" onClick={() => setView('summary')}>
                  Write your conclusion
                </button>
              </div>
            ) : (
              <p className="evboard__instructions">{fixText(board.instructions)}</p>
            )}
            <div className="evboard__tools">
              <p className={`evboard__progress${allLinked ? ' is-done' : ''}`} aria-live="polite">
                <span className="evboard__progress-bar" aria-hidden="true">
                  {items.map((it) => (
                    <i key={it.id} className={linked.includes(it.id) ? 'is-on' : solved.has(it.id) ? 'is-half' : undefined} />
                  ))}
                </span>
                {progress}
              </p>
              <button type="button" className="evbtn evbtn--leave" onClick={() => setConfirming(true)}>
                Leave case <kbd>Esc</kbd>
              </button>
            </div>
          </header>

          <div className="evboard__cork" ref={corkRef}>
            {/* the frame's screws and a few scraps of old notes, for the film look */}
            <span className="evboard__scrap evboard__scrap--a" aria-hidden="true" />
            <span className="evboard__scrap evboard__scrap--b" aria-hidden="true" />

            <div className="evboard__centre">
              <figure className="evpolaroid-big">
                <span className="evtape" aria-hidden="true" />
                <div className="evpolaroid-big__pic">
                  {witness ? (
                    <WitnessFigure look={witness.look} crop="head" />
                  ) : (
                    <DetectiveFigure outfit={DEFAULT_OUTFIT} crop="head" />
                  )}
                </div>
                <figcaption className="evpolaroid-big__caption">
                  {witness ? (
                    <>
                      {witness.name}
                      <small>{witness.role}</small>
                    </>
                  ) : (
                    'The witness'
                  )}
                </figcaption>
              </figure>
              <div className="evclaim">
                <span className="evpin evpin--claim" ref={claimPinRef} aria-hidden="true" />
                <p className="evclaim__label">The claim</p>
                <blockquote className="evclaim__text">&ldquo;{claim ?? script.intro.question}&rdquo;</blockquote>
                {linked.length > 0 && <ClaimTally items={items} linked={linked} />}
              </div>
              {linked.length === 0 && (
                <p className="evboard__start" aria-hidden="true">
                  Pick a card to start
                </p>
              )}
            </div>

            {items.map((it, i) => (
              <BoardCard
                key={it.id}
                item={it}
                n={i + 1}
                slot={slots[i] ?? [50, 50]}
                tilt={TILT[i % TILT.length]}
                solved={solved.has(it.id)}
                linked={linked.includes(it.id)}
                fresh={fresh === it.id}
                refCard={(el) => (el ? cardRefs.current.set(it.id, el) : cardRefs.current.delete(it.id))}
                refPin={(el) => (el ? pinRefs.current.set(it.id, el) : pinRefs.current.delete(it.id))}
                onOpen={() => {
                  lastOpen.current = it.id
                  setFresh(null)
                  setOpen(it.id)
                }}
              />
            ))}

            <Strings pins={pins} linked={linked} fresh={fresh} items={items} />

          </div>
        </div>

        <Notebook claim={claim} witnessName={witness?.name} clues={clues} total={items.length} emptyText="Link each card to the claim to note a clue here." />
      </div>

      {openItem && (
        <div className="evboard__dim" onClick={(e) => e.target === e.currentTarget && closeCard()}>
          <EvidenceCard
            key={openItem.id}
            item={openItem}
            n={items.indexOf(openItem) + 1}
            data={data}
            claim={claim}
            solved={solved.has(openItem.id)}
            linked={linked.includes(openItem.id)}
            onSolved={() => setSolved((s) => new Set(s).add(openItem.id))}
            onLink={() => link(openItem.id)}
            onClose={closeCard}
          />
        </div>
      )}

      {view === 'summary' && !openItem && (
        <div className="evboard__dim evboard__dim--light">
          <section className="evsummary" role="dialog" aria-modal="true" aria-labelledby="evsummary-title">
            <span className="evpin evpin--focus" aria-hidden="true" />
            <p className="evsummary__label">Every card is linked</p>
            <h2 id="evsummary-title" className="evsummary__title" tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })}>
              The whole picture
            </h2>
            <p className="evsummary__text">{fixText(board.summary)}</p>
            <ClaimTally items={items} linked={linked} wide />
            <div className="evsummary__nav">
              <button type="button" className="evbtn" onClick={() => setView('board')}>
                Look at the board
              </button>
              <button type="button" className="evbtn evbtn--primary evbtn--big" onClick={() => setView('conclusion')}>
                Write your conclusion
              </button>
            </div>
          </section>
        </div>
      )}

      {view === 'conclusion' && (
        <div className="evboard__dim">
          <ConclusionSheet
            tutorial={tutorial}
            text={text}
            onText={setText}
            onBack={() => setView('board')}
            onSubmit={() => onConcluded(text.trim(), clues)}
          />
        </div>
      )}

      {confirming && (
        <div className="evboard__dim evboard__dim--light">
          <div className="evconfirm" role="alertdialog" aria-labelledby="evconfirm-text">
            <p id="evconfirm-text">Leave this case? Your answers in this case will be lost.</p>
            <div className="evsummary__nav">
              <button type="button" className="evbtn" onClick={() => setConfirming(false)} autoFocus>
                Keep investigating
              </button>
              <button type="button" className="evbtn evbtn--danger" onClick={onClose}>
                Back to the map
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}

function BoardCard({
  item,
  n,
  slot,
  tilt,
  solved,
  linked,
  fresh,
  refCard,
  refPin,
  onOpen,
}: {
  item: EvidenceItem
  n: number
  slot: [number, number]
  tilt: number
  solved: boolean
  linked: boolean
  fresh: boolean
  refCard: (el: HTMLButtonElement | null) => void
  refPin: (el: HTMLSpanElement | null) => void
  onOpen: () => void
}) {
  const state = linked ? 'linked' : solved ? 'solved, not linked yet' : 'face down'
  return (
    <div
      className={`evcard evcard--${item.kind}${linked ? ' is-up' : ''}${fresh ? ' is-fresh' : ''}`}
      style={{ left: `${slot[0]}%`, top: `${slot[1]}%`, ['--tilt' as string]: `${tilt}deg`, ['--i' as string]: n }}
    >
      <span className="evpin" ref={refPin} aria-hidden="true" />
      <button
        type="button"
        ref={refCard}
        className="evcard__btn"
        onClick={onOpen}
        aria-label={`Evidence ${n}, ${KIND_LABEL[item.kind]}: ${linked ? item.title : item.teaser}. ${state}${linked ? `, ${RELATION_TAG[item.relation].toLowerCase()}` : ''}.`}
      >
        <span className="evcard__inner" aria-hidden="true">
          <span className="evcard__face evcard__face--down">
            <span className="evcard__num">#{n}</span>
            <KindIcon kind={item.kind} />
            <span className="evcard__teaser">{fixText(item.teaser)}</span>
            {solved && !linked ? <span className="evcard__stamp">Solved · link it</span> : <span className="evcard__open">Open</span>}
          </span>
          <span className="evcard__face evcard__face--up">
            <span className="evcard__num">#{n}</span>
            <span className="evcard__title">{item.title}</span>
            <span className="evcard__clue">{fixText(item.clue)}</span>
            <span className={`evtag evtag--${item.relation}`}>{RELATION_TAG[item.relation]}</span>
          </span>
        </span>
      </button>
    </div>
  )
}

function KindIcon({ kind }: { kind: EvidenceItem['kind'] }) {
  if (kind === 'clipping')
    return (
      <svg className="evcard__icon" viewBox="0 0 48 36">
        <rect x="3" y="3" width="42" height="30" />
        <path d="M8 10h32M8 16h14M8 21h14M8 26h14M26 16h14v10H26z" />
      </svg>
    )
  if (kind === 'datacard')
    return (
      <svg className="evcard__icon" viewBox="0 0 48 36">
        <rect x="3" y="3" width="42" height="30" />
        <path d="M3 11h42M10 18h8M10 25h8M26 18h12M26 25h12" />
      </svg>
    )
  return (
    <svg className="evcard__icon" viewBox="0 0 48 36">
      <rect x="3" y="3" width="42" height="30" />
      <path d="M8 27l8-9 7 5 8-12 9 7" />
    </svg>
  )
}

/** Count of links per kind ("2 contradict · 1 says nothing"), on the claim card and the summary */
function ClaimTally({ items, linked, wide }: { items: EvidenceItem[]; linked: string[]; wide?: boolean }) {
  const count = (rel: EvidenceRelation) => linked.filter((id) => items.find((i) => i.id === id)?.relation === rel).length
  const parts: [EvidenceRelation, number][] = (['supports', 'contradicts', 'neutral'] as EvidenceRelation[]).map((r) => [r, count(r)])
  return (
    <ul className={`evclaim__tally${wide ? ' evclaim__tally--wide' : ''}`} aria-label="Links so far">
      {parts.map(([rel, c]) => (
        <li key={rel} className={`evtag evtag--${rel}${c === 0 ? ' is-zero' : ''}`}>
          {c} · {RELATION_TAG[rel]}
        </li>
      ))}
    </ul>
  )
}

/** Red strings from each linked card's pin to the claim's pin, with a slight sag */
function Strings({
  pins,
  linked,
  fresh,
  items,
}: {
  pins: { claim: Pt | null; items: Record<string, Pt> }
  linked: string[]
  fresh: string | null
  items: EvidenceItem[]
}) {
  const to = pins.claim
  if (!to) return null
  return (
    <svg className="evstrings" aria-hidden="true">
      {linked.map((id) => {
        const from = pins.items[id]
        if (!from || !items.some((i) => i.id === id)) return null
        const dx = to.x - from.x
        const dy = to.y - from.y
        const len = Math.hypot(dx, dy)
        const sag = Math.min(45, 10 + len * 0.07)
        const c = { x: from.x + dx / 2, y: from.y + dy / 2 + sag }
        const d = `M${from.x.toFixed(1)},${from.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${to.x.toFixed(1)},${to.y.toFixed(1)}`
        return (
          <g key={id} className={`evstring${fresh === id ? ' is-fresh' : ''}`}>
            <path d={d} className="evstring__shadow" pathLength={1} />
            <path d={d} className="evstring__line" pathLength={1} />
            <circle cx={from.x} cy={from.y} r={6} className="evstring__knot" />
          </g>
        )
      })}
    </svg>
  )
}

function ConclusionSheet({
  tutorial,
  text,
  onText,
  onBack,
  onSubmit,
}: {
  tutorial: LoadedTutorial
  text: string
  onText: (t: string) => void
  onBack: () => void
  onSubmit: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="casefile evboard__conclusion" role="dialog" aria-modal="true" aria-label="Your conclusion">
      <div className="casefile__sheet">
        <Header label={`Case file · ${tutorial.script.title}`} progress="Your conclusion" onClose={onBack} />
        <div className="casefile__body">
          <Conclusion
            script={tutorial.script}
            text={text}
            onText={onText}
            headingRef={headingRef}
            onBack={onBack}
            onSubmit={onSubmit}
            submitLabel="Submit and close the case"
          />
        </div>
      </div>
    </div>
  )
}
