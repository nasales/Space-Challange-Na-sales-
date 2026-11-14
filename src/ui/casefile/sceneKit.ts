// Small shared values of the witness scene (kept out of component files for fast refresh).
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
