import "reflect-metadata"
import { AppDataSource, DB_PROFILE } from "./data-source"
import { ensureSchema } from "./schema"

async function synchronizeDatabase() {
    try {
        console.log(`Conectando a la base de datos (perfil: ${DB_PROFILE})...`)
        await AppDataSource.initialize()
        await ensureSchema(AppDataSource, { synchronize: true })
        console.log("Esquema sincronizado: Campo, Pago, Cheque, Categoria (+ categorias por defecto)")
        await AppDataSource.destroy()
        process.exit(0)
    } catch (error) {
        console.error("Error al sincronizar la base de datos:")
        console.error(error)
        process.exit(1)
    }
}

synchronizeDatabase()
