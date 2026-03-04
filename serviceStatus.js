// serviceStatus.js
require("dotenv").config();
const axios = require("axios");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

function getConfig() {
  const url    = (process.env.SERVICE_API_URL || '').trim();
  const apiKey = (process.env.SERVICE_API_KEY || '').trim();
  if (!url || !apiKey) throw new Error("SERVICE_API_URL o SERVICE_API_KEY no definidas en .env");
  return { url, apiKey };
}

// ── Paso 1: verificar que el ticket existe (sin devolver datos sensibles) ──────
async function ticketExiste(ticket) {
  const ticketNum = parseInt(ticket, 10);
  if (isNaN(ticketNum) || ticketNum <= 0) {
    return { ok: false, motivo: "ticket_invalido" };
  }
  try {
    const { url, apiKey } = getConfig();
    const response = await axios.get(url, {
      httpsAgent: agent,
      params: { ticket: ticketNum, key: apiKey },
      timeout: 8000,
    });
    const data = response.data;
    if (!data || data.error) return { ok: false, motivo: data?.motivo || "no_encontrado" };
    if (data.existe)          return { ok: true };
    return { ok: false, motivo: "no_encontrado" };
  } catch (err) {
    console.error("Error ticketExiste:", err.message);
    return { ok: false, motivo: "error_conexion" };
  }
}

// ── Paso 2: verificar identidad y obtener datos completos ─────────────────────
async function consultarEstado(ticket, verificacion) {
  const ticketNum = parseInt(ticket, 10);
  if (isNaN(ticketNum) || ticketNum <= 0) {
    return { error: true, motivo: "ticket_invalido" };
  }
  try {
    const { url, apiKey } = getConfig();
    const response = await axios.get(url, {
      httpsAgent: agent,
      params: { ticket: ticketNum, key: apiKey, verificacion: verificacion.trim() },
      timeout: 8000,
    });
    const data = response.data;
    if (!data || data.error) return { error: true, motivo: data?.motivo || "error_desconocido" };
    return {
      error:         false,
      cliente:       data.cliente       || "—",
      equipo:        data.equipo        || "—",
      estado:        data.estado        || "—",
      fecha_ingreso: data.fecha_ingreso || "—",
      notas:         data.notas         || null,
      fecha_retiro:  data.fecha_retiro  || null,
    };
  } catch (err) {
    console.error("Error consultarEstado:", err.message);
    return { error: true, motivo: "error_conexion" };
  }
}

module.exports = { ticketExiste, consultarEstado };
