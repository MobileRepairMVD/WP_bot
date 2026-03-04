// ollamaClient.js - powered by Groq API
const axios = require("axios");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL    = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `Sos MobileBot, vendedor virtual de MobileRepair, tienda de repuestos y reparación de celulares y computadoras en Montevideo, Uruguay.

PERSONALIDAD:
- Hablás como un uruguayo joven: voseo estricto (vos, tenés, podés, contanos, avisanos, hacénoslo saber).
- NUNCA usás tuteo: nada de "te lo", "dime", "puedes", "hazme saber", "no dudes", "para ti", "te parece", "si prefieres". Siempre voseo.
- Sos un VENDEDOR entusiasta que quiere ayudar y concretar ventas, no solo informar.
- Máximo 2 oraciones por respuesta. Directo y al punto.
- Cuando el cliente pregunta si tenemos algo, NUNCA preguntes de vuelta qué tipo busca. Confirmá que sí tenemos y decile que lo busque directamente.

QUÉ VENDEMOS:
- Repuestos: pantallas, baterías, cámaras, flex de carga, tapas, conectores, memorias RAM, SSDs, procesadores, placas de video.
- Celulares y accesorios.
- Reparación de celulares (iPhone, Samsung, Xiaomi, Motorola) y notebooks/PCs.
- Precios en USD, garantía en todos los trabajos, tienda en Montevideo.

MÉTODOS DE PAGO ACEPTADOS (SOLO ESTOS, nunca inventar otros):
- Efectivo
- Transferencia bancaria directa
- Mercado Pago
Si preguntan por otro método, decís que por el momento aceptamos efectivo, transferencia y Mercado Pago.

TIEMPOS DE REPARACIÓN:
- La mayoría quedan listas en el día, dependiendo de disponibilidad. Nunca garantices horas exactas.

SERVICIO DE CADETE:
- Tenemos un cadete que retira el equipo en el domicilio del cliente, lo reparamos y lo devolvemos donde quiera.
- Requiere 70% de seña del costo de reparación para coordinar.
- Ofrecelo cuando el cliente no puede venir al local.

EJEMPLOS:
Cliente: "hola buenas"
Vos: "¡Hola! 👋 Bienvenido a MobileRepair, ¿en qué te puedo ayudar?"

Cliente: "tienen tarjetas gráficas?"
Vos: "¡Sí tenemos! Contamos con varias opciones NVIDIA y AMD, buscalas en el catálogo para ver precio y stock."

Cliente: "se me rompió la pantalla del samsung"
Vos: "¡Tranquilo, tiene solución! Tenemos pantallas para Samsung con garantía y técnicos especializados."

Cliente: "necesito reparar mi iphone"
Vos: "¡Claro, podemos ayudarte! Traelo al local en Ejido 1689, Timbre 202, Montevideo, o coordinamos un cadete para que lo pase a buscar."

Cliente: "no puedo ir al local"
Vos: "¡No hay problema! Tenemos un cadete que pasa a buscar tu equipo, lo reparamos y te lo enviamos donde vos quieras 🛵"`;

const conversaciones = {};
const MAX_TURNOS = 6;

function getHeaders() {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) throw new Error("GROQ_API_KEY no está definida en .env");
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${key}`,
  };
}

function getHistorial(numero) {
  return conversaciones[numero] || [];
}

function guardarTurno(numero, userMsg, assistantMsg) {
  if (!conversaciones[numero]) conversaciones[numero] = [];
  conversaciones[numero].push(
    { role: "user",      content: userMsg      },
    { role: "assistant", content: assistantMsg }
  );
  if (conversaciones[numero].length > MAX_TURNOS * 2) {
    conversaciones[numero] = conversaciones[numero].slice(-MAX_TURNOS * 2);
  }
}

function limpiarConversacion(numero) {
  delete conversaciones[numero];
}

async function warmUp() {
  try {
    console.log("   🔥 Verificando conexión con Groq API...");
    await axios.post(GROQ_URL, {
      model:      MODEL,
      messages:   [{ role: "user", content: "hola" }],
      max_tokens: 5,
    }, { headers: getHeaders(), timeout: 10000 });
    console.log("   ✅ Groq API lista.");
  } catch (err) {
    console.error("   ⚠️  Groq API falló:", err.response?.data?.error?.message || err.message);
  }
}

async function detectarIntencion(mensaje) {
  try {
    const response = await axios.post(GROQ_URL, {
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `Clasificá el mensaje de un cliente de tienda de repuestos de celulares.
Respondé SOLO con una palabra: "busqueda", "servicio" o "consulta".

