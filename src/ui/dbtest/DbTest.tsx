// Database test page (temporary, for the team): open the site with ?dbtest.
// Checks the browser -> Supabase connection (publishable key, read only) and shows a short summary.
// Not linked from the game; agreed with Yeipi (Interface) on 2026-11-14.
import { useState } from 'react'
import {
  fetchCase,
  fetchCases,
  fetchCell,
  pingSupabase,
  supabaseConfigured,
  type CaseSummary,
  type CellVariable,
} from '../../shared/supabase'
import type { CaseData } from '../../shared/contract'
import { VERSION_LABEL } from '../../shared/version'
import './DbTest.css'

interface Result {
  connected: boolean
  cases?: CaseSummary[]
  firstCase?: CaseData
  cell?: CellVariable[]
  errors: string[]
  ms: number
}

// Cordoba, a land point with all six variables
const POINT = { lat: 37.88, lon: -4.78 }

const fmt = (x: number | null | undefined, digits = 3) => (x == null ? '-' : x.toFixed(digits))

async function attempt<T>(label: string, run: () => Promise<T>, errors: string[]): Promise<T | undefined> {
  try {
    return await run()
  } catch (err) {
    errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
    return undefined
  }
}

export default function DbTest() {
  const [lat, setLat] = useState(String(POINT.lat))
  const [lon, setLon] = useState(String(POINT.lon))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function runTest() {
    setBusy(true)
    const t0 = performance.now()
    const errors: string[] = []
    const connected = (await attempt('connection', () => pingSupabase(), errors)) !== undefined
    const cases = await attempt('cases', () => fetchCases(), errors)
    const firstCase = cases?.length ? await attempt('case', () => fetchCase(cases[0].id), errors) : undefined
    const cell = await attempt('get_cell', () => fetchCell(Number(lat), Number(lon)), errors)
    setResult({ connected, cases, firstCase, cell, errors, ms: Math.round(performance.now() - t0) })
    setBusy(false)
  }

  const ok = result && result.errors.length === 0 && result.connected

  return (
    <div className="dbtest">
      <h1>Database test</h1>
      <p className="dbtest-note">
        Browser → Supabase (read only). Data: NASA MERRA-2, GPM IMERG, GLDAS. Build: {VERSION_LABEL}
        {!supabaseConfigured && ' · Supabase is not configured in this build'}
      </p>

      <div className="dbtest-controls">
        <label>
          Lat <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Lon <input value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" />
        </label>
        <button type="button" onClick={runTest} disabled={busy}>
          {busy ? 'Testing…' : 'Test database'}
        </button>
      </div>

      {result && (
        <div className="dbtest-result">
          <p className={ok ? 'dbtest-ok' : 'dbtest-bad'}>
            {ok ? 'Connected' : 'Problem found'} · {result.ms} ms · Supabase: {result.connected ? 'connected' : 'no answer'}
          </p>

          {result.errors.length > 0 && (
            <ul className="dbtest-errors">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {result.cases && (
            <section>
              <h2>Featured cases: {result.cases.length}</h2>
              <p>{result.cases.map((c) => c.id.replace(/^case_/, '')).join(', ')}</p>
              {result.firstCase && (
                <p>
                  First case: <b>{result.firstCase.place}</b> · {result.firstCase.variable} ({result.firstCase.units}) ·{' '}
                  {result.firstCase.dates.length} months · slope {fmt(result.firstCase.slope, 4)} /year · p ={' '}
                  {fmt(result.firstCase.p_value)} · {result.firstCase.significant ? 'significant' : 'not significant'}
                </p>
              )}
            </section>
          )}

          {result.cell && (
            <section>
              <h2>
                Point ({lat}, {lon}):{' '}
                {result.cell.length === 0
                  ? 'no data (sea or outside the map)'
                  : `cell ${result.cell[0].cell_id}, ${fmt(result.cell[0].distance_km, 1)} km away`}
              </h2>
              {result.cell.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Variable</th>
                      <th>Unit</th>
                      <th>From</th>
                      <th>Months</th>
                      <th>Trend / decade</th>
                      <th>p</th>
                      <th>Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cell.map((v) => (
                      <tr key={v.var_id}>
                        <td>{v.name_en}</td>
                        <td>{v.unit}</td>
                        <td>{v.start_month.slice(0, 7)}</td>
                        <td>{v.values.length}</td>
                        <td>{fmt(v.slope_per_decade)}</td>
                        <td>{fmt(v.p_value)}</td>
                        <td>{v.direction ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
