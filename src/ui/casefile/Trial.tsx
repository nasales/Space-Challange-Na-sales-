// Courtroom trial (TutorialScript.trial, first used by the Donana case): a third format for the
// learning part of a featured case, next to the case file and the evidence board.
// The witness's claim is on trial and the player is the judge, seen from the judge's seat:
// prosecution table on the left, defence table on the right, the exhibit easel in the middle,
// the bench with the gavel and the docket in front. The two sides take turns presenting their
// exhibits (A, B, C...): the lawyer speaks, the judge examines the exhibit (a small hands-on
// task), then rules on it (admit / reject / insufficient). Each ruling puts a clue into the
// record (notebook). When every exhibit is heard, the judge passes sentence on the charge
// (guilty / not guilty / not proven), the gavel falls, and the case closes (onFinished).
// Escape: closes the open exhibit, else the sentence, else asks to leave the case.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { TrialSentence } from '../../shared/tutorial'
import type { Witness } from '../../shared/witness'
import { WitnessFigure } from './Figure'
import { fixText } from './format'
import { useKeyShield } from './keys'
import type { LoadedTutorial } from './loader'
import Notebook, { type NotebookClue } from './Notebook'
import { Gavel, Lawyer, Scales, SoundBlock } from './trial/art'
import ExhibitView from './trial/ExhibitView'
import { RULING_STAMP, SIDE_LABEL, SIDE_ROLE, VERDICT_LABEL, letterOf } from './trial/labels'
import './CaseFile.css'
import './board/EvidenceBoard.css'
import './trial/Trial.css'

interface Props {
  tutorial: LoadedTutorial
  witness?: Witness
  onClose: () => void
  /** Sentence passed: the case closes */
  onFinished: (clues: NotebookClue[]) => void
}

