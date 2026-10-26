# Sincronización de Base de Datos

Para que la aplicación funcione correctamente, primero debes sincronizar la base de datos con los cambios de las entidades TypeORM.

## Pasos:

### 1. Asegúrate de que el archivo `.env` está configurado correctamente

Copia `.env.example` a `.env` y completa los valores:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_NAME=campos_db
DB_SSL=false
PORT=3000
```

### 2. Sincroniza la base de datos

Ejecuta el script de sincronización desde el directorio `back/`:

```bash
npm run sync-db
```

Este comando:
- Conectará a la base de datos
- Creará las tablas faltantes
- Agregará columnas nuevas (como `anio` en la tabla `cheque`)
- Mostrará un resumen de lo que se sincronizó

### 3. Inicia el servidor backend

```bash
npm start
```

El servidor debería iniciarse en `http://localhost:3000`

## Cambios recientes:

- ✅ Se agregó campo `anio` a la entidad `Cheque` para filtrar por años
- ✅ TypeORM está configurado con `synchronize: true` para sincronización automática

Si tienes problemas, verifica:
1. Que PostgreSQL esté corriendo
2. Que la contraseña en `.env` sea correcta
3. Que la base de datos `campos_db` exista
