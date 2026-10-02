# AWS Actividades

Proyecto con dos prácticas de Node.js que usan servicios AWS ejecutados localmente mediante Floci.

## Requisitos principales

- Node.js 20 o superior y npm.
- Docker Desktop y Floci en ejecución.
- AWS CLI.
- Endpoint local de AWS: `http://localhost:4566`.
- Credenciales de prueba y región configuradas en los archivos `.env` de cada actividad.

## Actividad 01: S3 + Lambda

Permite subir, listar y eliminar archivos desde una interfaz web. Los archivos se guardan en S3 y cada carga genera un evento `ObjectCreated` que invoca una función Lambda.

Para ejecutarla:

```powershell
Set-Location .\actividad01-s3-lambda
npm install
npm start
```

Abre `http://localhost:3000`. El bucket y la función Lambda deben estar creados previamente en Floci.

## Actividad 02: Lambda Scheduler

Permite programar una función Lambda con EventBridge para una hora de Lima o ejecutarla cada minuto en modo de prueba.

Para ejecutarla:

```powershell
Set-Location .\actividad02-lambda-scheduler
npm install
npm start
```

Abre `http://localhost:3000`. Antes de iniciarla, detén la Actividad 01 si está usando el mismo puerto. La función `rutina-programada` debe existir previamente en Floci.

## URLs de ejecución

- Aplicación web de cada actividad: `http://localhost:3000`
- Estado de la programación de la Actividad 02: `http://localhost:3000/api/estado`
- Endpoint local de AWS/Floci: `http://localhost:4566`
