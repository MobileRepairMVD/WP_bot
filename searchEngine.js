// searchEngine.js
const axios = require("axios");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

// ── Palabras vacías (no se usan como filtro obligatorio) ───────────────────────
const STOP_WORDS = new Set([
  'el','la','los','las','de','del','y','con','para','un','una','unos','unas',
  'a','en','por','que','es','son','mi','tu','su','al','se','no','si','lo',
  'le','me','te','nos','vos','mas','muy','e','o','u'
]);

// ── Sinónimos: el usuario puede escribir "display", "lcd", etc.
//    y se busca también "pantalla" ─────────────────────────────────────────────
const SINONIMOS = {
  // Pantallas
  display:       'pantalla',
  modulo:        'pantalla',
  lcd:           'pantalla',
  vidrio:        'pantalla',
  pantalla:      'display',
  // Placas madre
  'placa madre': 'motherboard',
  mainboard:     'motherboard',
  mobo:          'motherboard',
  motherboard:   'placa',
  // Tarjeta de video
  'tarjeta de video': 'gpu',
  'placa de video':   'gpu',
  gpu:           'tarjeta',
  // Procesador
  procesador:    'cpu',
  cpu:           'procesador',
  // Batería
  bateria:       'battery',
  pila:          'bateria',
  // Cámara
  camara:        'camera',
  // Memoria
  ram:           'memoria',
  // Cargador
  cargador:      'flex',
  'cable de carga': 'flex',
};

// ── Normalizar texto (minúsculas, sin tildes, sin caracteres especiales) ───────
function normalizar(texto) {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Extraer todo el texto indexable de un producto ─────────────────────────────
function textoProducto(p) {
  const cats = (p.categories || []).map(c => normalizar(c.name)).join(' ');
  const tags = (p.tags      || []).map(t => normalizar(t.name)).join(' ');
  return [
    normalizar(p.name),
    normalizar(p.sku),
    normalizar(p.short_description),
    normalizar(p.description),
    cats,
    tags,
  ].join(' ');
}

// ── Expandir query: extraer palabras clave + agregar sinónimos ─────────────────
function expandirQuery(query) {
  let texto = normalizar(query);

  // Reemplazar frases de dos palabras antes de dividir
  const frases = [
    ['placa madre',      'motherboard'],
    ['tarjeta de video', 'motherboard'],  // se filtra por motherboard en búsqueda
    ['placa de video',   'tarjeta'],
    ['cable de carga',   'flex'],
    ['memoria ram',      'ram'],
  ];
  for (const [frase, reemplazo] of frases) {
    if (texto.includes(frase)) {
      texto = texto.replace(frase, reemplazo);
    }
  }

  const palabras = texto
    .split(' ')
    .filter(p => !STOP_WORDS.has(p) && p.length > 0);

  // Para cada palabra que tenga sinónimo, agregar el sinónimo como alternativa
  const expandidas = [];
  for (const p of palabras) {
    expandidas.push({ original: p, alternativa: SINONIMOS[p] || null });
  }
  return expandidas;
}

// ── Verificar si una palabra (o su sinónimo) está en un texto ──────────────────
function palabraEnTexto(entrada, texto) {
  if (texto.includes(entrada.original)) return true;
  if (entrada.alternativa && texto.includes(entrada.alternativa)) return true;
  return false;
}

// ── Búsqueda en dos pasadas ────────────────────────────────────────────────────
//
//  1ª pasada — ESTRICTA: todas las palabras clave deben estar en el TÍTULO.
//     Garantiza resultados exactos y elimina falsos positivos por SKU/descripción.
//
//  2ª pasada — AMPLIADA: si la 1ª da menos de 3 resultados, se acepta que
//     alguna palabra esté fuera del título, pero el título debe tener al menos
//     la mitad de las palabras clave. Evita que un número en el SKU cuele basura.
//
function filtrarYPuntuar(productos, palabrasClave) {
  const puntuar = (p, modoEstricto) => {
    const nombre = normalizar(p.name);
    const todo   = textoProducto(p);

    if (modoEstricto) {
      // Todas las palabras deben estar en el título
      if (!palabrasClave.every(pal => palabraEnTexto(pal, nombre))) return null;
    } else {
      // Todas las palabras deben aparecer en algún campo
      if (!palabrasClave.every(pal => palabraEnTexto(pal, todo))) return null;
      // El título debe tener al menos la mitad de las palabras clave
      const enTitulo = palabrasClave.filter(pal => palabraEnTexto(pal, nombre)).length;
      if (enTitulo < Math.ceil(palabrasClave.length / 2)) return null;
    }

    let puntaje = 0;
    for (const pal of palabrasClave) {
      if (palabraEnTexto(pal, nombre)) puntaje += 10;
      else puntaje += 1;
    }
    if (palabrasClave.every(pal => palabraEnTexto(pal, nombre))) puntaje += 50;

    return { ...p, _puntaje: puntaje };
  };

  // 1ª pasada: estricta (todo en el título)
  let resultados = productos
    .map(p => puntuar(p, true))
    .filter(Boolean)
    .sort((a, b) => b._puntaje - a._puntaje);

  // 2ª pasada: ampliada solo si hay pocos resultados
  if (resultados.length < 3) {
    const idsYa = new Set(resultados.map(p => p.id));
    const ampliados = productos
      .filter(p => !idsYa.has(p.id))
      .map(p => puntuar(p, false))
      .filter(Boolean)
      .sort((a, b) => b._puntaje - a._puntaje);
    resultados = [...resultados, ...ampliados];
  }

  return resultados;
}

// ── Descarga completa del catálogo ─────────────────────────────────────────────
async function descargarCatalogo() {
  // Construir la URL base: puede venir como URL completa del endpoint
  // o como dominio base (ej: https://mobilerepair.com.uy)
  // Variables de entorno: BASE_URL + /wp-json/wc/v3/products
  let baseUrl = (process.env.BASE_URL || '').trim();
  if (!baseUrl) {
    throw new Error(
      'BASE_URL no está definida en .env\n' +
      'Ejemplo: BASE_URL=https://www.mobilerepair.com.uy'
    );
  }
  // Agregar la ruta del endpoint WooCommerce
  if (!baseUrl.includes('/wp-json')) {
    baseUrl = baseUrl.replace(/\/$/, '') + '/wp-json/wc/v3/products';
  }

  const key    = process.env.CONSUMER_KEY    || '';
  const secret = process.env.CONSUMER_SECRET || '';

  if (!key || !secret) {
    throw new Error(
      'CONSUMER_KEY o CONSUMER_SECRET no están definidas en .env'
    );
  }

  let productos = [];
  let pagina    = 1;

  while (true) {
    const response = await axios.get(baseUrl, {
      auth: { username: key, password: secret },
      httpsAgent: agent,
      params: { per_page: 100, page: pagina, status: 'publish' },
    });

    productos = [...productos, ...response.data];
    if (response.data.length < 100) break;
    pagina++;
    if (pagina > 50) break; // límite de seguridad: 5 000 productos máx
  }

  return productos;
}

// ── Función principal exportada ────────────────────────────────────────────────
async function buscarProducto(query) {
  try {
    const palabrasClave = expandirQuery(query);

    if (palabrasClave.length === 0) return [];

    const productos  = await descargarCatalogo();
    const resultados = filtrarYPuntuar(productos, palabrasClave);

    // Limpiar campo interno antes de devolver
    return resultados.map(({ _puntaje, ...p }) => p);

  } catch (error) {
    console.error('Error WooCommerce:', error.response?.data || error.message);
    return [];
  }
}

module.exports = { buscarProducto };
