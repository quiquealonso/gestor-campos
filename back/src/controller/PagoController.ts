import { NextFunction, Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { Pago } from "../entity/Pago"
import { Campo } from "../entity/Campo"
import { Categoria } from "../entity/Categoria"
import { idParam, responderError, validarPago, ValidationError } from "../utils/validate"

const RELACIONES = { campo: true, categoria: true } as const

export class PagoController {
    private pagoRepository = AppDataSource.getRepository(Pago)
    private campoRepository = AppDataSource.getRepository(Campo)
    private categoriaRepository = AppDataSource.getRepository(Categoria)

    private async campoExistente(campoId: number | null): Promise<Campo> {
        if (!campoId) throw new ValidationError("El campo es obligatorio.")
        const campo = await this.campoRepository.findOneBy({ id: campoId })
        if (!campo) throw new ValidationError("El campo indicado no existe.")
        return campo
    }

    private async categoriaExistente(categoriaId: number | null): Promise<Categoria | null> {
        if (!categoriaId) return null
        const categoria = await this.categoriaRepository.findOneBy({ id: categoriaId })
        if (!categoria) throw new ValidationError("La categoría indicada no existe.")
        return categoria
    }

    async all(request: Request, response: Response, next: NextFunction) {
        try {
            const pagos = await this.pagoRepository.find({ relations: RELACIONES })
            response.status(200).json({ message: "Pagos obtenidos", object: pagos })
        } catch (error) {
            responderError(response, error)
        }
    }

    async byCampo(request: Request, response: Response, next: NextFunction) {
        try {
            const campoId = idParam(request.params.campoId, "El campo")
            const pagos = await this.pagoRepository.find({
                where: { campo: { id: campoId } },
                relations: RELACIONES,
                order: { fecha: "DESC" },
            })
            response.status(200).json({ message: "Pagos del campo obtenidos", object: pagos })
        } catch (error) {
            responderError(response, error)
        }
    }

    async one(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const pago = await this.pagoRepository.findOne({ where: { id }, relations: RELACIONES })
            if (!pago) {
                response.status(404).json({ message: "Pago no encontrado", object: null })
                return
            }
            response.status(200).json({ message: "Pago obtenido", object: pago })
        } catch (error) {
            responderError(response, error)
        }
    }

    async save(request: Request, response: Response, next: NextFunction) {
        try {
            const { campoId, categoriaId, ...datos } = validarPago(request.body)
            const campo = await this.campoExistente(campoId)
            const categoria = await this.categoriaExistente(categoriaId)
            const pago = await this.pagoRepository.save(this.pagoRepository.create({ ...datos, campo, categoria }))
            response.status(200).json({ message: "Pago guardado", object: pago })
        } catch (error) {
            responderError(response, error)
        }
    }

    async saveConjunto(request: Request, response: Response, next: NextFunction) {
        try {
            const { fecha, nombre, descripcion, coste, anio, categoriaId } = validarPago(request.body)
            const costeTotal = coste
            const categoria = await this.categoriaExistente(categoriaId)
            const campos = await this.campoRepository.find()
            if (!campos.length) {
                response.status(400).json({
                    message: "No hay campos para repartir el pago conjunto.",
                    object: null,
                })
                return
            }

            const pesos = campos.map((campo) => Math.max(0, Number(campo.tamano || 0)))
            const totalTerreno = pesos.reduce((acc, valor) => acc + valor, 0)

            if (!Number.isFinite(totalTerreno) || totalTerreno <= 0) {
                response.status(400).json({
                    message: "La suma total del terreno debe ser mayor que 0 para repartir el pago conjunto.",
                    object: null,
                })
                return
            }

            const totalCentimos = Math.round(costeTotal * 100)
            const repartoBase = campos.map((campo, index) => {
                const peso = pesos[index]
                const repartoExacto = totalCentimos * (peso / totalTerreno)
                const centimosBase = Math.floor(repartoExacto)
                return {
                    campo,
                    centimos: centimosBase,
                    resto: repartoExacto - centimosBase,
                }
            })

            // Reparte los centimos sobrantes segun la fraccion mas alta para no perder dinero en redondeos.
            let centimosAsignados = repartoBase.reduce((acc, item) => acc + item.centimos, 0)
            let centimosPendientes = totalCentimos - centimosAsignados
            repartoBase.sort((a, b) => b.resto - a.resto)

            for (let i = 0; i < repartoBase.length && centimosPendientes > 0; i += 1) {
                repartoBase[i].centimos += 1
                centimosPendientes -= 1
            }

            centimosAsignados = repartoBase.reduce((acc, item) => acc + item.centimos, 0)
            if (centimosAsignados !== totalCentimos) {
                response.status(500).json({
                    message: "No se pudo cuadrar el reparto del pago conjunto.",
                    object: null,
                })
                return
            }

            const pagosGuardados = await AppDataSource.transaction(async (manager) => {
                const repositorioPago = manager.getRepository(Pago)
                const nuevosPagos = repartoBase.map((item) =>
                    repositorioPago.create({
                        fecha,
                        nombre,
                        descripcion,
                        anio: anio ?? undefined,
                        categoria,
                        coste: item.centimos / 100,
                        campo: item.campo,
                    })
                )

                return repositorioPago.save(nuevosPagos)
            })

            response.status(200).json({
                message: "Pago conjunto repartido correctamente entre todos los campos.",
                object: {
                    totalTerreno,
                    costeTotal,
                    pagos: pagosGuardados,
                },
            })
        } catch (error) {
            responderError(response, error)
        }
    }

    async update(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const { campoId, categoriaId, ...datos } = validarPago(request.body)
            const pago = await this.pagoRepository.findOne({ where: { id }, relations: RELACIONES })
            if (!pago) {
                response.status(404).json({ message: "Pago no encontrado", object: null })
                return
            }
            if (campoId) pago.campo = await this.campoExistente(campoId)
            pago.categoria = await this.categoriaExistente(categoriaId)
            Object.assign(pago, datos)
            const pagoActualizado = await this.pagoRepository.save(pago)
            response.status(200).json({ message: "Pago actualizado", object: pagoActualizado })
        } catch (error) {
            responderError(response, error)
        }
    }

    async remove(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const pago = await this.pagoRepository.findOneBy({ id })
            if (!pago) {
                response.status(404).json({ message: "Pago no encontrado", object: null })
                return
            }
            await this.pagoRepository.remove(pago)
            response.status(200).json({ message: "Pago eliminado", object: pago })
        } catch (error) {
            responderError(response, error)
        }
    }
}
