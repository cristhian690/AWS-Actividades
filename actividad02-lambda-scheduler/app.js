'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const {
  CloudWatchEventsClient,
  PutRuleCommand,
  PutTargetsCommand,
  DescribeRuleCommand,
} = require('@aws-sdk/client-cloudwatch-events');
const { LambdaClient, AddPermissionCommand } = require('@aws-sdk/client-lambda');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const REGION = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const ENDPOINT = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID || '000000000000';
const RULE_NAME = 'rutina-programada-rule';
const FUNCTION_NAME = 'rutina-programada';

const clientOptions = { region: REGION, endpoint: ENDPOINT };
const eventBridge = new CloudWatchEventsClient(clientOptions);
const lambda = new LambdaClient(clientOptions);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Lima usa UTC-5. EventBridge Rules interpreta las expresiones cron en UTC.
function horaLimaACronUtc(hora) {
  const coincidencia = /^(\d{2}):(\d{2})$/.exec(hora || '');
  if (!coincidencia) throw new Error('Selecciona una hora válida.');

  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) throw new Error('Selecciona una hora válida.');

  return `cron(${minutos} ${(horas + 5) % 24} * * ? *)`;
}

app.post('/api/programar', async (req, res) => {
  try {
    const cadaMinuto = req.body.cadaMinuto === true;
    const hora = req.body.hora;
    const expresion = cadaMinuto ? 'rate(1 minute)' : horaLimaACronUtc(hora);
    const etiqueta = cadaMinuto ? 'cada 1 minuto (modo prueba)' : `las ${hora}`;
    const descripcion = cadaMinuto ? 'MODO_PRUEBA' : `HORA_LIMA=${hora}`;

    // putRule actualiza la regla si ya existe: no crea programaciones duplicadas.
    const regla = await eventBridge.send(new PutRuleCommand({
      Name: RULE_NAME,
      ScheduleExpression: expresion,
      State: 'ENABLED',
      Description: descripcion,
    }));

    const lambdaArn = `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}`;
    const ruleArn = regla.RuleArn || `arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}`;

    // El permiso puede existir desde una programación anterior.
    try {
      await lambda.send(new AddPermissionCommand({
        FunctionName: FUNCTION_NAME,
        StatementId: 'permitir-eventbridge-web',
        Action: 'lambda:InvokeFunction',
        Principal: 'events.amazonaws.com',
        SourceArn: ruleArn,
      }));
    } catch (error) {
      if (error.name !== 'ResourceConflictException') throw error;
    }

    await eventBridge.send(new PutTargetsCommand({
      Rule: RULE_NAME,
      Targets: [{ Id: 'rutina-programada-target', Arn: lambdaArn }],
    }));

    res.json({ mensaje: `Rutina programada para ${etiqueta}`, hora, cadaMinuto, expresion });
  } catch (error) {
    console.error('No se pudo programar la rutina:', error);
    res.status(500).json({ error: error.message || 'No se pudo crear la programación.' });
  }
});

app.get('/api/estado', async (_req, res) => {
  try {
    const regla = await eventBridge.send(new DescribeRuleCommand({ Name: RULE_NAME }));
    const cadaMinuto = regla.Description === 'MODO_PRUEBA';
    const hora = regla.Description?.startsWith('HORA_LIMA=')
      ? regla.Description.replace('HORA_LIMA=', '')
      : null;

    res.json({
      programada: true,
      activa: regla.State === 'ENABLED',
      hora,
      cadaMinuto,
      expresion: regla.ScheduleExpression,
      mensaje: cadaMinuto
        ? 'Rutina programada para cada 1 minuto (modo prueba)'
        : `Rutina programada para las ${hora || 'hora configurada'}`,
    });
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return res.json({ programada: false, mensaje: 'Todavía no hay una rutina programada.' });
    }
    console.error('No se pudo consultar la programación:', error);
    res.status(500).json({ error: error.message || 'No se pudo consultar la programación.' });
  }
});

app.listen(PORT, () => {
  console.log(`Aplicación disponible en http://localhost:${PORT}`);
  console.log(`Conectada a Floci en ${ENDPOINT}`);
});
