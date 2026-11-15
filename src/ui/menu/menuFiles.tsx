// Contents of the case-file sheets opened from the evidence board ("How it works" lives in ./how/).
// Featured cases only show title, place and question: never facts, slopes or p-values.
import type { CSSProperties } from 'react'
import { DEFAULT_TRACK, MUSIC_TRACKS, type MusicTrackId } from '../../shared/music'
import { FEATURED } from './featuredCases'
import { L } from '../../shared/i18n'
import './Credits.css'

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

// Names, datasets and licenses match REFERENCES.md: update both together.
const TEAM: [name: string, initials: string, role: string][] = [
  ['Manuel Gallego Prieto', 'MG', L('Backend, database and integration', 'Backend, base de datos e integración')],
  ['Pablo Jonas Romo González', 'PR', L('Interface and menus', 'Interfaz y menús')],
  ['Iván Calvo Benito', 'IC', L('Featured cases, statistics and map details', 'Casos destacados, estadística y detalles del mapa')],
  ['Diego Baños García', 'DB', L('Trend analysis and case tutorials', 'Análisis de tendencias y tutoriales de los casos')],
  ['Ezequiel David Jiménez García', 'EJ', L('Product, stories and pitch', 'Producto, historias y presentación')],
]

const NASA_DATA: [name: string, product: string, use: string][] = [
  ['MERRA-2', 'tavgM_2d_slv_Nx monthly (M2TMNXSLV), v5.12.4', L('Long air temperature record', 'Registro largo de temperatura del aire')],
  ['GPM IMERG', 'Final Precipitation L3 monthly 0.1° (GPM_3IMERGM), V07', L('Rain and snow', 'Lluvia y nieve')],
  ['GLDAS', 'Noah Land Surface Model L4 monthly 0.25° (GLDAS_NOAH025_M), v2.1', L('Air temperature, wind, soil moisture, evaporation', 'Temperatura del aire, viento, humedad del suelo, evaporación')],
  ['POWER', 'Monthly point data (NASA Langley Research Center POWER Project), API v2.10.0', L('Backup source for the featured cases', 'Fuente de respaldo para los casos destacados')],
  ['GIBS', 'Blue Marble Next Generation', L('Satellite colours of the map', 'Colores de satélite del mapa')],
]

const TRACK_IDS = Object.keys(MUSIC_TRACKS) as MusicTrackId[]

export function Credits() {
  return (
    <div className="credits">
      <p className="credits__lead">
        {L('Made by team', 'Hecho por el equipo')} <strong>Na-sales</strong> {L('for the NASA Space Apps Challenge 2026.', 'para el NASA Space Apps Challenge 2026.')}
      </p>

      <section style={{ '--n': 1 } as CSSProperties}>
        <div className="credits__head">
          <h3>{L('The detectives', 'Los detectives')}</h3>
          <span className="credits__count">{TEAM.length} {L('on the case', 'en el caso')}</span>
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
          <h3>{L('The evidence: NASA data', 'Las pruebas: datos de la NASA')}</h3>
          <span className="credits__count">{NASA_DATA.length} {L('sources', 'fuentes')}</span>
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
          <h3>{L('Music', 'Música')}</h3>
          <span className="credits__count">{TRACK_IDS.length} {L('tracks', 'pistas')}</span>
        </div>
        <ul className="credits-tracks">
          {TRACK_IDS.map((id) => (
            <li key={id} className={id === DEFAULT_TRACK ? 'credits-track credits-track--playing' : 'credits-track'}>
              <span className="credits-track__disc" aria-hidden="true" />
              <div>
                <span className="credits-track__title">{MUSIC_TRACKS[id].title}</span>
                <span className="credits-track__by">
                  {L('by', 'de')} {MUSIC_TRACKS[id].author}, OpenGameArt
                  <span className="credits__fine">{id === DEFAULT_TRACK ? L('Main theme', 'Tema principal') : L('Alternative theme', 'Tema alternativo')}</span>
                </span>
              </div>
              <span className="credits-stamp">
                <span className="credits__sr">{L('License: ', 'Licencia: ')}</span>CC0 1.0
                <small>{L('Public domain', 'Dominio público')}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="credits__hand">{L('Sound effects: made by the team, synthesised in the browser.', 'Efectos de sonido: hechos por el equipo, sintetizados en el navegador.')}</p>
      </section>

      <section style={{ '--n': 4 } as CSSProperties}>
        <div className="credits__head">
          <h3>{L('Also on the case', 'También en el caso')}</h3>
        </div>
        <dl className="credits-rows credits-rows--plain">
          <div className="credits-row">
            <dt>{L('Map', 'Mapa')}</dt>
            <dd>
              AWS Terrain Tiles, Natural Earth, GeoNames
              <span className="credits__fine">{L('Open data and public domain; GeoNames under CC BY 4.0', 'Datos abiertos y dominio público; GeoNames con licencia CC BY 4.0')}</span>
            </dd>
          </div>
          <div className="credits-row">
            <dt>{L('Tools', 'Herramientas')}</dt>
            <dd>
              React, Vite, three.js, Supabase
              <span className="credits__fine">{L('Open source: MIT and Apache-2.0', 'Código abierto: MIT y Apache-2.0')}</span>
            </dd>
          </div>
          <div className="credits-row">
            <dt>{L('Fonts', 'Tipografías')}</dt>
            <dd>
              Big Shoulders Display, Kalam, Courier Prime
              <span className="credits__fine">SIL Open Font License 1.1</span>
            </dd>
          </div>
        </dl>
      </section>

      <p className="case-file__aside" style={{ '--n': 5 } as CSSProperties}>
        {L(
          'Full list of sources and licenses: REFERENCES.md in the project repository.',
          'Lista completa de fuentes y licencias: REFERENCES.md en el repositorio del proyecto.',
        )}
      </p>
    </div>
  )
}
