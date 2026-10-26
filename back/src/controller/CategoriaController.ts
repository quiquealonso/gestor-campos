import { NextFunction, Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { Categoria } from "../entity/Categoria"
import { Pago } from "../entity/Pago"
import { idParam, responderError, validarCategoria, ValidationError } from "../utils/validate"

export class CategoriaController {
    private repo = AppDataSource.getRepository(Categoria)

    async all(request: Request, response: Response, next: NextFunction) {
        try {
            const categorias = await this.repo.find({ order: { nombre: "ASC" } })
            response.status(200).json({ message: "Categorías obtenidas", object: categorias })
        } catch (error) {
            responderError(response, error)
        }
    }

    async save(request: Request, response: Response, next: NextFunction) {
        try {
            const datos = validarCategoria(request.body)
            const categoria = await this.repo.save(this.repo.create(datos))
            response.status(200).json({ message: "Categoría creada", object: categoria })
        } catch (error) {
            responderError(response, error)
        }
    }

    async update(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const datos = validarCategoria(request.body)
            const categoria = await this.repo.findOneBy({ id })
            if (!categoria) {
                response.status(404).json({ message: "Categoría no encontrada", object: null })
                return
            }
            Object.assign(categoria, datos.color ? datos : { nombre: datos.nombre })
            response.status(200).json({ message: "Categoría actualizada", object: await this.repo.save(categoria) })
        } catch (error) {
            responderError(response, error)
        }
    }

    /**
     * DELETE /categorias/:id?accion=sin|mover|eliminar&destino=<id>
     *  - sin (por defecto): sus pagos pasan a «Sin categoría»
     *  - mover: sus pagos pasan a la categoría `destino`
     *  - eliminar: se eliminan también sus pagos
     */
    async remove(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const accion = String(request.query.accion || "sin")
            if (!["sin", "mover", "eliminar"].includes(accion)) {
                throw new ValidationError("Acción no válida (sin, mover o eliminar).")
            }

            const categoria = await this.repo.findOneBy({ id })
            if (!categoria) {
                response.status(404).json({ message: "Categoría no encontrada", object: null })
                return
            }
            if (categoria.nombre === "Sin categoría") {
                throw new ValidationError("La categoría «Sin categoría» no se puede eliminar.")
            }

            let destino: Categoria | null = null
            if (accion === "mover") {
                const destinoId = idParam(request.query.destino, "La categoría de destino")
                if (destinoId === id) throw new ValidationError("La categoría de destino debe ser distinta.")
                destino = await this.repo.findOneBy({ id: destinoId })
                if (!destino) throw new ValidationError("La categoría de destino no existe.")
            } else if (accion === "sin") {
                destino = await this.repo.findOneBy({ nombre: "Sin categoría" })
            }

            const afectados = await AppDataSource.transaction(async (m) => {
                let n = 0
                if (accion === "eliminar") {
                    const r = await m.createQueryBuilder().delete().from(Pago).where(`"categoriaId" = :id`, { id }).execute()
                    n = r.affected || 0
                } else if (destino) {
                    const r = await m
                        .createQueryBuilder()
                        .update(Pago)
                        .set({ categoria: { id: destino.id } as Categoria })
                        .where(`"categoriaId" = :id`, { id })
                        .execute()
                    n = r.affected || 0
                }
                await m.getRepository(Categoria).delete({ id })
                return n
            })

            response.status(200).json({
                message: "Categoría eliminada",
                object: { ...categoria, pagosAfectados: afectados, accion },
            })
        } catch (error) {
            responderError(response, error)
        }
    }
}
