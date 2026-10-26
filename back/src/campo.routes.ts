import { CampoController } from "./controller/CampoController"

const API = "/api/campos/v1"

export const campoRoutes = [
    {
        method: "get",
        route: API + "/campos",
        controller: CampoController,
        action: "all",
    },
    {
        method: "get",
        route: API + "/campos/:id",
        controller: CampoController,
        action: "one",
    },
    {
        method: "post",
        route: API + "/campos",
        controller: CampoController,
        action: "save",
    },
    {
        method: "put",
        route: API + "/campos/:id",
        controller: CampoController,
        action: "update",
    },
    {
        method: "delete",
        route: API + "/campos/:id",
        controller: CampoController,
        action: "remove",
    },
]
