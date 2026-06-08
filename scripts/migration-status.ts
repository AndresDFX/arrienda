/**
 * Medidor de migraciones: compara las migraciones LOCALES (supabase/migrations)
 * con las APLICADAS en la base (supabase_migrations.schema_migrations).
 *
 * Sirve para local y para Supabase CLOUD: apunta SUPABASE_DB_URL a la base
 * destino (la del dashboard de Supabase) y verás qué falta aplicar antes/después
 * de `supabase db push`.
 *
 * En LOCAL, si el puerto del DB no está publicado al host (config por defecto en
 * este repo: solo la API en 55321), cae a leer schema_migrations DENTRO del
 * contenedor de Postgres de Supabase vía `docker exec`.
 *
 * Uso:
 *   bun run scripts/migration-status.ts
 *   SUPABASE_DB_URL="postgresql://postgres:[pass]@db.<ref>.supabase.co:5432/postgres" bun run scripts/migration-status.ts
 *
 * Sale con código 1 si hay migraciones pendientes (útil para CI / pre-deploy).
 */
import { SQL } from 'bun'
import { readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

type Applied = { version: string; name: string | null }

const explicitUrl = process.env.SUPABASE_DB_URL
const url = explicitUrl ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'

const QUERY =
  "select version, name from supabase_migrations.schema_migrations order by version"

/** Lectura por conexión directa (host → Postgres). Cloud o local con puerto expuesto. */
async function readViaSql(): Promise<Applied[]> {
  const db = new SQL(url)
  try {
    return await db`select version, name from supabase_migrations.schema_migrations order by version`
  } finally {
    await db.end()
  }
}

/** Fallback local: ejecuta el query dentro del contenedor de Postgres de Supabase. */
function readViaDocker(): Applied[] {
  const container = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)[0]
  if (!container) throw new Error('no encontré un contenedor supabase_db en ejecución')
  const out = execFileSync(
    'docker',
    ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAF|', '-c', QUERY],
    { encoding: 'utf8' },
  )
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf('|')
      const version = i === -1 ? l : l.slice(0, i)
      const name = i === -1 ? null : l.slice(i + 1) || null
      return { version, name }
    })
}

// Migraciones aplicadas (la CLI de Supabase las registra aquí).
let applied: Applied[] = []
let via = 'conexión directa'
try {
  applied = await readViaSql()
} catch (eSql) {
  if (explicitUrl) {
    // URL explícita (cloud): no intentamos el fallback de docker.
    console.error('No pude leer schema_migrations:', eSql instanceof Error ? eSql.message : eSql)
    console.error('Revisa SUPABASE_DB_URL.')
    process.exit(2)
  }
  try {
    applied = readViaDocker()
    via = 'docker exec (puerto del DB local no publicado al host)'
  } catch (eDocker) {
    console.error('No pude leer schema_migrations ni por conexión directa ni por docker:')
    console.error('  directa:', eSql instanceof Error ? eSql.message : eSql)
    console.error('  docker :', eDocker instanceof Error ? eDocker.message : eDocker)
    process.exit(2)
  }
}
const appliedSet = new Set(applied.map((r) => r.version))

// Migraciones locales (archivos).
const files = (await readdir('supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
const local = files.map((f) => ({ version: f.split('_')[0] ?? f, name: f }))
const localSet = new Set(local.map((l) => l.version))

const pendientes = local.filter((l) => !appliedSet.has(l.version))
const huerfanas = applied.filter((a) => !localSet.has(a.version)) // aplicadas pero sin archivo

console.log(`\n  Destino: ${url.replace(/:[^:@/]+@/, ':****@')}  (${via})`)
console.log(`  Locales: ${local.length} · Aplicadas: ${applied.length}\n`)
for (const l of local) {
  console.log(`  ${appliedSet.has(l.version) ? '✓ aplicada ' : '✗ PENDIENTE'}  ${l.name}`)
}
if (huerfanas.length) {
  console.log('\n  ⚠ Aplicadas en la base pero sin archivo local:')
  for (const h of huerfanas) console.log(`    - ${h.version} ${h.name ?? ''}`)
}

if (pendientes.length) {
  console.log(`\n  ${pendientes.length} pendiente(s). Aplica con:  supabase db push   (o supabase migration up en local)`)
} else {
  console.log('\n  ✅ La base está al día con las migraciones locales.')
}

process.exit(pendientes.length ? 1 : 0)
