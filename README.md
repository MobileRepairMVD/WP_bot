# MobileBot - Bot de WhatsApp para MobileRepair

MobileBot es un **bot de WhatsApp** diseñado para **MobileRepair**, una tienda de repuestos y reparación de celulares y computadoras en Montevideo, Uruguay. El bot permite:

- Atender consultas de clientes automáticamente.
- Buscar productos en el catálogo de WooCommerce.
- Consultar el estado de tickets de servicio técnico.
- Coordinar servicio de cadete para retiro y entrega de equipos.

---

## 📦 Tecnologías utilizadas

- **Node.js** (v18+ recomendado)
- **npm** para manejo de dependencias
- **whatsapp-web.js** para integración con WhatsApp Web
- **axios** para llamadas HTTP a APIs externas
- **dotenv** para gestión de variables de entorno
- **Groq API** para procesamiento de lenguaje natural con IA (modelo Llama-3.1)
- WooCommerce REST API para consulta de productos
- Servicio propio de tickets de soporte técnico

---

## 🔑 Configuración del entorno

1. Crear un archivo `.env.local` basado en `.env.example`:

```env
GROQ_API_KEY=TU_CLAVE_REAL_DE_GROQ
BASE_URL=https://www.mobilerepair.com.uy
CONSUMER_KEY=TU_CONSUMER_KEY
CONSUMER_SECRET=TU_CONSUMER_SECRET
SERVICE_API_URL=https://api.mobilerepair.com.uy/tickets
SERVICE_API_KEY=TU_API_KEY_DEL_SERVICIO

⚙️ Instalación

Clonar la repo desde Gitea:

git clone https://www.mobilerepair.com.uy/git/robin/WP_bot.git
cd wpbot

Instalar dependencias:

npm install

Probar conexión con Groq API:

node
> const { warmUp } = require('./ollamaClient');
> warmUp();

Probar búsqueda de productos WooCommerce:

node
> const { buscarProducto } = require('./searchEngine');
> buscarProducto("pantalla iphone 11").then(console.log);

Probar consulta de tickets de servicio técnico:

node
> const { ticketExiste, consultarEstado } = require('./serviceStatus');
> ticketExiste(123).then(console.log);
> consultarEstado(123, "apellido_cliente").then(console.log);
🚀 Arranque del bot

Iniciar bot de WhatsApp:

node index.js

Al iniciarse, el bot mostrará un QR en la terminal.

Escanearlo con la app de WhatsApp para vincular la cuenta.

Opcional: Ejecutar el bot en segundo plano con PM2:

npm install -g pm2
pm2 start index.js --name wpbot
pm2 logs wpbot --lines 50
pm2 save
pm2 startup

🛠️ Estructura de archivos
Archivo	Función
index.js	Archivo principal que inicia el bot
ollamaClient.js	Conexión con Groq API e IA del bot
searchEngine.js	Funciones de búsqueda de productos WooCommerce
serviceStatus.js	Consulta y verificación de tickets de servicio técnico
.env / .env.local	Variables sensibles (API keys, URLs)
package.json	Manejo de dependencias y scripts
.gitignore	Ignora archivos sensibles como .env y logs
