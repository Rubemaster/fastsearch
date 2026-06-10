import postcodes from './data.json'
import { readParquet } from 'parquet-wasm/bundler'
import { setArrowIPC } from './planStore'

const input = document.getElementById('postcode-input')
const suggestionsEl = document.getElementById('suggestions')
const timingEl = document.getElementById('timing')
const resultsEl = document.getElementById('results')

const API = import.meta.env.VITE_API_URL || '/api'

const TABLES = ['plans', 'retailers', 'contracts', 'tariffs', 'single_rates',
  'rate_tiers', 'tou_rates', 'tou_windows', 'demand_charges', 'discounts']

function modePrefix() {
  const m = document.querySelector('input[name=mode]:checked')
  return m && m.value === 'direct' ? '/direct' : ''
}

function endpoint(pc, t) {
  return API + '/parquet' + modePrefix() + '/raw/' + pc + '/' + t
}

function matchPostcodes(q) {
  if (!q || !/^\d+$/.test(q)) return []
  const hits = []
  for (let i = 0; i < postcodes.length; i++) {
    if (postcodes[i][1].startsWith(q)) hits.push(postcodes[i])
    if (hits.length >= 3) break
  }
  return hits
}

function rowHtml(t, cnt, kb, acq, exe, cvt, elapsed) {
  return (
    '<td style="padding:2px 10px 2px 0">' + t + '</td>' +
    '<td style="padding:2px 10px;text-align:right">' + cnt + '</td>' +
    '<td style="padding:2px 10px;text-align:right">' + kb + '</td>' +
    '<td style="padding:2px 10px;text-align:right">' + acq + '</td>' +
    '<td style="padding:2px 10px;text-align:right">' + exe + '</td>' +
    '<td style="padding:2px 0 2px 10px;text-align:right">' + cvt + '</td>' +
    '<td style="padding:2px 0 2px 8px;text-align:center">' + elapsed + '</td>'
  )
}

function btnHtml(t) {
  return '<td style="padding:2px 0 2px 5px"><span style="cursor:pointer;color:#666;font-size:11px" data-rerun="' + t + '">\u21bb</span></td>'
}

async function loadAllData(pc) {
  suggestionsEl.innerHTML = ''
  resultsEl.textContent = ''
  timingEl.innerHTML = ''
  const headerEl = document.createElement('div')
  headerEl.style.cssText = 'margin-bottom:8px;font-weight:600'
  headerEl.textContent = 'Burst loading...'
  timingEl.appendChild(headerEl)

  const tStart = performance.now()
  try {
    const r = await fetch(API + '/parquet/raw-all/' + pc)
    if (!r.ok) throw new Error(String(r.status))
    const buf = await r.arrayBuffer()
    const data = new Uint8Array(buf)
    let pos = 0
    let totalKb = 0
    let totalRows = 0
    const rows = []

    while (pos < data.length) {
      if (data.length - pos < 4) break
      const hdrLen = (data[pos] << 24) | (data[pos+1] << 16) | (data[pos+2] << 8) | data[pos+3]
      pos += 4
      if (data.length - pos < hdrLen) break
      const hdr = JSON.parse(new TextDecoder().decode(data.slice(pos, pos + hdrLen)))
      pos += hdrLen
      const body = data.slice(pos, pos + hdr['s'])
      pos += hdr['s']
      totalKb += hdr['s']
      totalRows += hdr['r']
      rows.push(hdr)
    }

    const elapsed = ((performance.now() - tStart) / 1000).toFixed(2)
    timingEl.innerHTML = ''
    const h2 = document.createElement('div')
    h2.style.cssText = 'margin-bottom:8px;font-weight:600'
    h2.textContent = 'Burst: ' + rows.length + ' tables, ' + (totalKb / 1024).toFixed(0) + ' KB, ' + totalRows + ' rows in ' + elapsed + 's'
    timingEl.appendChild(h2)

    const tableEl = document.createElement('table')
    tableEl.style.cssText = 'font-size:12px;border-collapse:collapse;width:100%'
    tableEl.innerHTML = '<tr style="border-bottom:1px solid #ccc;font-weight:600">' +
      '<td style="padding:3px 10px 3px 0">Table</td>' +
      '<td style="padding:3px 10px;text-align:right">Rows</td>' +
      '<td style="padding:3px 10px;text-align:right">KB</td>' +
      '<td style="padding:3px 0 3px 10px;text-align:right">Time</td></tr>'

    for (const h of rows) {
      const tr = document.createElement('tr')
      tr.style.cssText = 'border-bottom:1px solid #eee'
      tr.innerHTML = '<td style="padding:2px 10px 2px 0">' + h['t'] + '</td>' +
        '<td style="padding:2px 10px;text-align:right">' + h['r'] + '</td>' +
        '<td style="padding:2px 10px;text-align:right">' + (h['s'] / 1024).toFixed(1) + '</td>' +
        '<td style="padding:2px 0 2px 10px;text-align:right">' + h['m'] + 'ms</td>'
      tableEl.appendChild(tr)
    }
    timingEl.appendChild(tableEl)
  } catch (e) {
    timingEl.textContent = 'Error: ' + e.message
  }
}

