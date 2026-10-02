exports.handler = async (event) => {
  for (const record of event.Records || []) {
    const nombreArchivo = decodeURIComponent(
      record.s3.object.key.replace(/\+/g, " ")
    );

    console.log(`Archivo ${nombreArchivo} subido correctamente`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ mensaje: "Evento procesado" }),
  };
};
