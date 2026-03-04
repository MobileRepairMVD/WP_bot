require("dotenv").config();
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const { responderOllama, warmUp, detectarIntencion, extraerTerminoBusqueda } = require("./ollamaClient");
const { buscarProducto } = require("./searchEngine");
const { ticketExiste, consultarEstado } = require("./serviceStatus");

const client = new Client({ authStrategy: new LocalAuth() });

client.on("qr", qr => qrcode.generate(qr, { small: true }));

client.on("ready", async () => {
  console.log("🤖 Bot listo!");
  await warmUp();
});

client.on("message", async msg => {
  const numero = msg.from;
  const texto  = msg.body;

  const tipo = await detectarIntencion(texto);

  if(tipo === "busqueda") {
    const termino = await extraerTerminoBusqueda(texto);
    const resultados = await buscarProducto(termino);
    if(resultados.length === 0) {
      msg.reply("No encontré productos con ese término 😕");
    } else {
      const lista = resultados.slice(0,5).map(p => `${p.name} - USD ${p.price}`).join("\n");
      msg.reply(`Encontré estos productos:\n${lista}`);
    }
  } else if(tipo === "servicio") {
    const ticket = texto.match(/\d+/)?.[0];
    if(!ticket) return msg.reply("No encontré un número de ticket válido.");
    const existe = await ticketExiste(ticket);
    if(!existe.ok) return msg.reply("No existe el ticket o hubo un error.");
    const estado = await consultarEstado(ticket, "verificacion_demo");
    msg.reply(`Estado del ticket ${ticket}:\nCliente: ${estado.cliente}\nEquipo: ${estado.equipo}\nEstado: ${estado.estado}`);
  } else {
    const respuesta = await responderOllama(numero, texto);
    msg.reply(respuesta || "Ups, algo salió mal 😅");
  }
});

client.initialize();