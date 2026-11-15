// Contents of the case-file sheets opened from the evidence board ("How it works" lives in ./how/).
// Featured cases only show title, place and question: never facts, slopes or p-values.
import type { CSSProperties } from 'react'
import { DEFAULT_TRACK, MUSIC_TRACKS, type MusicTrackId } from '../../shared/music'
import { FEATURED } from './featuredCases'
import './Credits.css'

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
const TEAM: [name: string, initials: string, role: string][] = [
  ['Manuel Gallego Prieto', 'MG', 'Backend, database and integration'],
  ['Pablo Jonas Romo González', 'PR', 'Interface and menus'],
  ['Iván Calvo Benito', 'IC', 'Featured cases, statistics and map details'],
  ['Diego Baños García', 'DB', 'Trend analysis and case tutorials'],
  ['Ezequiel David Jiménez García', 'EJ', 'Product, stories and pitch'],
]

const NASA_DATA: [name: string, product: string, use: string][] = [
  ['MERRA-2', 'tavgM_2d_slv_Nx monthly (M2TMNXSLV), v5.12.4', 'Long air temperature record'],
  ['GPM IMERG', 'Final Precipitation L3 monthly 0.1° (GPM_3IMERGM), V07', 'Rain and snow'],
  ['GLDAS', 'Noah Land Surface Model L4 monthly 0.25° (GLDAS_NOAH025_M), v2.1', 'Air temperature, wind, soil moisture, evaporation'],
  ['POWER', 'Monthly point data (NASA Langley Research Center POWER Project), API v2.10.0', 'Backup source for the featured cases'],
  ['GIBS', 'Blue Marble Next Generation', 'Satellite colours of the map'],
]

const TRACK_IDS = Object.keys(MUSIC_TRACKS) as MusicTrackId[]

export function Credits() {
  return (
    <div className="credits">
      <p className="credits__lead">
        Made by team <strong>Na-sales</strong> for the NASA Space Apps Challenge 2026.
      </p>

      <section style={{ '--n': 1 } as CSSProperties}>
        <div className="credits__head">
          <h3>The detectives</h3>
          <span className="credits__count">{TEAM.length} on the case</span>
        </div>
        <ul className="credits-team">
          {TEAM.map(([name, initials, role], index) => (
            <li key={name} className="credits-agent" style={{ '--i': index } as CSSProperties}>
              <span className="credits-agent__badge" aria-hidden="true">
                {initials}
              </span>
              <div>
                <span className="credits-agent__name">{name}</span>
                <span className="credits-agent__role">{role}</span>
              </div>
            </li>
          ))}
          <li className="credits-team__stamp" aria-hidden="true">
            <span className="credits-stamp credits-stamp--big">
              Na-sales
              <small>Space Apps 2026</small>
            </span>
          </li>
        </ul>
      </section>

      <section style={{ '--n': 2 } as CSSProperties}>
        <div className="credits__head">
          <h3>The evidence: NASA data</h3>
          <span className="credits__count">{NASA_DATA.length} sources</span>
        </div>
        <dl className="credits-rows">
          {NASA_DATA.map(([name, product, use]) => (
            <div key={name} className="credits-row">
              <dt>NASA {name}</dt>
              <dd>
                {use}
                <span className="credits__fine">{product}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section style={{ '--n': 3 } as CSSProperties}>
        <div className="credits__head">
          <h3>Music</h3>
          <span className="credits__count">{TRACK_IDS.length} tracks</span>
        </div>
        <ul className="credits-tracks">
          {TRACK_IDS.map((id) => (
            <li key={id} className={id === DEFAULT_TRACK ? 'credits-track credits-track--playing' : 'credits-track'}>
              <span className="credits-track__disc" aria-hidden="true" />
              <div>
                <span className="credits-track__title">{MUSIC_TRACKS[id].title}</span>
                <span className="credits-track__by">
                  by {MUSIC_TRACKS[id].author}, OpenGameArt
                  <span className="credits__fine">{id === DEFAULT_TRACK ? 'Main theme' : 'Alternative theme'}</span>
                </span>
              </div>
              <span className="credits-stamp">
                <span className="credits__sr">License: </span>CC0 1.0
                <small>Public domain</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="credits__hand">Sound effects: made by the team, synthesised in the browser.</p>
      </section>

      <section style={{ '--n': 4 } as CSSProperties}>
        <div className="credits__head">
          <h3>Also on the case</h3>
        </div>
        <dl className="credits-rows credits-rows--plain">
          <div className="credits-row">
            <dt>Map</dt>
            <dd>
              AWS Terrain Tiles, Natural Earth, GeoNames
              <span className="credits__fine">Open data and public domain; GeoNames under CC BY 4.0</span>
            </dd>
          </div>
          <div className="credits-row">
            <dt>Tools</dt>
            <dd>
              React, Vite, three.js, Supabase
              <span className="credits__fine">Open source: MIT and Apache-2.0</span>
            </dd>
          </div>
          <div className="credits-row">
            <dt>Fonts</dt>
            <dd>
              Big Shoulders Display, Kalam, Courier Prime
              <span className="credits__fine">SIL Open Font License 1.1</span>
            </dd>
          </div>
        </dl>
      </section>

      <p className="case-file__aside" style={{ '--n': 5 } as CSSProperties}>
        Full list of sources and licenses: REFERENCES.md in the project repository.
      </p>
    </div>
  )
}
