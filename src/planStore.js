import { tableFromIPC } from 'apache-arrow'

let listeners = []
let table = null
let rowCount = 0

export function getRow(rowIdx) {
  if (!table) return null
  const row = {}
  for (const col of table.schema.fields) {
    const vec = table.getChild(col.name)
    if (vec) row[col.name] = vec.get(rowIdx)
  }
  return row
}

export function getRowCount() {
  return rowCount
}

export function setArrowIPC(arrowIPC) {
  try {
    if (!arrowIPC) {
      table = null; rowCount = 0
      listeners.forEach(fn => fn(0))
      return
    }
    table = tableFromIPC(arrowIPC)
    rowCount = table.numRows
    listeners.forEach(fn => fn(rowCount))
  } catch (e) {
    console.error('setArrowIPC:', e)
    table = null; rowCount = 0
    listeners.forEach(fn => fn(0))
  }
}

export function subscribe(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter(l => l !== fn)
  }
}
