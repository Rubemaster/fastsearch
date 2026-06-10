import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
const flat24 = Array(24).fill(1)

// --- Pill type registry ---
const PILL_TYPES = {
  'morning-peak': {
    index: 100,
    label: 'Morning Peak',
    defaultParams: { size: 'Normal' },
    // Adds a morning hump on hours 7-10 that always increases consumption
    transform(curve, params) {
      const mult = { Small: 0.7, Normal: 1.0, Large: 1.4 }[params.size]
      const adds = { 7: 2.5, 8: 3.5, 9: 2.0, 10: 0.8 }
      return curve.map((v, i) => adds[i] !== undefined ? +(v + adds[i] * mult).toFixed(4) : v)
    },
  },
  'evening-peak': {
    index: 101,
    label: 'Evening Peak',
    defaultParams: { size: 'Normal' },
    // Adds an evening hump on hours 16-19 that always increases consumption
    transform(curve, params) {
      const mult = { Small: 0.7, Normal: 1.0, Large: 1.4 }[params.size]
      const adds = { 16: 1.5, 17: 3.5, 18: 3.0, 19: 1.8 }
      return curve.map((v, i) => adds[i] !== undefined ? +(v + adds[i] * mult).toFixed(4) : v)
    },
  },
}

// --- Average normalizer (always last, index 1,000,000) ---
function normalizeToDaily(curve, targetDaily) {
  const sum = curve.reduce((a, b) => a + b, 0)
  if (sum === 0) return curve
  const factor = targetDaily / sum
  return curve.map(v => +(v * factor).toFixed(2))
}

// --- Pipeline: apply all pills in index order, then normalize ---
function buildCurve(activePills, targetDaily) {
  let curve = [...flat24]
  const sorted = [...activePills].sort(
    (a, b) => (PILL_TYPES[a.type]?.index ?? 0) - (PILL_TYPES[b.type]?.index ?? 0)
  )
  for (const pill of sorted) {
    const def = PILL_TYPES[pill.type]
    if (def) curve = def.transform(curve, pill.params)
  }
  return normalizeToDaily(curve, targetDaily)
}

const periodMult = { daily: 1, weekly: 7, monthly: 30, annual: 365 }

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0 } },
    y: { beginAtZero: true, grid: { color: '#eee' }, ticks: { font: { size: 9 }, callback: v => v + 'kW' } }
  }
}

function Pill({ onClick, onRemove, hideDot, style, children, ...rest }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={e => { onClick?.(e) }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: '1px solid #ddd', borderRadius: 8,
        padding: '0 14px', height: 28, fontSize: 13, color: '#555',
        cursor: onRemove || onClick ? 'pointer' : 'default',
        userSelect: onRemove || onClick ? 'none' : undefined,
        boxSizing: 'border-box', position: 'relative',
        ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {!hideDot && (
        <span
          onClick={e => { e.stopPropagation(); onRemove?.() }}
          style={{
            display: 'inline-block', width: 10, height: 10,
            borderRadius: '50%', flexShrink: 0, marginRight: 4,
            background: onRemove && hover ? '#e53e3e' : '#ccc',
            cursor: onRemove ? 'pointer' : 'default',
          }}
        />
      )}
      {children}
    </div>
  )
}

