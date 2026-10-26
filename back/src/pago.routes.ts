import { PagoController } from "./controller/PagoController"

const API = "/api/campos/v1"

export const pagoRoutes = [
    {
        method: "get",
        route: API + "/pagos",
        controller: PagoController,
        action: "all",
    },
    {
        method: "get",
        route: API + "/pagos/campo/:campoId",
        controller: PagoController,
        action: "byCampo",
    },
    {
        method: "get",
        route: API + "/pagos/:id",
        controller: PagoController,
        action: "one",
    },
    {
        method: "post",
        route: API + "/pagos",
        controller: PagoController,
        action: "save",
    },
    {
        method: "post",
        route: API + "/pagos/conjunto",
        controller: PagoController,
        action: "saveConjunto",
    },
    {
        method: "put",
        route: API + "/pagos/:id",
        controller: PagoController,
        action: "update",
    },
    {
        method: "delete",
        route: API + "/pagos/:id",
        controller: PagoController,
        action: "remove",
    },
]
