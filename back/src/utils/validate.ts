/** Error de validación -> se responde con HTTP 400 y el mensaje tal cual. */
export class ValidationError extends Error {
    status = 400
    constructor(message: string) {
        super(message)
    }
}

const fail = (msg: string): never => {
    throw new ValidationError(msg)
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function texto(v: any, campo: string, max: number, requerido = true): string {
    if (v === undefined || v === null || String(v).trim() === "") {
        if (requerido) fail(`${campo} es obligatorio.`)
        return ""
    }
    const s = String(v).trim()
    if (s.length > max) fail(`${campo} no puede superar ${max} caracteres.`)
    return s
}

function numero(v: any, campo: string, { min = 0, max = 1e9, entero = false, estricto = true } = {}): number {
    if (v === undefined || v === null || v === "") fail(`${campo} es obligatorio.`)
    const n = Number(v)
    if (!Number.isFinite(n)) fail(`${campo} debe ser un número válido.`)
    if (entero && !Number.isInteger(n)) fail(`${campo} debe ser un número entero.`)
    if (estricto ? n <= min : n < min) fail(`${campo} debe ser ${estricto ? "mayor" : "mayor o igual"} que ${min}.`)
    if (n > max) fail(`${campo} es demasiado grande.`)
    return n
}

function fecha(v: any, campo: string): Date {
    if (!v) fail(`${campo} es obligatoria.`)
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) fail(`${campo} no es una fecha válida.`)
    const anio = d.getFullYear()
    if (anio < 1990 || anio > 2100) fail(`${campo} está fuera de rango (1990-2100).`)
    return d
}

function anioOpcional(v: any): number | null {
    if (v === undefined || v === null || v === "") return null
    return numero(v, "El año", { min: 1989, max: 2100, entero: true })
}

export function idDeRelacion(v: any, campo: string, requerido: boolean): number | null {
    const raw = v && typeof v === "object" ? v.id : v
    if (raw === undefined || raw === null || raw === "") {
        if (requerido) fail(`${campo} es obligatorio.`)
        return null
    }
    return numero(raw, campo, { min: 0, entero: true })
}

export function validarCampo(b: any = {}) {
    return {
        nombre: texto(b.nombre, "El nombre", 100),
        tamano: numero(b.tamano, "El tamaño", { max: 1e7 }),
        poligono: numero(b.poligono, "El polígono", { min: 0, entero: true, estricto: false, max: 1e6 }),
        parcela: numero(b.parcela, "La parcela", { min: 0, entero: true, estricto: false, max: 1e6 }),
    }
}

export function validarPago(b: any = {}) {
    return {
        fecha: fecha(b.fecha, "La fecha"),
        nombre: texto(b.nombre, "El nombre", 120),
        descripcion: texto(b.descripcion, "La descripción", 2000, false),
        coste: round2(numero(b.coste, "El coste", { max: 1e9 })),
        anio: anioOpcional(b.anio),
        campoId: idDeRelacion(b.campo ?? b.campoId, "El campo", false),
        categoriaId: idDeRelacion(b.categoria ?? b.categoriaId, "La categoría", false),
    }
}

export function validarCheque(b: any = {}) {
    return {
        dia: fecha(b.dia, "El día"),
        cantidad: round2(numero(b.cantidad, "La cantidad", { max: 1e9 })),
        anio: anioOpcional(b.anio),
        campoId: idDeRelacion(b.campo ?? b.campoId, "El campo", false),
    }
}

export function validarCategoria(b: any = {}) {
    const color = b.color === undefined || b.color === null || b.color === "" ? undefined : String(b.color)
    if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) fail("El color debe tener formato #RRGGBB.")
    return { nombre: texto(b.nombre, "El nombre", 60), color }
}

export function idParam(v: any, nombre = "El id"): number {
    return numero(v, nombre, { min: 0, entero: true })
}

/** Responde con el status adecuado según el tipo de error. */
export function responderError(response: any, error: any) {
    if (error instanceof ValidationError) {
        response.status(400).json({ message: error.message, object: null })
        return
    }
    if (error?.code === "23505") {
        response.status(409).json({ message: "Ya existe un registro con ese valor.", object: null })
        return
    }
    console.error(error)
    response.status(500).json({ message: "Error interno del servidor.", object: null })
}
