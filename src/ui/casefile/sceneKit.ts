// Small shared values of the witness scene (kept out of component files for fast refresh).
import type { LineMood } from '../../shared/tutorial'
import type { WitnessLook } from '../../shared/witness'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A neutral witness when a case has a scene but no entry in src/shared/witness.ts */
export const PLAIN_LOOK: WitnessLook = {
  skin: '#d9a77c',
  hair: '#3b2a20',
  hairStyle: 'short',
  shirt: '#8a9bb0',
  trousers: '#4a4038',
  hat: 'none',
}

/**
 * How the listener reacts to a line said with this mood, or null for no reaction.
 * Respectful on sad lines: the listener only shares the sadness.
 */
export function listenerReaction(mood: LineMood): LineMood | null {
  switch (mood) {
    case 'sad':
      return 'sad'
    case 'happy':
    case 'proud':
      return 'happy'
    case 'explaining':
      return 'explaining'
    case 'insistent':
    case 'confident':
    case 'doubtful':
      return 'curious'
    default:
      return null
  }
}
