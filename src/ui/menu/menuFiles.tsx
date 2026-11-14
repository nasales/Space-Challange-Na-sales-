// Contents of the three case-file sheets opened from the evidence board.
// Featured cases only show title, place and question: never facts, slopes or p-values.
import { FEATURED } from './featuredCases'

export function HowItWorks() {
  return (
    <>
      <p>
        Every clue in this game is <strong>NASA Earth observation data</strong>: satellites, and computer
        models that mix satellite and ground measurements. Spain is cut into squares of about 28 km, with one
        value per month.
      </p>
      <h3>When you pick a place and a variable, the detective:</h3>
      <ol className="case-file__steps">
        <li>
          <strong>Removes the seasons.</strong> Summer is always hotter than winter, so each month is compared
          with the usual value for that month.
        </li>
        <li>
          <strong>Measures the change.</strong> How fast the values go up or down over the years, for example
          "+0.3 °C every 10 years".
        </li>
        <li>
          <strong>Checks it is not luck.</strong> A test called Mann-Kendall asks: could a change this big
          appear by pure chance? If that is very unlikely (less than 5 in 100), the trend is{' '}
          <strong>significant</strong>.
        </li>
      </ol>
      <h3>How to read the result</h3>
      <ul className="case-file__notes">
        <li>Significant trend: the data show a clear change.</li>
        <li>
          No significant trend: the data do not show a clear change. That is a real answer, but it does not
          prove that nothing changed.
        </li>
        <li>A trend is not a cause. The data say that something changed, not why.</li>
      </ul>
      <p className="case-file__aside">
        You write your conclusion first. The detective's numbers are only shown after you submit it.
      </p>
    </>
  )
}

export function FeaturedCases() {
  return (
    <>
      <p>{FEATURED.length} open files across Spain. Each one starts with a question; the answer is up to you.</p>
      <ul className="case-file__cases">
        {FEATURED.map((item, index) => (
          <li key={item.id} className="case-file__case">
            <span className="case-file__case-no" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h3>{item.title}</h3>
              <p className="case-file__place">{item.place}</p>
              <p className="case-file__question">{item.question}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Credits() {
  return (
    <>
      <p>Made by team Na-sales for the NASA Space Apps Challenge 2026.</p>
      <dl className="case-file__credits">
        <dt>Climate data</dt>
        <dd>NASA MERRA-2, NASA GPM IMERG, NASA GLDAS, NASA POWER</dd>
        <dt>Map</dt>
        <dd>NASA GIBS Blue Marble, AWS Terrain Tiles, Natural Earth, GeoNames</dd>
        <dt>Tools</dt>
        <dd>React, Vite, three.js</dd>
        <dt>Fonts</dt>
        <dd>See REFERENCES.md</dd>
      </dl>
      <p className="case-file__aside">Full list of sources and licenses: REFERENCES.md in the project repository.</p>
    </>
  )
}
