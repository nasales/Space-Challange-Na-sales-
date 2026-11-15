// Interrogation room (Aneto format, `interrogation` in the script; see src/shared/tutorial.ts):
// two suspects stand in a line-up behind a one-way mirror, each with an alibi in a speech
// bubble. Evidence folders lie on the metal table under a hanging lamp. Opening one shows its
// hands-on task (interrogation/tasks.tsx); once solved, the player confronts the folder's suspect:
// break the alibi, back it, or leave reasonable doubt. Each right call stamps the suspect and
// notes a clue. When every folder is filed: the decision (charge one suspect, release the other),
// then the summary, which closes the case (case-closed screen).
// Escape: closes the open folder, else the decision or summary, else asks to leave the case.
import { useEffect, useRef, useState } from 'react'
import type { AlibiVerdict, InterrogationEvidence, Suspect } from '../../shared/tutorial'
import type { Witness } from '../../shared/witness'
import { Burst } from './board/tasks'
import { WitnessFigure } from './Figure'
import { fixText } from './format'
import EvidenceFolder from './interrogation/EvidenceFolder'
import { VERDICT_STAMP } from './interrogation/labels'
import SuspectArt from './interrogation/SuspectArt'
import { useKeyShield } from './keys'
import type { LoadedTutorial } from './loader'
import Notebook, { type NotebookClue } from './Notebook'
import './CaseFile.css'
import './board/EvidenceBoard.css'
import './interrogation/Interrogation.css'

interface Props {
  tutorial: LoadedTutorial
  witness?: Witness
  onClose: () => void
  /** Every folder filed, the right decision made, and the player closes the case */
  onFinished: (clues: NotebookClue[]) => void
}

type Decision = 'charge' | 'release'
type View = 'room' | 'decision' | 'summary'

