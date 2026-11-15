// Contents of the case-file sheets opened from the evidence board ("How it works" lives in ./how/).
// Featured cases only show title, place and question: never facts, slopes or p-values.
import { FEATURED } from './featuredCases'

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
