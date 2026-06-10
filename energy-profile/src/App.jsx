import { useState, useRef, useEffect, useCallback } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip)

const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)

const wdBase = [0.4,0.4,0.4,0.4,0.5,1.2,2.8,3.2,1.4,0.8,0.6,0.5,0.5,0.5,0.6,1.0,2.2,3.8,3.4,2.8,1.6,0.8,0.5,0.4]
const weBase = [0.4,0.4,0.4,0.4,0.4,0.5,0.8,1.4,2.6,3.0,2.4,2.0,1.8,1.6,1.6,2.0,2.8,3.8,4.2,3.4,2.6,1.8,1.0,0.6]

const wdSum = wdBase.reduce((a, b) => a + b, 0)
const weSum = weBase.reduce((a, b) => a + b, 0)
const baseDaily = (wdSum * 5 + weSum * 2) / 7

const periodMult = { daily: 1, weekly: 7, monthly: 30, annual: 365 }
const periodLabel = { daily: 'day', weekly: 'week', monthly: 'month', annual: 'year' }

function scale(arr, f) { return arr.map(v => +(v * f).toFixed(2)) }

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
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
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
  const [daily, setDaily] = useState(baseDaily)
  const [inputStr, setInputStr] = useState(baseDaily.toFixed(1))
  const [period, setPeriod] = useState('daily')
  const wdRef = useRef(null)
  const weRef = useRef(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  const periodRef = useRef(null)
  const [extraProfiles, setExtraProfiles] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef(null)
  const [morningSize, setMorningSize] = useState('Normal')
  const [afternoonSize, setAfternoonSize] = useState('Normal')
  const [morningOpen, setMorningOpen] = useState(false)
  const [afternoonOpen, setAfternoonOpen] = useState(false)
  const morningRef = useRef(null)
  const afternoonRef = useRef(null)
  const [peakPills, setPeakPills] = useState(['morning', 'afternoon'])

  const addProfile = useCallback(() => {
    setExtraProfiles(prev => [...prev, {
      id: Date.now(),
      label: `Profile ${prev.length + 1}`,
      color: `hsl(${(prev.length * 60 + 200) % 360}, 60%, 55%)`
    }])
  }, [])

  useEffect(() => {
    if (!periodOpen) return
    const handler = e => {
      if (periodRef.current && !periodRef.current.contains(e.target)) {
        setPeriodOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [periodOpen])

  useEffect(() => {
    if (!addOpen) return
    const handler = e => {
      if (addRef.current && !addRef.current.contains(e.target)) {
        setAddOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [addOpen])

  useEffect(() => {
    if (!morningOpen) return
    const handler = e => { if (morningRef.current && !morningRef.current.contains(e.target)) setMorningOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [morningOpen])

  useEffect(() => {
    if (!afternoonOpen) return
    const handler = e => { if (afternoonRef.current && !afternoonRef.current.contains(e.target)) setAfternoonOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [afternoonOpen])

  // When user types, parse in the current period & convert to daily
  const handleInput = useCallback(e => {
    setInputStr(e.target.value)
    const v = parseFloat(e.target.value)
    if (!isNaN(v) && v > 0) {
      setDaily(v / periodMult[period])
    }
  }, [period])

  // When period changes, convert the displayed value
  const handlePeriodChange = useCallback(e => {
    const next = e.target.value
    setPeriod(next)
    setInputStr((daily * periodMult[next]).toFixed(1))
  }, [daily])

  const factor = daily / baseDaily
  const peakMults = { Small: 0.7, Normal: 1.0, Large: 1.4 }
  const peakHours = { morning: [7, 8, 9, 10], afternoon: [16, 17, 18, 19] }

  function applyPeakMults(data) {
    const noMorning = !peakPills.includes('morning')
    const noEvening = !peakPills.includes('afternoon')
    if (noMorning && noEvening) return data.map(() => +data[0].toFixed(2))
    return data.map((v, i) => {
      if (noMorning && i < 12) return +data[0].toFixed(2)
      if (peakPills.includes('morning') && peakHours.morning.includes(i)) return +(v * peakMults[morningSize]).toFixed(2)
      if (noEvening && i >= 12) return +data[12].toFixed(2)
      if (peakPills.includes('afternoon') && peakHours.afternoon.includes(i)) return +(v * peakMults[afternoonSize]).toFixed(2)
      return v
    })
  }

  const wd = applyPeakMults(scale(wdBase, factor))
  const we = applyPeakMults(scale(weBase, factor))
  const wdPeak = Math.max(...wd)
  const wePeak = Math.max(...we)
  const wdTotal = wd.reduce((a, b) => a + b, 0)
  const weTotal = we.reduce((a, b) => a + b, 0)

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, color: '#333' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px 0', color: '#555' }}>Weekday</h2>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
            {wdTotal.toFixed(1)} kWh/day &middot; {wdPeak.toFixed(1)} kW peak
          </div>
          <div style={{ width: 420, height: 260 }}>
            <Bar ref={wdRef} data={mkData(wd, 'rgba(59,130,246,0.7)')} options={chartOpts} />
          </div>
        </div>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px 0', color: '#555' }}>Weekend</h2>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
            {weTotal.toFixed(1)} kWh/day &middot; {wePeak.toFixed(1)} kW peak
          </div>
          <div style={{ width: 420, height: 260 }}>
            <Bar ref={weRef} data={mkData(we, 'rgba(34,197,94,0.7)')} options={chartOpts} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 18 }}>
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
        {peakPills.includes('morning') && (
          <Pill onRemove={() => setPeakPills(prev => prev.filter(p => p !== 'morning'))}>
            <div ref={morningRef} style={{ position: 'relative', display: 'inline-flex', gap: 3 }}>
              <span onClick={() => setMorningOpen(!morningOpen)} style={{ cursor: 'pointer', fontWeight: 700 }}>
                {morningSize} <span style={{ fontSize: 9, color: '#888' }}>▾</span>
              </span>
              <span>morning peak</span>
              {morningOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 10,
                  background: '#fff', border: '1px solid #e5e5e5', borderRadius: 4,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.07)', padding: '2px 0',
                  minWidth: 60, marginTop: 3
                }}>
                  {['Small','Normal','Large'].map(s => (
                    <div key={s}
                      onClick={() => { setMorningSize(s); setMorningOpen(false) }}
                      style={{
                        padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                        background: s === morningSize ? '#f5f5f5' : 'transparent', color: '#444',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                      onMouseLeave={e => e.currentTarget.style.background = s === morningSize ? '#f5f5f5' : 'transparent'}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Pill>
        )}
        {peakPills.includes('afternoon') && (
          <Pill onRemove={() => setPeakPills(prev => prev.filter(p => p !== 'afternoon'))}>
            <div ref={afternoonRef} style={{ position: 'relative', display: 'inline-flex', gap: 3 }}>
              <span onClick={() => setAfternoonOpen(!afternoonOpen)} style={{ cursor: 'pointer', fontWeight: 700 }}>
                {afternoonSize} <span style={{ fontSize: 9, color: '#888' }}>▾</span>
              </span>
              <span>evening peak</span>
              {afternoonOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 10,
                  background: '#fff', border: '1px solid #e5e5e5', borderRadius: 4,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.07)', padding: '2px 0',
                  minWidth: 60, marginTop: 3
                }}>
                  {['Small','Normal','Large'].map(s => (
                    <div key={s}
                      onClick={() => { setAfternoonSize(s); setAfternoonOpen(false) }}
                      style={{
                        padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                        background: s === afternoonSize ? '#f5f5f5' : 'transparent', color: '#444',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                      onMouseLeave={e => e.currentTarget.style.background = s === afternoonSize ? '#f5f5f5' : 'transparent'}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Pill>
        )}
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
              {!peakPills.includes('morning') && (
                <div
                  onClick={() => { setPeakPills(prev => [...prev, 'morning']); setAddOpen(false) }}
                  style={{
                    padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#444',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  morning peak
                </div>
              )}
              {!peakPills.includes('afternoon') && (
                <div
                  onClick={() => { setPeakPills(prev => [...prev, 'afternoon']); setAddOpen(false) }}
                  style={{
                    padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#444',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  evening peak
                </div>
              )}
              {peakPills.includes('morning') && peakPills.includes('afternoon') && (
                <div style={{ padding: '6px 12px', fontSize: 12, color: '#999' }}>
                  all peaks shown
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {extraProfiles.map(p => {
        const pd = scale(wdBase, factor)
        return (
          <div key={p.id} style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 18 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px 0', color: '#555' }}>{p.label}</h2>
              <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
                {pd.reduce((a, b) => a + b, 0).toFixed(1)} kWh/day &middot; {Math.max(...pd).toFixed(1)} kW peak
              </div>
              <div style={{ width: 420, height: 260 }}>
                <Bar data={mkData(pd, p.color)} options={chartOpts} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
