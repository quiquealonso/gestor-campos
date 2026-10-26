import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { Pago } from "./Pago"

@Entity()
export class Categoria {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "varchar", length: 60, unique: true })
    nombre: string

    @Column({ type: "varchar", length: 9, default: "#8b949e" })
    color: string

    @OneToMany(() => Pago, (pago) => pago.categoria)
    pagos: Pago[]
}