"busqueda" cuando el cliente menciona marca+modelo buscando COMPRAR un repuesto o producto específico.

"servicio" ÚNICAMENTE cuando el cliente:
- Menciona explícitamente un NÚMERO de ingreso, ticket u orden (ej: "mi número es 971", "el ticket 45")
- Pregunta específicamente si su equipo YA está listo para retirar
- Da un número seguido de un nombre (ej: "971 a nombre de nelly")

"consulta" para TODO lo demás, incluyendo:
- Saludos
- Quiere traer su equipo a reparar (ej: "necesito reparar mi celular", "se me rompió la pantalla")
- Preguntas sobre servicios, precios, métodos de pago, horarios, cadete
- Cualquier mensaje que NO tenga un número de ticket explícito`
        },
        { role: "user", content: mensaje }
      ],
      max_tokens:  5,
      temperature: 0.1,
    }, { headers: getHeaders(), timeout: 10000 });

    const resultado = (response.data.choices?.[0]?.message?.content || "").trim().toLowerCase();
    if (resultado.includes("busqueda")) return "busqueda";
    if (resultado.includes("servicio")) return "servicio";
    return "consulta";

  } catch (err) {
    console.error("❌ Error detectarIntencion:", err.response?.data?.error?.message || err.message);
    return "consulta";
  }
}

async function extraerTerminoBusqueda(mensaje) {
  try {
    const response = await axios.post(GROQ_URL, {
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `Extraé SOLO el nombre del repuesto o producto que busca el cliente.
Respondé ÚNICAMENTE con el término de búsqueda, sin explicación ni puntuación extra.

Ejemplos:
"necesito saber si tienen celular xiaomi redmi a3x" → xiaomi redmi a3x
"quiero saber si tienen pantalla para iphone 7" → pantalla iphone 7
"necesito precio de bateria samsung a50" → bateria samsung a50
"tienen flex de carga para iphone 11?" → flex carga iphone 11
"busco memoria ram ddr4 8gb" → memoria ram ddr4 8gb`
        },
        { role: "user", content: mensaje }
      ],
      max_tokens:  20,
      temperature: 0.1,
    }, { headers: getHeaders(), timeout: 10000 });

    let termino = (response.data.choices?.[0]?.message?.content || "").trim().toLowerCase();
    if (!termino || termino.length > 60) return mensaje;

    termino = termino
      .replace(/\bpantallas\b/g, "pantalla")
      .replace(/\bbaterias\b/g, "bateria")
      .replace(/\bcamaras\b/g, "camara")
      .replace(/\bdisplays\b/g, "display")
      .replace(/\bcelulares\b/g, "celular")
      .replace(/\brepuestos\b/g, "repuesto")
      .replace(/\bcristales\b/g, "cristal")
      .replace(/\bflexes\b/g, "flex")
      .replace(/\bmemorias\b/g, "memoria")
      .replace(/\bplacas\b/g, "placa");

    return termino;

  } catch (err) {
    console.error("❌ Error extraerTerminoBusqueda:", err.response?.data?.error?.message || err.message);
    return mensaje;
  }
}

async function responderOllama(numero, mensajeUsuario) {
  try {
    const historial = getHistorial(numero);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historial,
      { role: "user",   content: mensajeUsuario },
    ];

    const response = await axios.post(GROQ_URL, {
      model:       MODEL,
      messages:    messages,
      max_tokens:  120,
      temperature: 0.75,
    }, { headers: getHeaders(), timeout: 15000 });

    const respuesta = (response.data.choices?.[0]?.message?.content || "").trim();
    if (!respuesta) return null;

    guardarTurno(numero, mensajeUsuario, respuesta);
    return respuesta;

  } catch (err) {
    console.error("❌ Error Groq:", err.response?.data?.error?.message || err.message);
    return null;
  }
}

module.exports = { responderOllama, limpiarConversacion, warmUp, detectarIntencion, extraerTerminoBusqueda };