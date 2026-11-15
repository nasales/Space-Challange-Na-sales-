// Minimal JSX typings for the MathML Core elements used by the "How it works" formulas
// (formulas.tsx). Browsers render MathML natively; @types/react does not list these tags.
import type { HTMLAttributes } from 'react'

type MathMLProps = HTMLAttributes<HTMLElement> & {
  display?: 'block' | 'inline'
  mathvariant?: 'normal'
  stretchy?: 'true' | 'false'
  movablelimits?: 'true' | 'false'
  lspace?: string
  rspace?: string
  width?: string
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      math: MathMLProps
      mrow: MathMLProps
      mi: MathMLProps
      mn: MathMLProps
      mo: MathMLProps
      mtext: MathMLProps
      mspace: MathMLProps
      msub: MathMLProps
      mfrac: MathMLProps
      msqrt: MathMLProps
      munder: MathMLProps
      mover: MathMLProps
    }
  }
}
