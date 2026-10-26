import * as express from "express"
import * as bodyParser from "body-parser"
import { Request, Response } from "express"
import * as cors from 'cors';
import { AppDataSource, DB_PROFILE } from "./data-source"
import { ensureSchema } from "./schema"
import * as http from "http";
import { Routes } from "./routes"
//import { SocketController } from './controller/SocketController';


AppDataSource.initialize().then(async () => {
    // Local: crea/actualiza tablas. Supabase: solo conversiones seguras (el esquema se cambia con `npm run sync-db:supabase`)
    await ensureSchema(AppDataSource, { synchronize: DB_PROFILE === "local" })

    // create express app
    const app = express()
    app.use(cors());
    app.use(express.json());
    // register express routes from defined application routes
    Routes.forEach(route => {
        (app as any)[route.method](route.route, (req: Request, res: Response, next: Function) => {
            const result = (new (route.controller as any))[route.action](req, res, next)
            if (result instanceof Promise) {
                result.then(result => result !== null && result !== undefined ? res.send(result) : undefined)

            } else if (result !== null && result !== undefined) {
                res.json(result)
            }
        })
    })

    // 3. Crear el Servidor HTTP natiu de Node
    // Necessitem el servidor 'raw' per a que el WebSocket s'hi pugui acoblar
    const server = http.createServer(app);

    // 4. Inicialitzar SocketController passant el servidor HTTP
    //SocketController.initSocket(server);
    // 5. Arrencar-ho tot en el mateix port
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🚀 Servidor corrent a http://localhost:${PORT}`);
    });
    // start express server
    //app.listen(3000)

    //console.log("Express server has started on port 3000. Open http://localhost:3000/users to see results")

}).catch(error => console.log(error))