async function loadRawData(pc) {
  suggestionsEl.innerHTML = ''
  resultsEl.textContent = ''

  timingEl.innerHTML = ''
  const headerEl = document.createElement('div')
  headerEl.style.cssText = 'margin-bottom:8px;font-weight:600'
  headerEl.textContent = 'Fetching\u2026'
  timingEl.appendChild(headerEl)

  const tableEl = document.createElement('table')
  tableEl.style.cssText = 'font-size:12px;border-collapse:collapse;width:100%'
  tableEl.innerHTML =
    '<tr style="border-bottom:1px solid #ccc;font-weight:600">' +
    '<td style="padding:3px 10px 3px 0">Table</td>' +
    '<td style="padding:3px 10px;text-align:right">Rows</td>' +
    '<td style="padding:3px 10px;text-align:right">KB</td>' +
    '<td style="padding:3px 10px;text-align:right">Acq</td>' +
    '<td style="padding:3px 10px;text-align:right">Exec</td>' +
    '<td style="padding:3px 0 3px 10px;text-align:right">Cvt</td>' +
    '<td style="padding:3px 0 3px 8px;text-align:center">\u23f1</td>' +
    '<td style="padding:3px 0 3px 5px"></td></tr>'
  timingEl.appendChild(tableEl)

  const rowEls = {}
  for (const t of TABLES) {
    const tr = document.createElement('tr')
    tr.style.cssText = 'border-bottom:1px solid #eee;opacity:0'
    tr.innerHTML =
      '<td style="padding:2px 10px 2px 0">' + t + '</td>' +
      '<td style="padding:2px 10px;text-align:right">\u2014</td>' +
      '<td style="padding:2px 10px;text-align:right">\u2014</td>' +
      '<td style="padding:2px 10px;text-align:right">\u2014</td>' +
      '<td style="padding:2px 10px;text-align:right">\u2014</td>' +
      '<td style="padding:2px 0 2px 10px;text-align:right">\u2014</td>' +
      '<td style="padding:2px 0 2px 8px;text-align:center">\u22ef</td>' +
      '<td style="padding:2px 0 2px 5px"></td>'
    tableEl.appendChild(tr)
    rowEls[t] = tr
  }

  let curPc = pc
  let totalKb = 0
  let completed = 0

  async function refetchRow(t) {
    headerEl.textContent = 'Rerunning ' + t + '\u2026'
    const tr = rowEls[t]
    tr.style.opacity = '0.4'
    const tStart = performance.now()
    try {
      const r = await fetch(endpoint(curPc, t))
      if (!r.ok) throw new Error(String(r.status))
      const buf = await r.arrayBuffer()
      const elapsed = (performance.now() - tStart).toFixed(0) + 'ms'
      const acq = r.headers.get('X-Acq-Ms') || '?'
      const exe = r.headers.get('X-Exec-Ms') || '?'
      const cvt = r.headers.get('X-Convert-Ms') || '?'
      const cnt = r.headers.get('X-Row-Count') || '?'
      const kb = (buf.byteLength / 1024).toFixed(1)
      tr.innerHTML = rowHtml(t, cnt, kb, acq + 'ms', exe + 'ms', cvt + 'ms', elapsed) + btnHtml(t)
      tr.style.opacity = '1'
      headerEl.textContent = 'Fetched ' + (totalKb / 1024).toFixed(0) + ' KB (all 10/10)'
    } catch (e) {
      tr.innerHTML = '<td style="padding:2px 10px 2px 0">' + t + '</td><td colspan="7" style="padding:2px 10px;color:#c00">Error: ' + e.message + '</td>'
      tr.style.opacity = '1'
    }
  }

  function processNext() {
    while (active < 3 && queue.length) {
      const { t } = queue.shift()
      active++
      fetchRow(t).finally(() => { active--; processNext() })
    }
  }

  const queue = TABLES.map(t => ({ t }))
  let active = 0

  async function fetchRow(t) {
    const tFetch = performance.now()
    try {
      const r = await fetch(endpoint(curPc, t))
      if (!r.ok) throw new Error(String(r.status))
      const buf = await r.arrayBuffer()
      const elapsed = (performance.now() - tFetch).toFixed(0) + 'ms'
      const acq = r.headers.get('X-Acq-Ms') || '?'
      const exe = r.headers.get('X-Exec-Ms') || '?'
      const cvt = r.headers.get('X-Convert-Ms') || '?'
      const cnt = r.headers.get('X-Row-Count') || '?'
      const kb = (buf.byteLength / 1024).toFixed(1)
      completed++
      totalKb += buf.byteLength
      const tr = rowEls[t]
      tr.style.opacity = '1'
      tr.innerHTML = rowHtml(t, cnt, kb, acq + 'ms', exe + 'ms', cvt + 'ms', elapsed) + btnHtml(t)
      headerEl.textContent = 'Fetched ' + (totalKb / 1024).toFixed(0) + ' KB (' + completed + '/' + TABLES.length + ')'
    } catch (e) {
      completed++
      const tr = rowEls[t]
      tr.style.opacity = '1'
      tr.innerHTML = '<td style="padding:2px 10px 2px 0">' + t + '</td><td colspan="7" style="padding:2px 10px;color:#c00">Error: ' + e.message + '</td>' + btnHtml(t)
      headerEl.textContent = 'Fetched (' + completed + '/' + TABLES.length + ') \u2014 error: ' + t
    }
  }

  processNext()

  timingEl.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-rerun]')
    if (btn) refetchRow(btn.getAttribute('data-rerun'))
  })
}