function PeakPill({ pill, onRemove, onParamChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const def = PILL_TYPES[pill.type]

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <Pill onRemove={() => onRemove(pill.id)}>
      <div ref={ref} style={{ position: 'relative', display: 'inline-flex', gap: 3 }}>
        <span onClick={() => setOpen(!open)} style={{ cursor: 'pointer', fontWeight: 700 }}>
          {pill.params.size} <span style={{ fontSize: 9, color: '#888' }}>▾</span>
        </span>
        <span>{def.label.toLowerCase()}</span>
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 10,
            background: '#fff', border: '1px solid #e5e5e5', borderRadius: 4,
            boxShadow: '0 2px 10px rgba(0,0,0,0.07)', padding: '2px 0',
            minWidth: 60, marginTop: 3
          }}>
            {['Small','Normal','Large'].map(s => (
              <div key={s}
                onClick={() => { onParamChange(pill.id, 'size', s); setOpen(false) }}
                style={{
                  padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                  background: s === pill.params.size ? '#f5f5f5' : 'transparent', color: '#444',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                onMouseLeave={e => e.currentTarget.style.background = s === pill.params.size ? '#f5f5f5' : 'transparent'}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    </Pill>
  )
}

function mkData(data, color) {
  return {
    labels,
    datasets: [{
      data,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 1,
      borderRadius: 2,
    }]
  }
}

export default function App() {
  // --- Pills state ---
  const [pills, setPills] = useState([
    { id: 'morning', type: 'morning-peak', params: { size: 'Normal' } },
    { id: 'afternoon', type: 'evening-peak', params: { size: 'Normal' } },
  ])

  // --- Average state ---
  const [targetDaily, setTargetDaily] = useState(31.9)
  const [inputStr, setInputStr] = useState('31.9')
  const [period, setPeriod] = useState('daily')

  const wdRef = useRef(null)
  const weRef = useRef(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  const periodRef = useRef(null)
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef(null)

  // --- Derive curve data ---
  const wdCurve = useMemo(() => buildCurve(pills, targetDaily), [pills, targetDaily])
  const weCurve = useMemo(() => buildCurve(pills, targetDaily), [pills, targetDaily])

  const wdPeak = Math.max(...wdCurve)
  const wePeak = Math.max(...weCurve)
  const wdTotal = wdCurve.reduce((a, b) => a + b, 0)
  const weTotal = weCurve.reduce((a, b) => a + b, 0)

  // --- Input controllers ---
  const handleInput = useCallback(e => {
    setInputStr(e.target.value)
    const v = parseFloat(e.target.value)
    if (!isNaN(v) && v > 0) {
      setTargetDaily(v / periodMult[period])
    }
  }, [period])

  const handlePeriodChange = useCallback(e => {
    const next = e.target.value
    setPeriod(next)
    setInputStr((targetDaily * periodMult[next]).toFixed(1))
  }, [targetDaily])

  // --- Pill controls ---
  const activeTypes = pills.map(p => p.type)

  const addPill = useCallback(type => {
    const def = PILL_TYPES[type]
    if (!def || activeTypes.includes(type)) return
    setPills(prev => [...prev, {
      id: type,
      type,
      params: { ...def.defaultParams },
    }])
  }, [activeTypes])

  const removePill = useCallback(id => {
    setPills(prev => prev.filter(p => p.id !== id))
  }, [])

  const setPillParam = useCallback((id, key, value) => {
    setPills(prev => prev.map(p =>
      p.id === id ? { ...p, params: { ...p.params, [key]: value } } : p
    ))
  }, [])

  // --- Sorted pills for rendering ---
  const sortedPills = useMemo(
    () => [...pills].sort(
      (a, b) => (PILL_TYPES[a.type]?.index ?? 0) - (PILL_TYPES[b.type]?.index ?? 0)
    ),
    [pills]
  )

  // --- Dropdown close handlers ---
  useEffect(() => {
    if (!periodOpen) return
    const handler = e => {
      if (periodRef.current && !periodRef.current.contains(e.target)) setPeriodOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [periodOpen])

  useEffect(() => {
    if (!addOpen) return
    const handler = e => {
      if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [addOpen])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, color: '#333' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px 0', color: '#555' }}>Weekday</h2>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
            {wdTotal.toFixed(1)} kWh/day &middot; {wdPeak.toFixed(1)} kW peak
          </div>
          <div style={{ width: 420, height: 260 }}>
            <Bar ref={wdRef} data={mkData(wdCurve, 'rgba(59,130,246,0.7)')} options={chartOpts} />
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px 0', color: '#555' }}>Weekend</h2>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
            {weTotal.toFixed(1)} kWh/day &middot; {wePeak.toFixed(1)} kW peak
          </div>
          <div style={{ width: 420, height: 260 }}>
            <Bar ref={weRef} data={mkData(weCurve, 'rgba(34,197,94,0.7)')} options={chartOpts} />
          </div>
        </div>
      </div>

      {/* --- Pills bar --- */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 18 }}>
        {/* Average pill (always present, index 1,000,000 conceptually) */}
        <Pill>
          <span>Average</span>
          <div ref={periodRef} style={{ position: 'relative' }}>
            <span
              onClick={() => setPeriodOpen(!periodOpen)}
              style={{ cursor: 'pointer', color: '#333', fontWeight: 700 }}
            >
              {period} <span style={{ fontSize: 9, color: '#888' }}>▾</span>
            </span>
            {periodOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 10,
                background: '#fff', border: '1px solid #e5e5e5', borderRadius: 4,
                boxShadow: '0 2px 10px rgba(0,0,0,0.07)', padding: '2px 0',
                minWidth: 72, marginTop: 3
              }}>
                {['daily','weekly','monthly','annual'].map(p => (
                  <div
                    key={p}
                    onClick={() => { handlePeriodChange({ target: { value: p } }); setPeriodOpen(false) }}
                    style={{
                      padding: '4px 10px', cursor: 'pointer', fontSize: 12, lineHeight: '1.6',
                      background: p === period ? '#f5f5f5' : 'transparent',
                      color: '#444',
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
          <span>use</span>
          <input
            type="text"
            value={inputStr}
            onChange={handleInput}
            style={{
              width: 66, padding: '2px 0 2px 6px', fontSize: 13,
              border: 'none', borderBottom: '1px solid #ddd', textAlign: 'right',
              outline: 'none', background: 'transparent'
            }}
            onFocus={e => e.target.style.borderBottomColor = '#666'}
            onBlur={e => e.target.style.borderBottomColor = '#ddd'}
          />
          <span>kWh</span>
        </Pill>

        {/* Peak pills */}
        {sortedPills.map(pill => (
          <PeakPill
            key={pill.id}
            pill={pill}
            onRemove={removePill}
            onParamChange={setPillParam}
          />
        ))}

        {/* + Add button */}
        <div ref={addRef} style={{ position: 'relative' }}>
          <Pill
            hideDot
            onClick={() => setAddOpen(!addOpen)}
            style={{ border: '1px dashed #bbb', color: '#999' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#333' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#bbb'; e.currentTarget.style.color = '#999' }}
          >
            +
          </Pill>
          {addOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 10, marginTop: 3,
              background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '4px 0', minWidth: 120
            }}>
              {Object.entries(PILL_TYPES).map(([type, def]) =>
                !activeTypes.includes(type) ? (
                  <div
                    key={type}
                    onClick={() => { addPill(type); setAddOpen(false) }}
                    style={{
                      padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#444',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {def.label.toLowerCase()}
                  </div>
                ) : null
              )}
              {Object.keys(PILL_TYPES).every(t => activeTypes.includes(t)) && (
                <div style={{ padding: '6px 12px', fontSize: 12, color: '#999' }}>
                  all peaks shown
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