export default function Trial({ tutorial, witness, onClose, onFinished }: Props) {
  const { script, data } = tutorial
  const trial = script.trial
  const exhibits = (trial?.exhibits ?? []).slice(0, 6)
  const claim = script.scene?.claim
  /** exhibits entered into the record, in order: the next one to present is exhibits[heard] */
  const [heard, setHeard] = useState(0)
  const [solved, setSolved] = useState<ReadonlySet<string>>(() => new Set())
  const [open, setOpen] = useState<number | null>(null)
  const [view, setView] = useState<'court' | 'sentence'>('court')
  const [confirming, setConfirming] = useState(false)
  const allHeard = exhibits.length > 0 && heard >= exhibits.length
  const current = allHeard ? null : exhibits[heard]

  const clues: NotebookClue[] = exhibits.slice(0, heard).map((ex, i) => ({ id: ex.id, n: i + 1, text: fixText(ex.clue) }))

  // ---- native modal dialog: focus stays inside, the game behind is inert
  const dialogRef = useRef<HTMLDialogElement>(null)
  const easelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const d = dialogRef.current
    if (d && !d.open) d.showModal()
    // start on the exhibit easel, not on "Leave case"
    easelRef.current?.focus({ preventScroll: true })
    return () => {
      if (d?.open) d.close()
    }
  }, [])

  // ---- focus back on the easel after an exhibit closes
  const closeExhibit = () => {
    setOpen(null)
    window.setTimeout(() => easelRef.current?.focus({ preventScroll: true }), 0)
  }

  // ---- keyboard: Escape steps back one level; other keys never reach the game
  const sentenceBusy = useRef(false)
  useKeyShield(() => {
    if (confirming) setConfirming(false)
    else if (open != null) closeExhibit()
    else if (view === 'sentence') {
      if (!sentenceBusy.current) setView('court')
    } else setConfirming(true)
  })

  if (!trial) return null

  const enter = (i: number) => {
    if (i === heard) setHeard(heard + 1)
    closeExhibit()
  }

  const openEx = open != null ? exhibits[open] : null

  return (
    <dialog ref={dialogRef} className="trial" aria-label={`Courtroom: ${trial.title}`} onCancel={(e) => e.preventDefault()}>
      <div className="trial__layout">
        <div className="trial__main">
          <header className="trial__head">
            <div className="trial__titles">
              <p className="trial__label">In court · {script.title}</p>
              <h1 className="trial__title">{fixText(trial.title)}</h1>
            </div>
            <div className="trial__charge">
              {witness && (
                <span className="trial__charge-pic" aria-hidden="true">
                  <WitnessFigure look={witness.look} crop="head" />
                </span>
              )}
              <p>
                <span className="trial__charge-label">The charge{witness ? `, brought by ${witness.name}` : ''}</span>
                <span className="trial__charge-text">&ldquo;{fixText(trial.charge)}&rdquo;</span>
              </p>
            </div>
            <button type="button" className="evbtn evbtn--leave" onClick={() => setConfirming(true)}>
              Leave case <kbd>Esc</kbd>
            </button>
          </header>

          <div className="trial__room">
            <div className="trial__wall" aria-hidden="true">
              <span className="trial__lamp trial__lamp--l" />
              <span className="trial__lamp trial__lamp--r" />
              <span className="trial__crest">
                <Scales />
              </span>
            </div>

            <div className="trial__stage">
              <LawyerTable side="prosecution" active={current?.side === 'prosecution'} rested={allHeard}>
                {current?.side === 'prosecution' && (
                  <Bubble side="prosecution" letter={letterOf(heard)} text={current.argument} />
                )}
              </LawyerTable>

              <div className="trial__easel">
                <span className="trial__easel-legs" aria-hidden="true" />
                {current ? (
                  <button
                    type="button"
                    ref={easelRef}
                    className={`trplacard trplacard--${current.side}${current.kind === 'missing' ? ' trplacard--missing' : ''}`}
                    onClick={() => setOpen(heard)}
                  >
                    <span className="trplacard__letter">Exhibit {letterOf(heard)}</span>
                    <span className="trplacard__title">{fixText(current.title)}</span>
                    <span className="trplacard__teaser">{fixText(current.teaser)}</span>
                    <span className="trplacard__by">Presented by the {SIDE_LABEL[current.side].toLowerCase()}</span>
                    <span className="trplacard__open">{solved.has(current.id) ? 'Rule on it' : 'Examine it'}</span>
                  </button>
                ) : (
                  <button type="button" ref={easelRef} className="trplacard trplacard--sentence" onClick={() => setView('sentence')}>
                    <span className="trplacard__letter">All exhibits heard</span>
                    <span className="trplacard__title">Pass sentence</span>
                    <span className="trplacard__teaser">Both sides rest their case. The court awaits your verdict.</span>
                    <span className="trplacard__open">Go to the sentence</span>
                  </button>
                )}
              </div>

              <LawyerTable side="defence" active={current?.side === 'defence'} rested={allHeard}>
                {current?.side === 'defence' && <Bubble side="defence" letter={letterOf(heard)} text={current.argument} />}
              </LawyerTable>
            </div>

            {heard === 0 && !open && (
              <p className="trial__hint">
                {fixText(trial.instructions)}
              </p>
            )}
          </div>

          <div className="trial__bench">
            <div className="trial__gavel" aria-hidden="true">
              <SoundBlock />
              <Gavel />
            </div>
            <ol className="trdocket" aria-label="Docket: the exhibits">
              {exhibits.map((ex, i) => {
                const done = i < heard
                const now = i === heard
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      className={`trdocket__tag trdocket__tag--${ex.side}${done ? ' is-done' : now ? ' is-now' : ''}`}
                      disabled={!done && !now}
                      onClick={() => setOpen(i)}
                      aria-label={`Exhibit ${letterOf(i)}, ${SIDE_LABEL[ex.side]}: ${done ? `${ex.title}, ${RULING_STAMP[ex.ruling].toLowerCase()}` : now ? `${ex.title}, now presented` : 'not presented yet'}`}
                    >
                      <span className="trdocket__letter">{letterOf(i)}</span>
                      <span className="trdocket__name">{done || now ? fixText(ex.title) : 'Not yet'}</span>
                      {done && <span className={`trdocket__stamp trstamp--${ex.ruling}`}>{RULING_STAMP[ex.ruling]}</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="trial__plate" aria-hidden="true">
              Your Honour
            </p>
          </div>
        </div>

        <Notebook
          claim={claim}
          witnessName={witness?.name}
          clues={clues}
          total={exhibits.length}
          emptyText="Rule on each exhibit to enter a clue into the record."
        />
      </div>

      {openEx && open != null && (
        <div className="evboard__dim trial__dim" onClick={(e) => e.target === e.currentTarget && closeExhibit()}>
          <ExhibitView
            key={openEx.id}
            exhibit={openEx}
            letter={letterOf(open)}
            data={data}
            claim={trial.charge}
            solved={solved.has(openEx.id)}
            entered={open < heard}
            onSolved={() => setSolved((s) => new Set(s).add(openEx.id))}
            onEnter={() => enter(open)}
            onClose={closeExhibit}
          />
        </div>
      )}

      {view === 'sentence' && !openEx && (
        <div className="evboard__dim trial__dim">
          <Sentence
            sentence={trial.sentence}
            charge={trial.charge}
            busyRef={sentenceBusy}
            onBack={() => setView('court')}
            onFinished={() => onFinished(clues)}
          />
        </div>
      )}

      {confirming && (
        <div className="evboard__dim evboard__dim--light">
          <div className="evconfirm" role="alertdialog" aria-labelledby="trconfirm-text">
            <p id="trconfirm-text">Leave the courtroom? Your rulings in this case will be lost.</p>
            <div className="evsummary__nav">
              <button type="button" className="evbtn" onClick={() => setConfirming(false)} autoFocus>
                Stay in court
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

function LawyerTable({ side, active, rested, children }: { side: 'prosecution' | 'defence'; active: boolean; rested: boolean; children?: ReactNode }) {
  return (
    <div className={`trtable trtable--${side}${active ? ' is-active' : ''}`}>
      <div className="trtable__speech">{children ?? (rested ? <p className="trtable__rest">We rest our case.</p> : null)}</div>
      <div className="trtable__figure">
        <Lawyer side={side} talking={active} />
      </div>
      <div className="trtable__desk">
        <span className="trtable__papers" aria-hidden="true" />
        <p className="trtable__sign">
          {SIDE_LABEL[side]}
          <small>{SIDE_ROLE[side]}</small>
        </p>
      </div>
    </div>
  )
}

function Bubble({ side, letter, text }: { side: 'prosecution' | 'defence'; letter: string; text: string }) {
  return (
    <div className={`trbubble trbubble--${side}`} aria-live="polite">
      <p className="trbubble__who">
        {SIDE_LABEL[side]} · Exhibit {letter}
      </p>
      <p className="trbubble__text">{fixText(text)}</p>
    </div>
  )
}

type Verdict = TrialSentence['options'][number]['verdict']

/** The sentence: three verdict cards; a wrong one draws an objection, the right one the gavel */
function Sentence({
  sentence,
  charge,
  busyRef,
  onBack,
  onFinished,
}: {
  sentence: TrialSentence
  charge: string
  busyRef: RefObject<boolean>
  onBack: () => void
  onFinished: () => void
}) {
  const [pick, setPick] = useState<{ v: Verdict; n: number } | null>(null)
  const [stage, setStage] = useState<'choose' | 'gavel' | 'done'>('choose')
  const right = sentence.options.find((o) => o.correct)
  const picked = pick ? sentence.options.find((o) => o.verdict === pick.v) : undefined
  const headingRef = useRef<HTMLHeadingElement>(null)
  const doneRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (stage !== 'gavel') return
    busyRef.current = true
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => setStage('done'), reduced ? 50 : 1300)
    return () => window.clearTimeout(t)
  }, [stage, busyRef])
  useEffect(() => {
    if (stage === 'done') {
      busyRef.current = false
      doneRef.current?.focus({ preventScroll: true })
    }
  }, [stage, busyRef])

  const choose = (v: Verdict) => {
    if (stage !== 'choose') return
    const o = sentence.options.find((x) => x.verdict === v)
    setPick((p) => ({ v, n: (p?.n ?? 0) + 1 }))
    if (o?.correct) setStage('gavel')
  }

  return (
    <section className={`trsentence is-${stage}`} role="dialog" aria-modal="true" aria-labelledby="trsentence-title">
      <p className="trsentence__label">The sentence</p>
      <h2 id="trsentence-title" className="trsentence__title" ref={headingRef} tabIndex={-1}>
        How do you find?
      </h2>
      <p className="trsentence__charge">
        The charge: <b>&ldquo;{fixText(charge)}&rdquo;</b>
      </p>
      {stage === 'choose' && <p className="trsentence__prompt">{fixText(sentence.prompt)}</p>}

      <div className="trverdicts" role="group" aria-label="Verdicts">
        {sentence.options.map((o) => {
          const isPick = pick?.v === o.verdict
          const state = isPick ? (o.correct ? ' is-right' : ' is-wrong') : ''
          return (
            <button
              key={o.verdict}
              type="button"
              className={`trverdict trverdict--${o.verdict}${state}`}
              aria-pressed={isPick}
              disabled={stage !== 'choose' && !o.correct}
              onClick={() => choose(o.verdict)}
            >
              <span className="trverdict__label">{VERDICT_LABEL[o.verdict].label}</span>
              <span className="trverdict__sub">{VERDICT_LABEL[o.verdict].sub}</span>
              <span className="trverdict__text">{fixText(o.text)}</span>
            </button>
          )
        })}
      </div>

      <div aria-live="polite">
        {picked && !picked.correct && stage === 'choose' && (
          <div key={pick?.n} className="trobjection trobjection--bench">
            <span className="trobjection__burst" aria-hidden="true">
              Objection!
            </span>
            <p>{fixText(picked.objection ?? '')}</p>
          </div>
        )}
      </div>

      {stage !== 'choose' && (
        <div className="trsentence__gavel" aria-hidden="true">
          <SoundBlock />
          <Gavel className="is-striking" />
          <span className="trsentence__bang">Order!</span>
        </div>
      )}

      {stage === 'done' && right && (
        <div className="trsentence__done">
          <p className={`trsentence__stamp trsentence__stamp--${right.verdict}`}>{VERDICT_LABEL[right.verdict].label}</p>
          <p className="trsentence__summary">{fixText(sentence.summary)}</p>
        </div>
      )}

      <div className="evsummary__nav">
        {stage === 'choose' && (
          <button type="button" className="evbtn" onClick={onBack}>
            Back to the court
          </button>
        )}
        {stage === 'done' && (
          <button type="button" ref={doneRef} className="evbtn evbtn--primary evbtn--big" onClick={onFinished}>
            Close the case
          </button>
        )}
      </div>
    </section>
  )
}
