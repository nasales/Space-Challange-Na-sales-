// Contents of the case-file sheets opened from the evidence board ("How it works" lives in ./how/).
// Featured cases only show title, place and question: never facts, slopes or p-values.
import { FEATURED } from './featuredCases'
import { L } from '../../shared/i18n'

export function FeaturedCases() {
  return (
    <>
      <p>
        {L(
          `${FEATURED.length} open files across Spain. Each one starts with a question; the answer is up to you.`,
          `${FEATURED.length} expedientes abiertos por toda España. Cada uno empieza con una pregunta; la respuesta la decides tú.`,
        )}
      </p>
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
      <p>{L('Made by team Na-sales for the NASA Space Apps Challenge 2026.', 'Hecho por el equipo Na-sales para el NASA Space Apps Challenge 2026.')}</p>
      <dl className="case-file__credits">
        <dt>{L('Climate data', 'Datos del clima')}</dt>
        <dd>NASA MERRA-2, NASA GPM IMERG, NASA GLDAS, NASA POWER</dd>
        <dt>{L('Map', 'Mapa')}</dt>
        <dd>NASA GIBS Blue Marble, AWS Terrain Tiles, Natural Earth, GeoNames</dd>
        <dt>{L('Tools', 'Herramientas')}</dt>
        <dd>React, Vite, three.js</dd>
        <dt>{L('Fonts', 'Tipografías')}</dt>
        <dd>{L('See REFERENCES.md', 'Ver REFERENCES.md')}</dd>
      </dl>
      <p className="case-file__aside">
        {L(
          'Full list of sources and licenses: REFERENCES.md in the project repository.',
          'Lista completa de fuentes y licencias: REFERENCES.md en el repositorio del proyecto.',
        )}
      </p>
    </>
  )
}
