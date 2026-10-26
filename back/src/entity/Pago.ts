import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm"
import { Campo } from "./Campo"
import { Categoria } from "./Categoria"
import { numericTransformer } from "../utils/transformers"

@Entity()
export class Pago {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "timestamp" })
    fecha: Date

    @Column()
    nombre: string

    @Column({ type: "text" })
    descripcion: string

    @Column({ type: "numeric", precision: 12, scale: 2, transformer: numericTransformer })
    coste: number

    @Column({ type: "int", nullable: true })
    anio: number

    @ManyToOne(() => Campo, (campo) => campo.pagos, { onDelete: "CASCADE" })
    campo: Campo

    @ManyToOne(() => Categoria, (categoria) => categoria.pagos, { nullable: true, onDelete: "SET NULL" })
    categoria: Categoria | null
}
