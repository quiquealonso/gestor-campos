import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm"
import { Campo } from "./Campo"
import { numericTransformer } from "../utils/transformers"

@Entity()
export class Cheque {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "timestamp" })
    dia: Date

    @Column({ type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
    cantidad: number

    @Column({ type: "int", nullable: true })
    anio: number

    @ManyToOne(() => Campo, (campo) => campo.cheques, { onDelete: "CASCADE" })
    campo: Campo
}