async function loadPlans(pc) {
  setArrowIPC(null)
  try {
    const r = await fetch(endpoint(pc, 'plans'))
    if (!r.ok) throw new Error(String(r.status))
    const buf = await r.arrayBuffer()
    const wasmTable = readParquet(new Uint8Array(buf))
    const arrowIPC = wasmTable.intoIPCStream()
    setArrowIPC(arrowIPC)
  } catch (e) {
    console.error('loadPlans:', e)
    setArrowIPC(null)
  }
}

let prevQ = ''

input.addEventListener('input', () => {
  const q = input.value.trim()
  if (/^\d{4}$/.test(q) && q !== prevQ) {
    prevQ = q; loadRawData(q); loadPlans(q); return
  }
  const hits = matchPostcodes(q)
  suggestionsEl.innerHTML = hits.length
    ? hits.map(h => '<span data-pc="' + h[1] + '">' + h[0] + ' \u00b7 ' + h[1] + ' \u00b7 ' + h[2] + '</span>').join(' &nbsp;|&nbsp; ')
    : ''
  if (!/^\d{4}$/.test(q)) prevQ = ''
})

// Enter key also fires burst load
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = input.value.trim()
    if (/^\d{4}$/.test(q)) { loadAllData(q); loadPlans(q) }
  }
})

suggestionsEl.addEventListener('click', e => {
  const s = e.target.closest('[data-pc]')
  if (!s) return; input.value = s.dataset.pc; loadRawData(s.dataset.pc); loadPlans(s.dataset.pc)
})

// React virtual list mount
import React from 'react'
import { createRoot } from 'react-dom/client'
import VirtualList from './VirtualList.jsx'

const mountEl = document.getElementById('results-mount')
if (mountEl) {
  createRoot(mountEl).render(React.createElement(VirtualList))
}
