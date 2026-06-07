/**
 * Medidor de migraciones: compara las migraciones LOCALES (supabase/migrations)
 * con las APLICADAS en la base (supabase_migrations.schema_migrations).
 *
 * Sirve para local y para Supabase CLOUD: apunta SUPABASE_DB_URL a la base
 * destino (la del dashboard de Supabase) y verás qué falta aplicar antes/después
 * de `supabase db push`.
 *
 * Uso:
 *   bun run scripts/migration-status.ts
 *   SUPABASE_DB_URL="postgresql://postgres:[pass]@db.<ref>.supabase.co:5432/postgres" bun run scripts/migration-status.ts
 *
 * Sale con código 1 si hay migraciones pendientes (útil para CI / pre-deploy).
 */
import { SQL } from 'bun'
import { readdir } from 'node:fs/promises'

const url =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
const db = new SQL(url)

// Migraciones aplicadas (la CLI de Supabase las registra aquí).
let applied: Array<{ version: string; name: string | null }> = []
try {
  applied =
    await db`select version, name from supabase_migrations.schema_migrations order by version`
} catch (e) {
  console.error('No pude leer supabase_migrations.schema_migrations:', e instanceof Error ? e.message : e)
  console.error('¿La base está accesible y es de Supabase? Revisa SUPABASE_DB_URL.')
  await db.end()
  process.exit(2)
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

console.log(`\n  Destino: ${url.replace(/:[^:@/]+@/, ':****@')}`)
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

await db.end()
process.exit(pendientes.length ? 1 : 0)
