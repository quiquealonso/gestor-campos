/**
 * Copia los datos de una BBDD a otra (campo -> pago/cheque), conservando los ids.
 *
 *   npm run migrate:local-to-supabase
 *   npm run migrate:supabase-to-local
 *
 * Opciones (tras `--`):
 *   --dry-run   solo cuenta filas, no escribe nada
 *   --replace   VACIA las tablas destino antes de copiar (sin esto, aborta si el destino tiene datos)
 */
import "reflect-metadata"
import { createDataSource, DbProfile } from "./data-source"
import { ensureSchema } from "./schema"

const TABLES = ["categoria", "campo", "pago", "cheque"] // orden por dependencias (FK)

async function main() {
    const args = process.argv.slice(2)
    const from = args.find((a) => a.startsWith("--from="))?.split("=")[1] as DbProfile
    const to = args.find((a) => a.startsWith("--to="))?.split("=")[1] as DbProfile
    const dryRun = args.includes("--dry-run")
    const replace = args.includes("--replace")

    if (!from || !to || from === to) {
        throw new Error("Uso: --from=local|supabase --to=supabase|local")
    }

    const src = createDataSource(from, { synchronize: false })
    const dst = createDataSource(to)
    await src.initialize()
    await dst.initialize()
    // En Supabase el esquema lo crea supabase/schema.sql (TypeORM no debe tocarlo: borraría sus CHECK)
    if (!dryRun) await ensureSchema(dst, { synchronize: to === "local", seed: false })
    console.log(`Origen: ${from}  ->  Destino: ${to}${dryRun ? "  (dry-run)" : ""}`)

    try {
        const rows: Record<string, any[]> = {}
        for (const t of TABLES) {
            const existe = (await src.query(`SELECT to_regclass(current_schema() || '.${t}') AS t`))[0].t
            rows[t] = existe ? await src.query(`SELECT * FROM "${t}" ORDER BY id`) : []
            let destCount = 0
            try { destCount = Number((await dst.query(`SELECT count(*) FROM "${t}"`))[0].count) } catch { /* tabla aun no existe */ }
            console.log(`  ${t}: origen=${rows[t].length}  destino=${destCount}`)
            if (!dryRun && destCount > 0 && !replace && (t !== "categoria" || rows[t].length > 0)) {
                throw new Error(`El destino ya tiene datos en "${t}". Usa --replace para vaciarlo primero.`)
            }
        }
        if (dryRun) return

        await dst.transaction(async (m) => {
            if (replace) await m.query(`TRUNCATE "cheque", "pago", "campo", "categoria" RESTART IDENTITY CASCADE`)
            for (const t of TABLES) {
                if (!rows[t].length) continue
                for (const r of rows[t]) {
                    const cols = Object.keys(r)
                    const sql = `INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})`
                    await m.query(sql, cols.map((c) => r[c]))
                }
                // reajusta la secuencia del id para que los siguientes inserts no choquen
                await m.query(`SELECT setval(pg_get_serial_sequence('"${t}"','id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1), (SELECT COUNT(*) > 0 FROM "${t}"))`)
            }
        })

        // Crea categorias por defecto y clasifica los pagos sin categoria
        await ensureSchema(dst, { synchronize: to === "local" })

        console.log("Verificacion:")
        for (const t of TABLES) {
            const n = Number((await dst.query(`SELECT count(*) FROM "${t}"`))[0].count)
            console.log(`  ${t}: ${n} ${t === "categoria" || n === rows[t].length ? "OK" : "<-- NO COINCIDE"}`)
        }
        console.log("Migracion completada.")
    } finally {
        await src.destroy()
        await dst.destroy()
    }
}

main().catch((e) => { console.error("Error:", e.message || e); process.exit(1) })
