# Construir Aplicación de Escritorio (.exe) con Electron

Ahora tu proyecto puede ser empaquetado como una aplicación de escritorio ejecutable (.exe) que incluye tanto el frontend Angular como el backend Express.

## Requisitos previos

1. **Node.js** instalado (versión 18+)
2. **PostgreSQL** debe estar instalado y ejecutándose en tu máquina
3. Archivo `.env` configurado en la carpeta `back/`

## Pasos para ejecutar en desarrollo

### 1. Terminal 1 - Servidor Angular (opcional)
```bash
cd front
npm start
```
(Esto abre un servidor de desarrollo en `http://localhost:4200`)

### 2. Terminal 2 - Electron con Backend integrado
```bash
cd front
npm run electron-dev
```

Esto automáticamente:
- Inicia Angular en `http://localhost:4200`
- Espera a que esté lista
- Ejecuta Electron que lanza el Navegador y el Backend
- El Backend corre en `http://localhost:3000`

## Pasos para crear el .exe (Producción)

### 1. En la carpeta `front/`:
```bash
npm run electron-build
```

Este comando:
1. Compila Angular para producción (`npm run build:electron`)
2. Usa electron-builder para crear el instalador

El archivo `.exe` se creará en: `front/dist-electron/`

### Archivos generados:
- **Gestor Campos Setup 0.0.0.exe** - Instalador (usuarios lo descargan e instalan)
- **Gestor Campos 0.0.0.exe** - Versión portable (sin instalación, ejecutable directo)

## Solución de problemas

### Error: "PostgreSQL connection refused"
- Asegúrate que PostgreSQL esté corriendo
- Verifica las credenciales en `back/.env`

### Error: "Port 3000 already in use"
- Otro proceso está usando el puerto 3000
- Solución: `netstat -ano | findstr :3000` (Windows) y mata el proceso

### Error: "Cannot find module"
- Asegúrate de instalar todas las dependencias:
  ```bash
  cd front && npm install
  cd ../back && npm install
  ```

## Estructura del proyecto
```
campos/
├── front/                 # Frontend Angular + Electron
│   ├── src/              # Código fuente Angular
│   ├── electron-main.ts  # Main process de Electron
│   ├── preload.js        # Preload script
│   └── package.json      # Con scripts de Electron
├── back/                 # Backend Express
│   ├── src/              # Código fuente
│   └── .env              # Configuración BD
```

## Variables de entorno importantes

En `back/.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_NAME=campos_db
PORT=3000
```

## Distribución

Para distribuir la aplicación:
1. Los usuarios descargan `Gestor Campos Setup.exe`
2. Lo ejecutan para instalar
3. Abren desde el menú Inicio
4. ¡Listo! Todo funciona sin necesidad de instalar Node.js

## Notas

- La aplicación es completamente independiente
- No requiere que los usuarios tengan Node.js, Angular o Express instalados
- PostgreSQL sigue siendo un requisito externo (puede instalarse con un installer separado)
- La primera ejecución es más lenta porque inicia el backend

¡El proyecto ya está listo para ser un .exe! 🎉