export default function Interrogation({ tutorial, witness, onClose, onFinished }: Props) {
  const { script, data } = tutorial
  const inter = script.interrogation
  const evidence = (inter?.evidence ?? []).slice(0, 6)
  const suspects = (inter?.suspects ?? []).slice(0, 2)
  const claim = script.scene?.claim
  const [open, setOpen] = useState<string | null>(null)
  const [solved, setSolved] = useState<ReadonlySet<string>>(() => new Set())
  /** evidence ids in the order they were filed */
  const [filed, setFiled] = useState<string[]>([])
  const [fresh, setFresh] = useState<string | null>(null)
  const [view, setView] = useState<View>('room')
  const [decided, setDecided] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const allFiled = evidence.length > 0 && filed.length === evidence.length

  const clues: NotebookClue[] = filed.flatMap((id, i) => {
    const ev = evidence.find((x) => x.id === id)
    return ev ? [{ id, n: i + 1, text: fixText(ev.clue) }] : []
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

  // ---- focus back on the folder that was open
  const folderRefs = useRef(new Map<string, HTMLButtonElement>())
  const lastOpen = useRef<string | null>(null)
  const closeFolder = () => {
    setOpen(null)
    const id = lastOpen.current
    window.setTimeout(() => id && folderRefs.current.get(id)?.focus({ preventScroll: true }), 0)
  }

  // ---- keyboard: Escape steps back one level; other keys never reach the game
  useKeyShield(() => {
    if (confirming) setConfirming(false)
    else if (open) closeFolder()
    else if (view !== 'room') setView('room')
    else setConfirming(true)
  })

  // the decision opens a moment after the last folder is filed (cleared if the room closes first)
  const decisionTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(decisionTimer.current), [])

  const file = (id: string) => {
    setFiled((f) => (f.includes(id) ? f : [...f, id]))
    setFresh(id)
    closeFolder()
    if (filed.length + 1 === evidence.length) decisionTimer.current = window.setTimeout(() => setView('decision'), 1400)
  }

  /** verdicts filed against each suspect so far */
  const verdictsOf = (s: Suspect): AlibiVerdict[] =>
    filed.flatMap((id) => {
      const ev = evidence.find((x) => x.id === id)
      return ev && ev.suspect === s.id ? [ev.verdict] : []
    })

  const openEv = evidence.find((x) => x.id === open) ?? null
  const openSuspect = openEv ? suspects.find((s) => s.id === openEv.suspect) : undefined

  if (!inter || suspects.length < 2) return null

  return (
    <dialog ref={dialogRef} className="interro" aria-label={`Interrogation room: ${inter.title}`} onCancel={(e) => e.preventDefault()}>
      <div className="interro__layout">
        <div className="interro__main">
          <header className="interro__head">
            <div className="interro__titles">
              <p className="interro__label">Interrogation room · {script.title}</p>
              <h1 className="interro__title">{inter.title}</h1>
            </div>
            {decided ? (
              <div className="interro__instructions interro__instructions--done">
                <span>The case is solved.</span>
                <button type="button" className="evbtn evbtn--primary" onClick={() => setView('summary')}>
                  Read the summary
                </button>
              </div>
            ) : allFiled ? (
              <div className="interro__instructions interro__instructions--done">
                <span>Every folder is filed. Time to decide.</span>
                <button type="button" className="evbtn evbtn--primary" onClick={() => setView('decision')}>
                  Make the call
                </button>
              </div>
            ) : (
              <p className="interro__instructions">{fixText(inter.instructions)}</p>
            )}
            <div className="interro__tools">
              <p className={`interro__progress${allFiled ? ' is-done' : ''}`} aria-live="polite">
                <span className="interro__progress-bar" aria-hidden="true">
                  {evidence.map((ev) => (
                    <i key={ev.id} className={filed.includes(ev.id) ? 'is-on' : solved.has(ev.id) ? 'is-half' : undefined} />
                  ))}
                </span>
                {filed.length} / {evidence.length} filed
              </p>
              <button type="button" className="evbtn evbtn--leave" onClick={() => setConfirming(true)}>
                Leave case <kbd>Esc</kbd>
              </button>
            </div>
          </header>

          <div className="ixroom">
            <div className="ixmirror">
              <HeightChart />
              <div className="ixmirror__lineup">
                {suspects.map((s, i) => (
                  <SuspectStand
                    key={s.id}
                    suspect={s}
                    n={i + 1}
                    side={i === 0 ? 'left' : 'right'}
                    verdicts={verdictsOf(s)}
                    fresh={!!fresh && evidence.find((x) => x.id === fresh)?.suspect === s.id}
                    decided={decided}
                  />
                ))}
              </div>
              <span className="ixmirror__glare" aria-hidden="true" />
              <span className="ixmirror__sign" aria-hidden="true">
                Observation · One-way glass
              </span>
            </div>

            <Lamp />

            <div className="ixtable">
              <div className="ixtable__top">
                {witness && (
                  <figure className="ixstatement" aria-label={`Statement of ${witness.name}`}>
                    <span className="ixstatement__clip" aria-hidden="true" />
                    <div className="ixstatement__pic">
                      <WitnessFigure look={witness.look} crop="head" />
                    </div>
                    <figcaption>
                      <b>Statement · {witness.name}</b>
                      {claim && <span>&ldquo;{fixText(claim)}&rdquo;</span>}
                    </figcaption>
                  </figure>
                )}
                <ol className="ixfolders" aria-label="Evidence folders">
                  {evidence.map((ev, i) => (
                    <Folder
                      key={ev.id}
                      evidence={ev}
                      n={i + 1}
                      suspect={suspects.find((s) => s.id === ev.suspect)}
                      solved={solved.has(ev.id)}
                      filed={filed.includes(ev.id)}
                      fresh={fresh === ev.id}
                      refBtn={(el) => (el ? folderRefs.current.set(ev.id, el) : folderRefs.current.delete(ev.id))}
                      onOpen={() => {
                        lastOpen.current = ev.id
                        setFresh(null)
                        setOpen(ev.id)
                      }}
                    />
                  ))}
                </ol>
              </div>
              <span className="ixtable__edge" aria-hidden="true" />
            </div>
          </div>
        </div>

        <Notebook
          claim={claim}
          witnessName={witness?.name}
          clues={clues}
          total={evidence.length}
          emptyText="Confront a suspect with each folder to note a clue here."
        />
      </div>

      {openEv && openSuspect && (
        <div className="interro__dim" onClick={(e) => e.target === e.currentTarget && closeFolder()}>
          <EvidenceFolder
            key={openEv.id}
            evidence={openEv}
            n={evidence.indexOf(openEv) + 1}
            suspect={openSuspect}
            suspectN={suspects.indexOf(openSuspect) + 1}
            data={data}
            solved={solved.has(openEv.id)}
            confronted={filed.includes(openEv.id)}
            onSolved={() => setSolved((s) => new Set(s).add(openEv.id))}
            onConfront={() => file(openEv.id)}
            onClose={closeFolder}
          />
        </div>
      )}

      {(view === 'decision' || view === 'summary') && !openEv && (
        <div className="interro__dim interro__dim--light">
          <DecisionSheet
            prompt={inter.finale.prompt}
            summary={inter.summary}
            suspects={suspects}
            verdictsOf={verdictsOf}
            decided={decided}
            showSummary={view === 'summary'}
            onDecided={() => {
              setDecided(true)
              setView('summary')
            }}
            onBack={() => setView('room')}
            onFinish={() => onFinished(clues)}
          />
        </div>
      )}

      {confirming && (
        <div className="interro__dim interro__dim--light">
          <div className="evconfirm" role="alertdialog" aria-labelledby="ixconfirm-text">
            <p id="ixconfirm-text">Leave this case? Your answers in this case will be lost.</p>
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

/** Line-up height marks painted on the wall behind the glass */
function HeightChart() {
  return (
    <div className="ixheight" aria-hidden="true">
      {[200, 190, 180, 170, 160, 150, 140].map((cm) => (
        <span key={cm} className="ixheight__mark">
          <i>{cm}</i>
          <i>{cm}</i>
        </span>
      ))}
    </div>
  )
}

function Lamp() {
  return (
    <div className="ixlamp" aria-hidden="true">
      <span className="ixlamp__cord" />
      <span className="ixlamp__shade" />
      <span className="ixlamp__bulb" />
      <span className="ixlamp__cone" />
    </div>
  )
}

/** One suspect behind the glass: alibi bubble, figure, name plate and the stamps it collected */
function SuspectStand({
  suspect,
  n,
  side,
  verdicts,
  fresh,
  decided,
}: {
  suspect: Suspect
  n: number
  side: 'left' | 'right'
  verdicts: AlibiVerdict[]
  fresh: boolean
  decided: boolean
}) {
  const broken = verdicts.includes('breaks')
  const backed = !broken && verdicts.includes('backs')
  const state = broken ? ' is-broken' : backed ? ' is-backed' : ''
  const fate = decided ? (suspect.guilty ? ' is-charged' : ' is-released') : ''
  return (
    <div className={`ixsuspect ixsuspect--${side}${state}${fate}${fresh ? ' is-fresh' : ''}`}>
      <blockquote className="ixbubble">
        <p>&ldquo;{fixText(suspect.alibi)}&rdquo;</p>
        {broken && <span className="ixbubble__stamp ixbubble__stamp--breaks">Alibi broken</span>}
        {backed && <span className="ixbubble__stamp ixbubble__stamp--backs">Alibi holds</span>}
      </blockquote>
      <div className="ixsuspect__figure">
        <SuspectArt look={suspect.look} n={n} />
        {decided && <span className="ixsuspect__fate">{suspect.guilty ? 'Charged' : 'Released'}</span>}
      </div>
      <div className="ixsuspect__plate">
        <b>{suspect.name}</b>
        <small>{fixText(suspect.record)}</small>
        <ul className="ixsuspect__marks" aria-label={`Evidence put to ${suspect.name}`}>
          {verdicts.length === 0 ? <li className="ixmark ixmark--none">Not questioned yet</li> : <Marks verdicts={verdicts} />}
        </ul>
      </div>
    </div>
  )
}

/** One stamp per kind of verdict, with a count ("Reasonable doubt ×2") */
function Marks({ verdicts }: { verdicts: AlibiVerdict[] }) {
  const kinds = (['breaks', 'backs', 'doubt'] as AlibiVerdict[]).filter((k) => verdicts.includes(k))
  return (
    <>
      {kinds.map((k) => {
        const c = verdicts.filter((v) => v === k).length
        return (
          <li key={k} className={`ixmark ixmark--${k}`}>
            {VERDICT_STAMP[k]}
            {c > 1 ? ` ×${c}` : ''}
          </li>
        )
      })}
    </>
  )
}

/** A folder on the table: closed (teaser), solved (confront it) or filed (verdict stamp) */
function Folder({
  evidence,
  n,
  suspect,
  solved,
  filed,
  fresh,
  refBtn,
  onOpen,
}: {
  evidence: InterrogationEvidence
  n: number
  suspect?: Suspect
  solved: boolean
  filed: boolean
  fresh: boolean
  refBtn: (el: HTMLButtonElement | null) => void
  onOpen: () => void
}) {
  const state = filed ? `filed, ${VERDICT_STAMP[evidence.verdict].toLowerCase()}` : solved ? 'solved, confront the suspect' : 'closed'
  return (
    <li className={`ixfolder-card${filed ? ' is-filed' : solved ? ' is-solved' : ''}${fresh ? ' is-fresh' : ''}`} style={{ ['--i' as string]: n }}>
      <button type="button" ref={refBtn} className="ixfolder-card__btn" onClick={onOpen} aria-label={`Folder ${n}: ${evidence.title}, for ${suspect?.name ?? 'a suspect'}. ${state}.`}>
        <span className="ixfolder-card__tab" aria-hidden="true">
          Evidence #{n}
        </span>
        <span className="ixfolder-card__body" aria-hidden="true">
          {suspect && <span className="ixfolder-card__for">For {suspect.name}</span>}
          <span className="ixfolder-card__title">{evidence.title}</span>
          <span className="ixfolder-card__teaser">{fixText(evidence.teaser)}</span>
          {filed ? (
            <span className={`ixfolder-card__stamp ixfolder-card__stamp--${evidence.verdict}`}>{VERDICT_STAMP[evidence.verdict]}</span>
          ) : solved ? (
            <span className="ixfolder-card__open is-solved">Solved · confront</span>
          ) : (
            <span className="ixfolder-card__open">Open</span>
          )}
        </span>
      </button>
    </li>
  )
}

/** The finale: charge one suspect, release the other; then the summary closes the case */
function DecisionSheet({
  prompt,
  summary,
  suspects,
  verdictsOf,
  decided,
  showSummary,
  onDecided,
  onBack,
  onFinish,
}: {
  prompt: string
  summary: string
  suspects: Suspect[]
  verdictsOf: (s: Suspect) => AlibiVerdict[]
  decided: boolean
  showSummary: boolean
  onDecided: () => void
  onBack: () => void
  onFinish: () => void
}) {
  const [pick, setPick] = useState<Record<string, Decision | undefined>>(() =>
    decided ? Object.fromEntries(suspects.map((s) => [s.id, s.guilty ? 'charge' : 'release'])) : {},
  )
  const [wrong, setWrong] = useState<string[] | null>(null)
  const [tries, setTries] = useState(0)
  const ready = suspects.every((s) => pick[s.id])
  const done = decided && showSummary
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [done])

  const submit = () => {
    const bad = suspects.filter((s) => pick[s.id] !== (s.guilty ? 'charge' : 'release')).map((s) => s.id)
    setTries((t) => t + 1)
    if (bad.length === 0) onDecided()
    else setWrong(bad)
  }

  return (
    <section className={`ixdecision${done ? ' is-done' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ixdecision-title">
      <p className="ixdecision__label">{done ? 'Case solved' : 'Every folder is filed'}</p>
      <h2 id="ixdecision-title" className="ixdecision__title" tabIndex={-1} ref={titleRef}>
        {done ? 'The whole picture' : 'Make the call'}
      </h2>
      {!done && <p className="ixdecision__prompt">{fixText(prompt)}</p>}
      <div className="ixdecision__suspects">
        {suspects.map((s, i) => {
          const isWrong = !done && wrong?.includes(s.id)
          const v = verdictsOf(s)
          return (
            <article key={s.id} className={`ixdecide${isWrong ? ' is-wrong' : ''}${done ? (s.guilty ? ' is-charged' : ' is-released') : ''}`}>
              <div className="ixdecide__pic">
                <SuspectArt look={s.look} n={i + 1} crop="head" />
                {done && <span className="ixdecide__stamp">{s.guilty ? 'Charged' : 'Released'}</span>}
              </div>
              <div className="ixdecide__info">
                <h3>{s.name}</h3>
                <ul className="ixsuspect__marks">
                  <Marks verdicts={v} />
                </ul>
                {done ? (
                  <p className="ixdecide__text">{fixText(s.decision_text)}</p>
                ) : (
                  <div className="ixdecide__choices" role="group" aria-label={`Decision on ${s.name}`}>
                    {(['charge', 'release'] as Decision[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`ixdecide__choice ixdecide__choice--${d}${pick[s.id] === d ? ' is-on' : ''}`}
                        aria-pressed={pick[s.id] === d}
                        onClick={() => {
                          setPick((p) => ({ ...p, [s.id]: d }))
                          setWrong(null)
                        }}
                      >
                        {d === 'charge' ? 'Charge' : 'Release'}
                      </button>
                    ))}
                  </div>
                )}
                {isWrong && (
                  <p key={tries} className="evtask__feedback evtask__feedback--wrong">
                    <b>Think again.</b> {fixText(s.wrong_hint)}
                  </p>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {done ? (
        <>
          <p className="ixdecision__summary">
            <Burst />
            {fixText(summary)}
          </p>
          <div className="evsummary__nav">
            <button type="button" className="evbtn" onClick={onBack}>
              Look at the room
            </button>
            <button type="button" className="evbtn evbtn--primary evbtn--big" onClick={onFinish}>
              Close the case
            </button>
          </div>
        </>
      ) : (
        <div className="evsummary__nav">
          <button type="button" className="evbtn" onClick={onBack}>
            Back to the table
          </button>
          <button type="button" className="evbtn evbtn--primary evbtn--big" onClick={submit} disabled={!ready}>
            {ready ? 'Make the call' : 'Decide on both suspects'}
          </button>
        </div>
      )}
    </section>
  )
}
