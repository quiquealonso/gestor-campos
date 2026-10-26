import { ChequeController } from "./controller/ChequeController"

const API = "/api/campos/v1"

export const chequeRoutes = [
    {
        method: "get",
        route: API + "/cheques",
        controller: ChequeController,
        action: "all",
    },
    {
        method: "get",
        route: API + "/cheques/campo/:campoId",
        controller: ChequeController,
        action: "byCampo",
    },
    {
        method: "get",
        route: API + "/cheques/:id",
        controller: ChequeController,
        action: "one",
    },
    {
        method: "post",
        route: API + "/cheques",
        controller: ChequeController,
        action: "save",
    },
    {
        method: "put",
        route: API + "/cheques/:id",
        controller: ChequeController,
        action: "update",
    },
    {
        method: "delete",
        route: API + "/cheques/:id",
        controller: ChequeController,
        action: "remove",
    },
]
