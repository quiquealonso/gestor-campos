import { DataSource } from "typeorm"

/**
 * Prepara el esquema de forma SEGURA (idempotente y sin perder datos):
 *  1. Convierte los importes de `float` a `numeric` con ALTER ... USING (TypeORM, por su cuenta,
 *     borraria y recrearia la columna).
 *  2. Si `synchronize`, crea/actualiza tablas y columnas nuevas (categoria, pago.categoriaId...).
 *  3. Si `seed`, crea las categorias por defecto y clasifica los pagos que aun no tienen categoria.
 */

const CONVERSIONES: Array<[string, string, string, number]> = [
    ["campo", "tamano", "numeric(12,4)", 4],
    ["pago", "coste", "numeric(12,2)", 2],
    ["cheque", "cantidad", "numeric(12,2)", 2],
]

export const CATEGORIAS_POR_DEFECTO: Array<{ nombre: string; color: string; palabras: string[] }> = [
    { nombre: "Semillas y plantas", color: "#3fb950", palabras: ["semilla", "planta", "planton", "injerto", "esqueje", "simiente", "vivero"] },
    { nombre: "Abonos y fitosanitarios", color: "#d29922", palabras: ["abono", "fertiliz", "nitrato", "herbicida", "fungicida", "insecticida", "fitosanit", "tratamiento", "azufre", "cobre", "purin", "estiercol", "producto"] },
    { nombre: "Combustible", color: "#f0883e", palabras: ["gasoil", "gasoleo", "diesel", "combustible", "gasolina", "carburante"] },
    { nombre: "Maquinaria y mantenimiento", color: "#a371f7", palabras: ["tractor", "maquinaria", "reparac", "mantenim", "recambio", "aceite", "neumatic", "rueda", "cosechadora", "apero", "taller", "motocultor", "desbrozadora"] },
    { nombre: "Mano de obra", color: "#58a6ff", palabras: ["jornal", "mano de obra", "peon", "trabajador", "nomina", "sueldo", "salario", "recolec", "poda", "cosecha", "vendimia", "recogida", "personal", "cuadrilla"] },
    { nombre: "Riego y agua", color: "#39c5cf", palabras: ["riego", "agua", "goteo", "bomba", "acequia", "regante", "pozo", "tuberia", "electricidad", "luz"] },
    { nombre: "Seguros e impuestos", color: "#ff7b72", palabras: ["seguro", "ibi", "impuesto", "tasa", "contribucion", "seguridad social", "autonomo", "gestoria", "asesor", "cuota"] },
    { nombre: "Arrendamiento", color: "#db61a2", palabras: ["alquiler", "arrendamiento", "renta", "arriendo"] },
    { nombre: "Sin categoría", color: "#8b949e", palabras: [] },
]

const normalizar = (t: string) =>
    (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

export function categoriaParaTexto(texto: string): string {
    const t = normalizar(texto)
    for (const cat of CATEGORIAS_POR_DEFECTO) {
        if (cat.palabras.some((p) => t.includes(p))) return cat.nombre
    }
    return "Sin categoría"
}

async function existeColumna(ds: DataSource, tabla: string, columna: string) {
    const r = await ds.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
        [tabla, columna]
    )
    return r.length > 0
}

export async function ensureSchema(
    ds: DataSource,
    opts: { synchronize: boolean; seed?: boolean } = { synchronize: false }
) {
    for (const [tabla, columna, tipo, escala] of CONVERSIONES) {
        const r = await ds.query(
            `SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
            [tabla, columna]
        )
        if (r[0] && r[0].data_type === "double precision") {
            console.log(`Convirtiendo ${tabla}.${columna} a ${tipo}...`)
            await ds.query(`ALTER TABLE "${tabla}" ALTER COLUMN "${columna}" TYPE ${tipo} USING ROUND("${columna}"::numeric, ${escala})`)
        }
    }

    if (opts.synchronize) {
        await ds.synchronize()
    }

    if (opts.seed === false) return
    const tabla = await ds.query(`SELECT to_regclass(current_schema() || '.categoria') AS t`)
    if (!tabla[0]?.t || !(await existeColumna(ds, "pago", "categoriaId"))) return

    for (const cat of CATEGORIAS_POR_DEFECTO) {
        await ds.query(`INSERT INTO "categoria" ("nombre","color") VALUES ($1,$2) ON CONFLICT ("nombre") DO NOTHING`, [cat.nombre, cat.color])
    }

    const ids: Record<string, number> = {}
    for (const c of await ds.query(`SELECT id, nombre FROM "categoria"`)) ids[c.nombre] = c.id

    const pendientes = await ds.query(`SELECT id, nombre, descripcion FROM "pago" WHERE "categoriaId" IS NULL`)
    for (const p of pendientes) {
        const nombre = categoriaParaTexto(`${p.nombre} ${p.descripcion}`)
        await ds.query(`UPDATE "pago" SET "categoriaId" = $1 WHERE id = $2`, [ids[nombre], p.id])
    }
    if (pendientes.length) console.log(`Categorizados automaticamente ${pendientes.length} pago(s).`)
}
