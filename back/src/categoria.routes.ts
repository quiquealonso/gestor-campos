import { CategoriaController } from "./controller/CategoriaController"

const API = "/api/campos/v1"

export const categoriaRoutes = [
    { method: "get", route: API + "/categorias", controller: CategoriaController, action: "all" },
    { method: "post", route: API + "/categorias", controller: CategoriaController, action: "save" },
    { method: "put", route: API + "/categorias/:id", controller: CategoriaController, action: "update" },
    { method: "delete", route: API + "/categorias/:id", controller: CategoriaController, action: "remove" },
]
