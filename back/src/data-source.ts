import "reflect-metadata"
import * as path from "path"
import * as dotenv from "dotenv"
import { DataSource } from "typeorm"

export type DbProfile = "local" | "supabase"

/**
 * Perfil de base de datos. Orden de prioridad:
 *  1. variable de entorno DB_PROFILE
 *  2. primer argumento de linea de comandos (local | supabase)
 *  3. "local" por defecto
 */
export function resolveProfile(): DbProfile {
    const fromArg = process.argv.slice(2).find((a) => a === "local" || a === "supabase")
    const raw = process.env.DB_PROFILE || fromArg || "local"
    if (raw !== "local" && raw !== "supabase") {
        throw new Error(`DB_PROFILE invalido: "${raw}". Usa "local" o "supabase".`)
    }
    return raw
}

export function loadProfileEnv(profile: DbProfile): Record<string, string> {
    const file = path.resolve(__dirname, "..", `.env.${profile}`)
    const result = dotenv.config({ path: file, processEnv: {} as any })
    if (result.error) {
        throw new Error(`No se pudo leer ${file}. Crealo a partir de .env.example.`)
    }
    return (result.parsed || {}) as Record<string, string>
}

/** Crea un DataSource para un perfil. El esquema se gestiona con `ensureSchema` (src/schema.ts). */
export function createDataSource(profile: DbProfile, opts: { synchronize?: boolean } = {}) {
    const env = loadProfileEnv(profile)
    if (!env.DB_PASSWORD) {
        throw new Error(`Falta DB_PASSWORD en .env.${profile}`)
    }
    const ssl = env.DB_SSL === "true"
    return new DataSource({
        type: "postgres",
        host: env.DB_HOST || "localhost",
        port: Number(env.DB_PORT || 5432),
        username: env.DB_USER || "postgres",
        password: env.DB_PASSWORD,
        database: env.DB_NAME || "campos_db",
        ssl: ssl ? { rejectUnauthorized: false } : false,
        synchronize: opts.synchronize ?? false,
        logging: ["error", "warn"],
        entities: [__dirname + "/entity/*.ts"],
        migrations: [],
        subscribers: [],
    })
}

export const DB_PROFILE = resolveProfile()
const envPort = loadProfileEnv(DB_PROFILE).PORT
if (envPort && !process.env.PORT) process.env.PORT = envPort

export const AppDataSource = createDataSource(DB_PROFILE)
export default AppDataSource
