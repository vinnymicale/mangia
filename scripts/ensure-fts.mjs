
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'

const url = process.env.DATABASE_URL ?? 'file:/data/mangia.db'
const path = url.replace(/^file:/, '')
const db = new Database(path)
db.pragma('journal_mode = WAL')
db.exec(readFileSync('./prisma/migrations/manual/fts.sql', 'utf8'))
db.close()
console.log('FTS schema ready.')
