require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const archivosDir = path.join(__dirname, "archivos");
const publicDir = path.join(__dirname, "public");
const puerto = 3000;

function obtenerArchivo() {
  const argumento = process.argv[2];

  if (argumento) {
    return path.join(archivosDir, path.basename(argumento));
  }

  const archivos = fs
    .readdirSync(archivosDir, { withFileTypes: true })
    .filter((entrada) => entrada.isFile() && entrada.name !== ".gitkeep")
    .map((entrada) => path.join(archivosDir, entrada.name));

  if (archivos.length === 0) {
    throw new Error(
      "No hay archivos para subir. Agrega uno en la carpeta archivos/ o ejecuta: node app.js nombre.ext"
    );
  }

  return archivos[0];
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function main() {
  const rutaArchivo = obtenerArchivo();
  const nombreArchivo = path.basename(rutaArchivo);

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: nombreArchivo,
      Body: fs.createReadStream(rutaArchivo),
    })
  );

  console.log(
    `Archivo ${nombreArchivo} subido a s3://${process.env.AWS_S3_BUCKET}/${nombreArchivo}`
  );
}

// Multer guarda temporalmente el archivo en memoria para enviarlo directo a S3.
const upload = multer({ storage: multer.memoryStorage() });

function iniciarServidor() {
  const app = express();

  // Publica index.html y cualquier otro recurso de la carpeta public.
  app.use(express.static(publicDir));

  // El nombre "archivo" debe coincidir con el campo del formulario HTML.
  // /api/subir se conserva como alias para mantener compatibilidad.
  app.post(["/upload", "/api/subir"], upload.single("archivo"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ mensaje: "Selecciona un archivo." });
    }

    // Elimina cualquier ruta y conserva solamente el nombre del archivo.
    const nombreArchivo = req.file.originalname.replace(/^.*[\\/]/, "");

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: nombreArchivo,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      console.log(`Archivo ${nombreArchivo} subido desde la web a S3`);
      return res.json({
        mensaje: `Archivo ${nombreArchivo} subido correctamente a S3`,
      });
    } catch (error) {
      console.error("Error al subir el archivo desde la web:", error.message);
      return res.status(500).json({
        mensaje: "No se pudo subir el archivo a S3. Verifica que Floci esté activo.",
      });
    }
  });

  // Obtiene los archivos almacenados actualmente en el bucket S3.
  app.get("/api/archivos", async (_req, res) => {
    try {
      const resultado = await s3.send(
        new ListObjectsV2Command({
          Bucket: process.env.AWS_S3_BUCKET,
        })
      );

      const archivos = (resultado.Contents || []).map((objeto) => ({
        nombre: objeto.Key.split("/").pop(),
        key: objeto.Key,
        tamano: objeto.Size,
        fecha: objeto.LastModified,
      }));

      return res.json(archivos);
    } catch (error) {
      console.error("Error al listar los archivos:", error.message);
      return res.status(500).json({
        mensaje: "No se pudieron obtener los archivos de S3.",
      });
    }
  });

  // Elimina de S3 el objeto identificado por su key.
  app.delete("/api/archivos/:key", async (req, res) => {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: req.params.key,
        })
      );

      console.log(`Archivo ${req.params.key} eliminado de S3`);
      return res.json({ mensaje: "Archivo eliminado correctamente." });
    } catch (error) {
      console.error("Error al eliminar el archivo:", error.message);
      return res.status(500).json({
        mensaje: "No se pudo eliminar el archivo de S3.",
      });
    }
  });

  // Los errores de las rutas API, incluidos los de Multer, siempre son JSON.
  app.use((error, req, res, next) => {
    if (req.path === "/upload" || req.path.startsWith("/api/")) {
      console.error("Error en la API:", error.message);
      return res.status(500).json({ mensaje: error.message });
    }

    return next(error);
  });

  app.listen(puerto, () => {
    console.log(`Servidor web disponible en http://localhost:${puerto}`);
  });
}

// --web inicia la interfaz. Cualquier otro argumento mantiene el modo consola.
if (process.argv[2] === "--web") {
  iniciarServidor();
} else {
  main().catch((error) => {
    console.error("Error al subir el archivo:", error.message);
    process.exitCode = 1;
  });
}
