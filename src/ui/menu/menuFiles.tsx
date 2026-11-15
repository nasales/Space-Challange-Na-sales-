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

// Names, datasets and licenses match REFERENCES.md: update both together.
const TEAM: [name: string, role: string][] = [
  ['Manuel Gallego Prieto', 'Backend, database and integration'],
  ['Pablo Jonas Romo Gonzalez', 'Interface and menus'],
  ['Iván Calvo Benito', 'Featured cases, statistics and map details'],
  ['Diego Baños García', 'Trend analysis and case tutorials'],
  ['Ezequiel David Jimenez García', 'Product, stories and pitch'],
]

const NASA_DATA: [name: string, product: string, use: string][] = [
  ['MERRA-2', 'tavgM_2d_slv_Nx monthly (M2TMNXSLV), v5.12.4', 'Long air temperature record'],
  ['GPM IMERG', 'Final Precipitation L3 monthly 0.1° (GPM_3IMERGM), V07', 'Rain and snow'],
  ['GLDAS', 'Noah Land Surface Model L4 monthly 0.25° (GLDAS_NOAH025_M), v2.1', 'Air temperature, wind, soil moisture, evaporation'],
  ['POWER', 'Monthly point data (NASA Langley Research Center POWER Project), API v2.10.0', 'Backup source for the featured cases'],
  ['GIBS', 'Blue Marble Next Generation', 'Satellite colours of the map'],
]

const MUSIC: [title: string, author: string, note: string][] = [
  ['Investigation', 'Umplix', 'Main theme'],
  ['Jazz (Saxophone)', 'Pro Sensory', 'Alternative theme'],
]

export function Credits() {
  return (
    <>
      <p>Made by team Na-sales for the NASA Space Apps Challenge 2026.</p>

      <h3>The team</h3>
      <dl className="case-file__credits">
        {TEAM.map(([name, role]) => (
          <div key={name} className="case-file__credit">
            <dt>{name}</dt>
            <dd>{role}</dd>
          </div>
        ))}
      </dl>

      <h3>NASA data</h3>
      <dl className="case-file__credits">
        {NASA_DATA.map(([name, product, use]) => (
          <div key={name} className="case-file__credit">
            <dt>NASA {name}</dt>
            <dd>
              {use}
              <span className="case-file__credit-note">{product}</span>
            </dd>
          </div>
        ))}
      </dl>

      <h3>Music</h3>
      <dl className="case-file__credits">
        {MUSIC.map(([title, author, note]) => (
          <div key={title} className="case-file__credit">
            <dt>{title}</dt>
            <dd>
              by {author} (OpenGameArt). {note}
              <span className="case-file__credit-note">License: CC0 1.0 Universal, public domain</span>
            </dd>
          </div>
        ))}
        <div className="case-file__credit">
          <dt>Sound effects</dt>
          <dd>Made by the team, synthesised in the browser</dd>
        </div>
      </dl>

      <h3>Also built with</h3>
      <dl className="case-file__credits">
        <div className="case-file__credit">
          <dt>Map</dt>
          <dd>AWS Terrain Tiles, Natural Earth, GeoNames (CC BY 4.0)</dd>
        </div>
        <div className="case-file__credit">
          <dt>Tools</dt>
          <dd>React, Vite, three.js, Supabase</dd>
        </div>
        <div className="case-file__credit">
          <dt>Fonts</dt>
          <dd>
            Big Shoulders Display, Kalam, Courier Prime
            <span className="case-file__credit-note">License: SIL Open Font License 1.1</span>
          </dd>
        </div>
      </dl>

      <p className="case-file__aside">Full list of sources and licenses: REFERENCES.md in the project repository.</p>
    </>
  )
}
