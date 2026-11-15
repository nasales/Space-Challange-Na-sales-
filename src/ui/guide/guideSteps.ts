// Script of the map tutorial: what the guide robot says, where it hovers and what ends each step.
// To change the tutorial, edit this list only (GuideTour.tsx plays whatever is here).
import type { GuideCue } from '../../shared/events'

/** Name on the robot's dialogue box. */
export const GUIDE_NAME = 'Wattson'
export const GUIDE_ROLE = 'Field robot'

/**
 * What ends a step:
 * - enter: the player reads and presses Enter (or clicks Next)
 * - move: the detective has run a short distance
 * - wheel: the mouse wheel was used (Enter also works, for players without a wheel)
 * - travelOpen / travelClose: the travel map (M) was opened / is closed again and he has landed
 * - lensOpen / lensClose: the magnifier (Space) was opened / is closed again
 */
export type GuideGoal = 'enter' | 'move' | 'wheel' | 'travelOpen' | 'travelClose' | 'lensOpen' | 'lensClose'

export interface GuideStep {
  id: string
  /** Short heading of the step */
  title: string
  text: string
  /** Shown instead of `text` while the detective stands inside a featured-case ring (magnifier step) */
  textInCaseRing?: string
  /** Keys the step asks for, drawn as key caps */
  keys?: string[]
  /** What to do, in a few words (next to the key caps) */
  action?: string
  at: GuideCue['at']
  /** The detective stands still and turns towards what the robot shows */
  hold?: boolean
  goal: GuideGoal
  /** The box moves to the top of the screen (a panel is open in the middle) */
  dock?: 'top'
  /** HUD part that pulses during the step */
  highlight?: 'corner'
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Welcome, detective',
    text: `Beep! I am ${GUIDE_NAME}, your field robot. This is a map of Spain you can run across: real mountains, real rivers, real towns. Let me show you around. It takes one minute.`,
    at: 'detective',
    goal: 'enter',
  },
  {
    id: 'move',
    title: 'Run',
    text: 'First, your legs. Run with W, A, S and D. Hold Shift to sprint. Go on, take a few steps!',
    keys: ['W', 'A', 'S', 'D'],
    action: 'Run a few steps',
    at: 'detective',
    goal: 'move',
  },
  {
    id: 'zoom',
    title: 'Look from above',
    text: 'Good. Now roll the mouse wheel to zoom out. Far enough and you see the whole country. Roll it back to come down again.',
    keys: ['Wheel'],
    action: 'Roll the mouse wheel',
    at: 'detective',
    goal: 'wheel',
  },
  {
    id: 'location',
    title: 'Where am I?',
    text: 'Top right: the minimap shows where you are in Spain, and the panel under it names the nearest town and its region.',
    at: 'detective',
    goal: 'enter',
    highlight: 'corner',
  },
  {
    id: 'monuments',
    title: 'Monuments',
    text: 'See this? It is a monument. Spain is full of them on this map: cathedrals, castles, bridges. They are your landmarks. You can spot them from far away, and you can even climb them.',
    at: 'landmark',
    hold: true,
    goal: 'enter',
  },
  {
    id: 'travel-open',
    title: 'Travel map',
    text: 'Spain is big. Press M to open the travel map.',
    keys: ['M'],
    action: 'Open the travel map',
    at: 'detective',
    goal: 'travelOpen',
  },
  {
    id: 'travel-close',
    title: 'Travel map',
    text: 'Every dot is a monument. Click one to fly there by plane, or press Esc to stay here.',
    keys: ['Esc'],
    action: 'Close the map, or fly',
    at: 'detective',
    goal: 'travelClose',
    dock: 'top',
  },
  {
    id: 'lens-open',
    title: 'The magnifier',
    text: 'Now the real detective work. Stand still: your magnifier comes out after a moment. Then press Space to look through it.',
    textInCaseRing: 'You are inside a glowing case ring. Step out of it first, then stand still and press Space.',
    keys: ['Space'],
    action: 'Stand still, then press Space',
    at: 'detective',
    goal: 'lensOpen',
  },
  {
    id: 'lens-close',
    title: 'Six clues',
    text: 'Six clues: temperature, rain, wind and more. Each one opens decades of NASA data for the exact spot you stand on. Click a clue to read its trend. Press Esc when you are done.',
    keys: ['Esc'],
    action: 'Close the magnifier',
    at: 'detective',
    goal: 'lensClose',
    dock: 'top',
  },
  {
    id: 'cases',
    title: 'Featured cases',
    text: 'A glowing ring with a floating symbol is a featured case. A witness waits inside with a claim about the climate. Stop in the ring and press Space: hear the claim, read the evidence, and decide if the data backs it. Solved cases turn green.',
    at: 'case',
    hold: true,
    goal: 'enter',
  },
  {
    id: 'end',
    title: 'Case open',
    text: 'That is all you need. Press Esc any time to pause; you can call me again from there. Good luck, detective!',
    at: 'detective',
    goal: 'enter',
  },
]
