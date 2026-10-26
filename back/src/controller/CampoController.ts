import { NextFunction, Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { Campo } from "../entity/Campo"
import { Pago } from "../entity/Pago"
import { Cheque } from "../entity/Cheque"
import { idParam, responderError, validarCampo } from "../utils/validate"

export class CampoController {
    private campoRepository = AppDataSource.getRepository(Campo)

    async all(request: Request, response: Response, next: NextFunction) {
        try {
            const campos = await this.campoRepository.find({ relations: { pagos: true }, order: { id: "ASC" } })
            response.status(200).json({ message: "Campos obtenidos", object: campos })
        } catch (error) {
            responderError(response, error)
        }
    }

    async one(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const campo = await this.campoRepository.findOne({ where: { id }, relations: { pagos: true } })
            if (!campo) {
                response.status(404).json({ message: "Campo no encontrado", object: null })
                return
            }
            // Resumen para avisar antes de borrar: cuántos movimientos se perderían
            const [numPagos, numCheques] = await Promise.all([
                AppDataSource.getRepository(Pago).count({ where: { campo: { id } } }),
                AppDataSource.getRepository(Cheque).count({ where: { campo: { id } } }),
            ])
            response.status(200).json({ message: "Campo obtenido", object: { ...campo, numPagos, numCheques } })
        } catch (error) {
            responderError(response, error)
        }
    }

    async save(request: Request, response: Response, next: NextFunction) {
        try {
            const campo = await this.campoRepository.save(this.campoRepository.create(validarCampo(request.body)))
            response.status(200).json({ message: "Campo guardado", object: campo })
        } catch (error) {
            responderError(response, error)
        }
    }

    async update(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const datos = validarCampo(request.body)
            const campo = await this.campoRepository.findOneBy({ id })
            if (!campo) {
                response.status(404).json({ message: "Campo no encontrado", object: null })
                return
            }
            Object.assign(campo, datos)
            const campoActualizado = await this.campoRepository.save(campo)
            response.status(200).json({ message: "Campo actualizado", object: campoActualizado })
        } catch (error) {
            responderError(response, error)
        }
    }

    async remove(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const campo = await this.campoRepository.findOneBy({ id })
            if (!campo) {
                response.status(404).json({ message: "Campo no encontrado", object: null })
                return
            }
            await this.campoRepository.remove(campo)
            response.status(200).json({ message: "Campo eliminado", object: campo })
        } catch (error) {
            responderError(response, error)
        }
    }
}
