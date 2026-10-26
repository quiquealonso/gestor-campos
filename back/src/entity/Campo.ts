import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { Pago } from "./Pago"
import { Cheque } from "./Cheque"
import { numericTransformer } from "../utils/transformers"

@Entity()
export class Campo {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    nombre: string

    @Column({ type: "numeric", precision: 12, scale: 4, transformer: numericTransformer })
    tamano: number

    @Column("int")
    poligono: number

    @Column("int")
    parcela: number

    @OneToMany(() => Pago, (pago) => pago.campo)
    pagos: Pago[]

    @OneToMany(() => Cheque, (cheque) => cheque.campo)
    cheques: Cheque[]
}
