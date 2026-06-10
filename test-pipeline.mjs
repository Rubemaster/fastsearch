// Test the full Parquet → Arrow pipeline locally
// Usage: node test-pipeline.mjs <postcode>
// Server at localhost:8080 must be running

import { readFileSync, writeFileSync } from 'fs'

const pc = process.argv[2] || '2000'
const serverUrl = process.env.API_URL || 'http://localhost:8080'

async function run() {
  // 1. Fetch Parquet binary
  const url = `${serverUrl}/api/parquet/raw/${pc}/plans`
  console.log(`Fetching: ${url}`)
  const r = await fetch(url)
  if (!r.ok) { console.error(`Fetch failed: ${r.status}`); process.exit(1) }
  const buf = await r.arrayBuffer()
  console.log(`Parquet bytes: ${buf.byteLength}`)

  // Save raw Parquet for inspection
  writeFileSync('/tmp/test_plans.parquet', Buffer.from(buf))
  console.log('Saved to /tmp/test_plans.parquet')

  // 2. Initialize parquet-wasm
  let readParquet
  try {
    // Try bundler entry first
    const pw = await import('parquet-wasm/bundler')
    readParquet = pw.readParquet
    console.log('Using bundler entry')
  } catch (e) {
    // Fall back to ESM with init
    console.log('Bundler failed, trying ESM:', e.message)
    const pw = await import('parquet-wasm/esm')
    await pw.default()
    readParquet = pw.readParquet
    console.log('Using ESM entry with init()')
  }

  // 3. Decode Parquet → Arrow IPC
  console.log('\n--- readParquet ---')
  const arrowIPC = readParquet(new Uint8Array(buf))
  console.log(`arrowIPC type: ${arrowIPC.constructor?.name}`)
  console.log(`arrowIPC byteLength: ${arrowIPC.byteLength}`)
  console.log(`arrowIPC length: ${arrowIPC.length}`)

  // Save IPC output
  writeFileSync('/tmp/test_plans.ipc', Buffer.from(arrowIPC))
  console.log('Saved IPC to /tmp/test_plans.ipc')

  // 4. Parse Arrow IPC → Table (try different methods)
  console.log('\n--- Arrow parsing ---')
  const arrow = await import('apache-arrow')

  // Method A: ByteStream + RecordBatchStreamReader
  try {
    const bs = new arrow.ByteStream(arrowIPC)
    const reader = new arrow.RecordBatchStreamReader(bs)
    const table = new arrow.Table([...reader])
    console.log(`\nMethod A (ByteStream + StreamReader):`)
    console.log(`  rows: ${table.numRows}`)
    console.log(`  cols: ${table.schema.fields.map(f => f.name).join(', ')}`)
    if (table.numRows > 0) {
      const row = {}
      for (const col of table.schema.fields) {
        row[col.name] = table.getChild(col.name)?.get(0)
      }
      console.log(`  sample row 0:`, JSON.stringify(row).slice(0, 200))
    }
  } catch (e) {
    console.log('\nMethod A failed:', e.message)
  }

  // Method B: RecordBatchReader.from
  try {
    const reader = arrow.RecordBatchReader.from(arrowIPC)
    const table = new arrow.Table([...reader])
    console.log(`\nMethod B (RecordBatchReader.from):`)
    console.log(`  rows: ${table.numRows}`)
    console.log(`  cols: ${table.schema.fields.map(f => f.name).join(', ')}`)
  } catch (e) {
    console.log('\nMethod B failed:', e.message)
  }

  // Method C: tableFromIPC
  try {
    if (arrow.tableFromIPC) {
      const table = arrow.tableFromIPC(arrowIPC)
      console.log(`\nMethod C (tableFromIPC):`)
      console.log(`  rows: ${table.numRows}`)
      console.log(`  cols: ${table.schema.fields.map(f => f.name).join(', ')}`)
    } else {
      console.log('\nMethod C (tableFromIPC): not available')
    }
  } catch (e) {
    console.log('\nMethod C failed:', e.message)
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
