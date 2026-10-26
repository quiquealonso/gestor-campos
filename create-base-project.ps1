param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectName,

    [string]$TargetDir = ".",

    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[base-generator] $Message" -ForegroundColor Cyan
}

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontro el comando '$Name'. Instalalo y vuelve a ejecutar el script."
    }
}

Assert-Command "node"
Assert-Command "npm"
Assert-Command "npx"

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $TargetDir $ProjectName))
$frontPath = Join-Path $projectRoot "front"
$backPath = Join-Path $projectRoot "back"
$backSrcPath = Join-Path $backPath "src"
$backCtrlPath = Join-Path $backSrcPath "controller"
$backEntityPath = Join-Path $backSrcPath "entity"

if (Test-Path $projectRoot) {
    throw "La carpeta '$projectRoot' ya existe. Usa otro nombre o elimina esa carpeta."
}

Write-Step "Creando raiz del proyecto: $projectRoot"
New-Item -ItemType Directory -Path $projectRoot -Force | Out-Null

Write-Step "Generando frontend base Angular"
Push-Location $projectRoot
try {
    $angularArgs = @(
        "@angular/cli@latest",
        "new",
        "front",
        "--standalone",
        "--routing",
        "--style=css",
        "--ssr=false",
        "--skip-git",
        "--skip-tests",
        "--defaults"
    )

    if ($SkipInstall) {
        $angularArgs += "--skip-install"
    }

    npx @angularArgs
}
finally {
    Pop-Location
}

Write-Step "Configurando Electron en frontend"
Push-Location $frontPath
try {
    $frontPackagePath = Join-Path $frontPath "package.json"
    $frontPackage = Get-Content $frontPackagePath -Raw | ConvertFrom-Json

    $frontPackage | Add-Member -NotePropertyName "main" -NotePropertyValue "electron-main.js" -Force
    $frontPackage | Add-Member -NotePropertyName "homepage" -NotePropertyValue "./" -Force

    if (-not $frontPackage.scripts) {
        $frontPackage | Add-Member -NotePropertyName "scripts" -NotePropertyValue (@{}) -Force
    }

    $frontPackage.scripts | Add-Member -NotePropertyName "build:electron" -NotePropertyValue "ng build --configuration production" -Force
    $frontPackage.scripts | Add-Member -NotePropertyName "electron" -NotePropertyValue "electron ." -Force
    $frontPackage.scripts | Add-Member -NotePropertyName "electron-dev" -NotePropertyValue 'concurrently "npm start" "wait-on http://localhost:4200 && npm run electron"' -Force
    $frontPackage.scripts | Add-Member -NotePropertyName "electron-build" -NotePropertyValue 'npm run build:electron && electron-builder' -Force

    $buildConfig = [ordered]@{
        appId = "com.$($ProjectName.ToLowerInvariant()).app"
        productName = $ProjectName
        directories = [ordered]@{
            buildResources = "public"
            output = "dist-electron"
        }
        files = @(
            "electron-main.js",
            "preload.js",
            "dist/front/**/*",
            "node_modules/**/*",
            "package.json"
        )
        win = [ordered]@{
            target = @(
                [ordered]@{
                    target = "portable"
                    arch = @("x64")
                }
            )
        }
    }

    $frontPackage | Add-Member -NotePropertyName "build" -NotePropertyValue $buildConfig -Force

    $frontPackageJson = $frontPackage | ConvertTo-Json -Depth 20
    Set-Content -Path $frontPackagePath -Value $frontPackageJson -Encoding UTF8

    $electronMainTs = @'
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Front base: solo carga Angular, sin logica de negocio.
  win.loadURL('http://localhost:4200');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
'@

    Set-Content -Path (Join-Path $frontPath "electron-main.ts") -Value $electronMainTs -Encoding UTF8

    $electronMainJs = @'
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('http://localhost:4200');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
'@

    Set-Content -Path (Join-Path $frontPath "electron-main.js") -Value $electronMainJs -Encoding UTF8

    $preload = @'
window.addEventListener('DOMContentLoaded', () => {
  // Preload base para futuras APIs seguras con contextBridge.
});
'@

    Set-Content -Path (Join-Path $frontPath "preload.js") -Value $preload -Encoding UTF8

    if (-not $SkipInstall) {
        npm install --save-dev electron electron-builder concurrently wait-on
    }
}
finally {
    Pop-Location
}

Write-Step "Creando backend base (TypeScript + Express + TypeORM)"
New-Item -ItemType Directory -Path $backCtrlPath -Force | Out-Null
New-Item -ItemType Directory -Path $backEntityPath -Force | Out-Null

$backPackage = @'
{
  "name": "backend",
  "version": "0.0.1",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "body-parser": "^1.20.3",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "reflect-metadata": "^0.2.2",
    "typeorm": "^0.3.28"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "@types/express": "^5.0.0",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.8.2"
  }
}
'@
Set-Content -Path (Join-Path $backPath "package.json") -Value $backPackage -Encoding UTF8

$backTsConfig = @'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
'@
Set-Content -Path (Join-Path $backPath "tsconfig.json") -Value $backTsConfig -Encoding UTF8

$backIndex = @'
import "reflect-metadata";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();

app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`Backend base listo en puerto ${port}`);
});
'@
Set-Content -Path (Join-Path $backSrcPath "index.ts") -Value $backIndex -Encoding UTF8

Set-Content -Path (Join-Path $backPath ".env.example") -Value "PORT=3000`n" -Encoding UTF8
Set-Content -Path (Join-Path $backPath "README.md") -Value "# Backend base`n`nProyecto base sin logica funcional.`n" -Encoding UTF8

if (-not $SkipInstall) {
    Write-Step "Instalando dependencias del backend"
    Push-Location $backPath
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

$rootReadme = @"
# $ProjectName

Plantilla base generada automaticamente.

## Estructura
- front: Angular + Electron (solo configuracion base)
- back: Node + TypeScript + Express + TypeORM (sin logica de negocio)

## Comandos utiles
Frontend:
- cd front
- npm start
- npm run electron-dev

Backend:
- cd back
- npm start
"@
Set-Content -Path (Join-Path $projectRoot "README.md") -Value $rootReadme -Encoding UTF8

Write-Step "Listo. Proyecto base creado en: $projectRoot"
if ($SkipInstall) {
    Write-Step "Se omitio la instalacion de paquetes (--SkipInstall)."
}
