import { campoRoutes } from "./campo.routes"
import { pagoRoutes } from "./pago.routes"
import { chequeRoutes } from "./cheque.routes"
import { categoriaRoutes } from "./categoria.routes"

export const Routes = [...campoRoutes, ...pagoRoutes, ...chequeRoutes, ...categoriaRoutes]
