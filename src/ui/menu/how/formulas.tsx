// The formulas of chapter 2 ("Statistical rigour"), written in MathML so the browser draws
// them natively (no library) and screen readers can read them. Symbols are language-neutral;
// only words and decimal separators follow the language (src/shared/i18n.ts).
import type { ReactNode } from 'react'
import { L, fmtNumber } from '../../../shared/i18n'

/** A formula on a small chalkboard; wide formulas scroll inside it on phones */
function Board({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="how-eq">
      <math display="block">{children}</math>
      {note && <p className="how-eq__note">{note}</p>}
    </div>
  )
}

/** x′: the prime as a postfix operator sits right after the letter (as on paper) */
function Primed({ letter }: { letter: string }) {
  return (
    <mrow>
      <mi>{letter}</mi>
      <mo lspace="0" rspace="0">
        ′
      </mo>
    </mrow>
  )
}

/** a′ with a subscript */
function APrime({ sub }: { sub: ReactNode }) {
  return (
    <msub>
      <Primed letter="a" />
      {sub}
    </msub>
  )
}

const nPrime = <Primed letter="n" />
const NPrime = <Primed letter="N" />

/** a_t = x_t − x̄_m(t) */
export function FormulaAnomaly() {
  return (
    <Board>
      <msub>
        <mi>a</mi>
        <mi>t</mi>
      </msub>
      <mo>=</mo>
      <msub>
        <mi>x</mi>
        <mi>t</mi>
      </msub>
      <mo>−</mo>
      <msub>
        <mover>
          <mi>x</mi>
          <mo stretchy="false">‾</mo>
        </mover>
        <mrow>
          <mi>m</mi>
          <mo stretchy="false">(</mo>
          <mi>t</mi>
          <mo stretchy="false">)</mo>
        </mrow>
      </msub>
    </Board>
  )
}

/** β = median over i < j of (a_j − a_i) / (t_j − t_i) */
export function FormulaSen() {
  return (
    <Board>
      <mi>β</mi>
      <mo>=</mo>
      <munder>
        <mtext>{L('median', 'mediana')}</mtext>
        <mrow>
          <mi>i</mi>
          <mo>&lt;</mo>
          <mi>j</mi>
        </mrow>
      </munder>
      <mspace width="0.3em" />
      <mfrac>
        <mrow>
          <msub>
            <mi>a</mi>
            <mi>j</mi>
          </msub>
          <mo>−</mo>
          <msub>
            <mi>a</mi>
            <mi>i</mi>
          </msub>
        </mrow>
        <mrow>
          <msub>
            <mi>t</mi>
            <mi>j</mi>
          </msub>
          <mo>−</mo>
          <msub>
            <mi>t</mi>
            <mi>i</mi>
          </msub>
        </mrow>
      </mfrac>
    </Board>
  )
}

/** a′_k = a_(k+1) − r1 · a_k */
export function FormulaPrewhitening() {
  return (
    <Board>
      <APrime sub={<mi>k</mi>} />
      <mo>=</mo>
      <msub>
        <mi>a</mi>
        <mrow>
          <mi>k</mi>
          <mo>+</mo>
          <mn>1</mn>
        </mrow>
      </msub>
      <mo>−</mo>
      <msub>
        <mi>r</mi>
        <mn>1</mn>
      </msub>
      <mo>·</mo>
      <msub>
        <mi>a</mi>
        <mi>k</mi>
      </msub>
    </Board>
  )
}

const sgn = <mi>sgn</mi>

