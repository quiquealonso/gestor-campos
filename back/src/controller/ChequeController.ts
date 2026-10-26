import { NextFunction, Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { Cheque } from "../entity/Cheque"
import { Campo } from "../entity/Campo"
import { idParam, responderError, validarCheque, ValidationError } from "../utils/validate"

export class ChequeController {
    private chequeRepository = AppDataSource.getRepository(Cheque)
    private campoRepository = AppDataSource.getRepository(Campo)

    private async campoExistente(campoId: number | null): Promise<Campo> {
        if (!campoId) throw new ValidationError("El campo es obligatorio.")
        const campo = await this.campoRepository.findOneBy({ id: campoId })
        if (!campo) throw new ValidationError("El campo indicado no existe.")
        return campo
    }

    async all(request: Request, response: Response, next: NextFunction) {
        try {
            const cheques = await this.chequeRepository.find({ relations: { campo: true }, order: { dia: "DESC" } })
            response.status(200).json({ message: "Cheques obtenidos", object: cheques })
        } catch (error) {
            responderError(response, error)
        }
    }

    async byCampo(request: Request, response: Response, next: NextFunction) {
        try {
            const campoId = idParam(request.params.campoId, "El campo")
            const cheques = await this.chequeRepository.find({
                where: { campo: { id: campoId } },
                relations: { campo: true },
                order: { dia: "DESC" },
            })
            response.status(200).json({ message: "Cheques del campo obtenidos", object: cheques })
        } catch (error) {
            responderError(response, error)
        }
    }

    async one(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const cheque = await this.chequeRepository.findOne({ where: { id }, relations: { campo: true } })
            if (!cheque) {
                response.status(404).json({ message: "Cheque no encontrado", object: null })
                return
            }
            response.status(200).json({ message: "Cheque obtenido", object: cheque })
        } catch (error) {
            responderError(response, error)
        }
    }

    async save(request: Request, response: Response, next: NextFunction) {
        try {
            const { campoId, ...datos } = validarCheque(request.body)
            const campo = await this.campoExistente(campoId)
            const cheque = await this.chequeRepository.save(this.chequeRepository.create({ ...datos, campo }))
            response.status(200).json({ message: "Cheque guardado", object: cheque })
        } catch (error) {
            responderError(response, error)
        }
    }

    async update(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const { campoId, ...datos } = validarCheque(request.body)
            const cheque = await this.chequeRepository.findOne({ where: { id }, relations: { campo: true } })
            if (!cheque) {
                response.status(404).json({ message: "Cheque no encontrado", object: null })
                return
            }
            if (campoId) cheque.campo = await this.campoExistente(campoId)
            Object.assign(cheque, datos)
            const actualizado = await this.chequeRepository.save(cheque)
            response.status(200).json({ message: "Cheque actualizado", object: actualizado })
        } catch (error) {
            responderError(response, error)
        }
    }

    async remove(request: Request, response: Response, next: NextFunction) {
        try {
            const id = idParam(request.params.id)
            const cheque = await this.chequeRepository.findOneBy({ id })
            if (!cheque) {
                response.status(404).json({ message: "Cheque no encontrado", object: null })
                return
            }
            await this.chequeRepository.remove(cheque)
            response.status(200).json({ message: "Cheque eliminado", object: cheque })
        } catch (error) {
            responderError(response, error)
        }
    }
}
