'use strict';

exports.handler = async () => {
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour12: false,
  });

  const mensaje = `Rutina ejecutada correctamente a las ${hora}`;
  console.log(mensaje);

  return {
    statusCode: 200,
    body: mensaje,
  };
};