/** S, Var(S), Z and p of the Mann-Kendall test, one board each so they fit on phones */
export function FormulaMannKendall() {
  return (
    <>
      <Board>
        <mi>S</mi>
        <mo>=</mo>
        <munder>
          <mo>∑</mo>
          <mrow>
            <mi>i</mi>
            <mo>&lt;</mo>
            <mi>j</mi>
          </mrow>
        </munder>
        {sgn}
        <mo stretchy="false">(</mo>
        <APrime sub={<mi>j</mi>} />
        <mo>−</mo>
        <APrime sub={<mi>i</mi>} />
        <mo stretchy="false">)</mo>
      </Board>
      <Board note={L('corrected for ties', 'corregida por empates')}>
        <mi>Var</mi>
        <mo stretchy="false">(</mo>
        <mi>S</mi>
        <mo stretchy="false">)</mo>
        <mo>=</mo>
        <mfrac>
          <mrow>
            {nPrime}
            <mo stretchy="false">(</mo>
            {nPrime}
            <mo>−</mo>
            <mn>1</mn>
            <mo stretchy="false">)</mo>
            <mo stretchy="false">(</mo>
            <mn>2</mn>
            {nPrime}
            <mo>+</mo>
            <mn>5</mn>
            <mo stretchy="false">)</mo>
          </mrow>
          <mn>18</mn>
        </mfrac>
      </Board>
      <div className="how-eqs">
        <Board>
          <mi>Z</mi>
          <mo>=</mo>
          <mfrac>
            <mrow>
              <mi>S</mi>
              <mo>−</mo>
              {sgn}
              <mo stretchy="false">(</mo>
              <mi>S</mi>
              <mo stretchy="false">)</mo>
            </mrow>
            <msqrt>
              <mi>Var</mi>
              <mo stretchy="false">(</mo>
              <mi>S</mi>
              <mo stretchy="false">)</mo>
            </msqrt>
          </mfrac>
        </Board>
        <Board>
          <mi>p</mi>
          <mo>=</mo>
          <mn>2</mn>
          <mo>[</mo>
          <mn>1</mn>
          <mo>−</mo>
          <mi mathvariant="normal">Φ</mi>
          <mo stretchy="false">(</mo>
          <mo stretchy="false">|</mo>
          <mi>Z</mi>
          <mo stretchy="false">|</mo>
          <mo stretchy="false">)</mo>
          <mo>]</mo>
        </Board>
      </div>
    </>
  )
}

/** N′ = n(n−1)/2 and the two ranks of the interval ends, one per board so they fit on phones */
export function FormulaGilbertRanks() {
  return (
    <>
      <Board>
        {NPrime}
        <mo>=</mo>
        <mfrac>
          <mrow>
            <mi>n</mi>
            <mo stretchy="false">(</mo>
            <mi>n</mi>
            <mo>−</mo>
            <mn>1</mn>
            <mo stretchy="false">)</mo>
          </mrow>
          <mn>2</mn>
        </mfrac>
      </Board>
      <Board>
        <msub>
          <mi>k</mi>
          <mtext>{L('low', 'inf')}</mtext>
        </msub>
        <mo>=</mo>
        <mrow>
          <mo>⌊</mo>
          <mfrac>
            <mrow>
              {NPrime}
              <mo>−</mo>
              <mi>C</mi>
            </mrow>
            <mn>2</mn>
          </mfrac>
          <mo>⌋</mo>
        </mrow>
      </Board>
      <Board>
        <msub>
          <mi>k</mi>
          <mtext>{L('high', 'sup')}</mtext>
        </msub>
        <mo>=</mo>
        <mrow>
          <mo>⌈</mo>
          <mfrac>
            <mrow>
              {NPrime}
              <mo>+</mo>
              <mi>C</mi>
            </mrow>
            <mn>2</mn>
          </mfrac>
          <mo>⌉</mo>
        </mrow>
      </Board>
    </>
  )
}

/** C = 1.96 √( n(n−1)(2n+5)/18 · (1+ρ)/(1−ρ) ), with 0 ≤ ρ ≤ 0.95 below it */
export function FormulaGilbertC() {
  return (
    <Board note={L(`with 0 ≤ ρ ≤ ${fmtNumber(0.95, 2)}`, `con 0 ≤ ρ ≤ ${fmtNumber(0.95, 2)}`)}>
      <mi>C</mi>
      <mo>=</mo>
      <mn>{fmtNumber(1.96, 2)}</mn>
      <msqrt>
        <mfrac>
          <mrow>
            <mi>n</mi>
            <mo stretchy="false">(</mo>
            <mi>n</mi>
            <mo>−</mo>
            <mn>1</mn>
            <mo stretchy="false">)</mo>
            <mo stretchy="false">(</mo>
            <mn>2</mn>
            <mi>n</mi>
            <mo>+</mo>
            <mn>5</mn>
            <mo stretchy="false">)</mo>
          </mrow>
          <mn>18</mn>
        </mfrac>
        <mo>·</mo>
        <mfrac>
          <mrow>
            <mn>1</mn>
            <mo>+</mo>
            <mi>ρ</mi>
          </mrow>
          <mrow>
            <mn>1</mn>
            <mo>−</mo>
            <mi>ρ</mi>
          </mrow>
        </mfrac>
      </msqrt>
    </Board>
  )
}

/** Inline symbol for running text, e.g. <Sym>r₁</Sym> */
export function Sym({ children }: { children: ReactNode }) {
  return <var className="how-sym">{children}</var>
}
