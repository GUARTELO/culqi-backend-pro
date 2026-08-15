
// ================================================================
// SERVICIO DEL CHATBOT - LÓGICA PRINCIPAL
// ================================================================
// Ubicación:
// src/services/chatbotService.js
//
// ================================================================
// AISLAMIENTO FIREBASE
// ================================================================
//
// ESTE SERVICIO NO UTILIZA:
//
//     admin.firestore()
//
// ESTE SERVICIO NO IMPORTA:
//
//     src/core/config/firebase.js
//
// ESTE SERVICIO UTILIZA EXCLUSIVAMENTE:
//
//     src/api/v1/chatbot/config/firebase.js
//
// Flujo:
//
// chatbotService.js
//        │
//        ├── ChatbotSession
//        │       │
//        │       └── chatbotFirebase.getFirestore()
//        │
//        └── chatbotFirebase.getFirestore()
//                │
//                ▼
//        admin.app('chatbot')
//                │
//                ▼
//             Firestore
//
// ================================================================
//
// IMPORTANTE:
//
// NO MODIFICAR:
//
//     src/core/config/firebase.js
//
// Ese archivo pertenece al sistema principal.
//
// ================================================================

const nodemailer = require('nodemailer');

const chatbotFirebase =
    require('../api/v1/chatbot/config/firebase');

const {
    ChatbotSession,
    normalizePhone
} = require('../models/chatbotSession');

// ================================================================
// FIRESTORE EXCLUSIVO DEL CHATBOT
// ================================================================
//
// Todas las consultas Firebase realizadas por este servicio
// pasan por la instancia:
//
//     admin.app('chatbot')
//
// a través de:
//
//     chatbotFirebase.getFirestore()
//
// ================================================================

const firestore =
    chatbotFirebase.getFirestore();

// ================================================================
// CONFIGURACIÓN
// ================================================================

const CONFIG = {

    COMPANY_NAME:
        'Brioni',

    COMPANY_EMAIL:
        'contacto@goldinfiniti.com',

    COMPANY_PHONE:
        '+51968786648',

    COMPANY_WHATSAPP:
        '51968786648',

    ADMIN_EMAIL:
        'admin@goldinfiniti.com',

    DOMAIN:
        'https://www.goldinfiniti.com'
};

// ================================================================
// PROCESAR MENSAJE - PRINCIPAL
// ================================================================

async function processMessage(
    message,
    phone,
    channel = 'web'
) {

    try {

        // ========================================================
        // VALIDACIÓN
        // ========================================================

        if (
            typeof message !== 'string' ||
            !message.trim()
        ) {

            return getMainMenu();
        }

        // ========================================================
        // LIMPIAR MENSAJE
        // ========================================================

        const cleanText =
            message
                .trim()
                .toLowerCase();

        // ========================================================
        // NORMALIZAR TELÉFONO
        // ========================================================

        const normalizedPhone =
            normalizePhone(phone);

        // ========================================================
        // LOG
        // ========================================================

        console.log(
            `[Chatbot] Mensaje de ${normalizedPhone} (${channel}): "${cleanText}"`
        );

        // ========================================================
        // SESIÓN
        // ========================================================

        const session =
            new ChatbotSession(
                normalizedPhone,
                channel
            );

        const userSession =
            await session.get();

        await session.incrementMessages();

        // ========================================================
        // 1. COMANDOS BÁSICOS
        // ========================================================

        if (
            [
                'hola',
                'menu',
                'inicio',
                'ayuda',
                'start'
            ].includes(cleanText)
        ) {

            await session.setStep('menu');

            return getMainMenu();
        }

        // ========================================================
        // 2. CONSULTAR PEDIDO
        // ========================================================

        if (
            cleanText.includes('pedido') ||
            cleanText.includes('orden') ||
            cleanText.includes('seguimiento') ||
            cleanText.includes('estado')
        ) {

            const match =
                cleanText.match(
                    /(br-?\d{4}-?\d{4})/i
                ) ||
                cleanText.match(
                    /(\d{4}-?\d{4})/
                );

            if (match) {

                const orderNumber =
                    match[1].toUpperCase();

                await session.updateContext({

                    orderId:
                        orderNumber,

                    waitingFor:
                        null
                });

                await session.setStep(
                    'order_tracking'
                );

                return await getOrderStatus(
                    orderNumber
                );
            }

            await session.setStep(
                'waiting_order'
            );

            await session.updateContext({

                waitingFor:
                    'order_number'
            });

            return (
                "📦 Para consultar tu pedido, necesito el número de orden.\n\n" +
                "*Ejemplo:* BR-2026-1234\n\n" +
                "_Escribe 'menu' para volver_"
            );
        }

        // ========================================================
        // 3. ESPERANDO NÚMERO DE PEDIDO
        // ========================================================

        if (
            userSession.step === 'waiting_order' ||
            userSession.context?.waitingFor ===
                'order_number'
        ) {

            const match =
                cleanText.match(
                    /(br-?\d{4}-?\d{4})/i
                ) ||
                cleanText.match(
                    /(\d{4}-?\d{4})/
                );

            if (match) {

                const orderNumber =
                    match[1].toUpperCase();

                await session.updateContext({

                    orderId:
                        orderNumber,

                    waitingFor:
                        null
                });

                await session.setStep(
                    'order_tracking'
                );

                return await getOrderStatus(
                    orderNumber
                );
            }

            return (
                "❌ No entendí el número de pedido.\n\n" +
                "Debe ser como: *BR-2026-1234*\n\n" +
                "_Escribe 'menu' para volver_"
            );
        }

        // ========================================================
        // 4. GUÍA DE TALLAS
        // ========================================================

        if (
            cleanText.includes('talla') ||
            cleanText.includes('medida') ||
            cleanText.includes('talle') ||
            cleanText.includes('como mido')
        ) {

            await session.setStep('menu');

            return getSizeGuide();
        }

        // ========================================================
        // 5. ENVÍOS
        // ========================================================

        if (
            cleanText.includes('envío') ||
            cleanText.includes('envio') ||
            cleanText.includes('entrega') ||
            cleanText.includes('domicilio') ||
            cleanText.includes('costo envio')
        ) {

            await session.setStep('menu');

            return getShippingInfo();
        }

        // ========================================================
        // 6. CAMBIOS Y DEVOLUCIONES
        // ========================================================

        if (
            cleanText.includes('cambio') ||
            cleanText.includes('devolución') ||
            cleanText.includes('devolucion') ||
            cleanText.includes('garantía') ||
            cleanText.includes('garantia')
        ) {

            await session.setStep('menu');

            return getReturnsPolicy();
        }

        // ========================================================
        // 7. MÉTODOS DE PAGO
        // ========================================================

        if (
            cleanText.includes('pago') ||
            cleanText.includes('pagar') ||
            cleanText.includes('tarjeta') ||
            cleanText.includes('yape') ||
            cleanText.includes('plin')
        ) {

            await session.setStep('menu');

            return getPaymentMethods();
        }

        // ========================================================
        // 8. ASESOR
        // ========================================================

        if (
            cleanText.includes('asesor') ||
            cleanText.includes('humano') ||
            cleanText.includes('persona') ||
            cleanText.includes('hablar') ||
            cleanText.includes('atencion') ||
            cleanText.includes('contacto')
        ) {

            await session.setStep('menu');

            return await transferToHuman(
                normalizedPhone
            );
        }

        // ========================================================
        // 9. BUSCAR PRODUCTOS
        // ========================================================

        if (cleanText.length > 3) {

            const result =
                await searchProducts(
                    cleanText
                );

            if (
                !result.includes('No encontré')
            ) {

                await session.updateContext({

                    lastQuery:
                        cleanText
                });

                return result;
            }
        }

        // ========================================================
        // 10. RESPUESTA POR DEFECTO
        // ========================================================

        return getMainMenu();

    } catch (error) {

        console.error(
            '[ChatbotService] Error en processMessage:',
            error.message
        );

        return (
            '⚠️ Ocurrió un error. Por favor, escribe "menu" para volver a empezar.'
        );
    }
}

// ================================================================
// CONSULTAR PEDIDO EN FIRESTORE DEL CHATBOT
// ================================================================
//
// IMPORTANTE:
//
// Antes:
//
//     admin.firestore()
//
// AHORA:
//
//     firestore
//
// Y firestore proviene de:
//
//     chatbotFirebase.getFirestore()
//
// ================================================================

async function getOrderStatus(
    orderNumber
) {

    try {

        console.log(
            `[Chatbot] Consultando pedido: ${orderNumber}`
        );

        // ========================================================
        // SOLO LECTURA
        // ========================================================

        const ordersRef =
            firestore
                .collection('ordenes');

        const snapshot =
            await ordersRef
                .where(
                    'numeroOrden',
                    '==',
                    orderNumber
                )
                .limit(1)
                .get();

        // ========================================================
        // PEDIDO NO ENCONTRADO
        // ========================================================

        if (snapshot.empty) {

            return (
                `❌ No encontré el pedido *${orderNumber}*.\n\n` +
                `🔍 Verifica el número o revisa tu correo de confirmación.\n\n` +
                `🌐 También puedes consultar en: ${CONFIG.DOMAIN}/mi-cuenta/pedidos\n\n` +
                `_Escribe 'menu' para volver_`
            );
        }

        // ========================================================
        // OBTENER PEDIDO
        // ========================================================

        let order = null;

        snapshot.forEach(doc => {

            order = {

                id:
                    doc.id,

                ...doc.data()
            };
        });

        // ========================================================
        // MAPA DE ESTADOS
        // ========================================================

        const statusMap = {

            pending:
                '⏳ Pendiente de pago',

            processing:
                '🔄 En procesamiento',

            shipped:
                '🚚 En camino',

            delivered:
                '✅ Entregado',

            cancelled:
                '❌ Cancelado'
        };

        const estado =
            order.estado ||
            order.status ||
            'pending';

        // ========================================================
        // RESPUESTA
        // ========================================================

        let response =
            `📦 *ESTADO DE PEDIDO*\n\n`;

        response +=
            `🔢 Orden: ${order.numeroOrden || order.id}\n`;

        response +=
            `📊 Estado: ${statusMap[estado] || estado}\n`;

        response +=
            `💰 Total: S/${order.resumen?.total || 0}\n`;

        response +=
            `📦 Items: ${order.productos?.length || 0}\n`;

        // ========================================================
        // GUÍA
        // ========================================================

        if (order.envio?.guia) {

            response +=
                `📮 Guía: ${order.envio.guia}\n`;
        }

        // ========================================================
        // MENSAJE SEGÚN ESTADO
        // ========================================================

        if (estado === 'shipped') {

            response +=
                `\n📍 Tu pedido está en camino 🚚`;

        } else if (estado === 'delivered') {

            response +=
                `\n✅ Pedido entregado. ¡Disfruta tu compra!`;

        } else if (estado === 'pending') {

            response +=
                `\n⏳ Completa el pago para procesar tu pedido.`;
        }

        response +=
            `\n\n_¿Necesitas más ayuda? Escribe 'menu'_`;

        return response;

    } catch (error) {

        console.error(
            '[ChatbotService] Error en getOrderStatus:',
            error.message
        );

        return (
            '⚠️ Error al consultar el pedido. Intenta de nuevo más tarde.'
        );
    }
}

// ================================================================
// BUSCAR PRODUCTOS EN FIRESTORE DEL CHATBOT
// ================================================================
//
// IMPORTANTE:
//
// Antes:
//
//     admin.firestore()
//
// Ahora:
//
//     firestore
//
// ================================================================

async function searchProducts(
    query
) {

    try {

        console.log(
            `[Chatbot] Buscando productos: "${query}"`
        );

        // ========================================================
        // SOLO LECTURA
        // ========================================================

        const productsRef =
            firestore
                .collection('productos');

        const snapshot =
            await productsRef
                .limit(20)
                .get();

        // ========================================================
        // PROCESAR RESULTADOS
        // ========================================================

        const results = [];

        snapshot.forEach(doc => {

            const data =
                doc.data();

            const name =
                data.nombre || '';

            if (
                name
                    .toLowerCase()
                    .includes(
                        query.toLowerCase()
                    )
            ) {

                results.push({

                    id:
                        doc.id,

                    ...data
                });
            }
        });

        // ========================================================
        // SIN RESULTADOS
        // ========================================================

        if (results.length === 0) {

            return (
                `🔍 No encontré productos para *"${query}"*.\n\n` +
                `📌 Sugerencias:\n` +
                `• Revisa la ortografía\n` +
                `• Prueba con términos más generales\n` +
                `• Visita nuestra web: ${CONFIG.DOMAIN}\n\n` +
                `_Escribe 'menu' para volver_`
            );
        }

        // ========================================================
        // RESPUESTA
        // ========================================================

        let response =
            `🔍 *BÚSQUEDA: "${query}"*\n\n`;

        const maxResults =
            Math.min(
                results.length,
                5
            );

        // ========================================================
        // PRODUCTOS
        // ========================================================

        for (
            let i = 0;
            i < maxResults;
            i++
        ) {

            const p =
                results[i];

            const stock =
                p.stock || 0;

            const status =
                stock > 0
                    ? '✅ Disponible'
                    : '❌ Agotado';

            const categoryEmoji = {

                hombre:
                    '👨',

                mujer:
                    '👩',

                ninos:
                    '👶',

                accesorios:
                    '👔'

            }[
                p.categoria
            ] || '📦';

            response +=
                `${i + 1}. *${p.nombre}*\n`;

            response +=
                `   ${categoryEmoji} ${p.categoria || 'General'} | 💰 S/${p.precio || 0}\n`;

            response +=
                `   📦 ${status}`;

            if (
                stock > 0 &&
                stock < 5
            ) {

                response +=
                    ` ⚠️ ¡Últimas ${stock} unidades!`;
            }

            response +=
                `\n\n`;
        }

        // ========================================================
        // MÁS RESULTADOS
        // ========================================================

        if (results.length > 5) {

            response +=
                `_Y ${results.length - 5} productos más..._\n\n`;
        }

        response +=
            `🌐 Ver todos: ${CONFIG.DOMAIN}/search?q=${encodeURIComponent(query)}\n\n`;

        response +=
            `_Responde con el número del producto para más detalles_`;

        return response;

    } catch (error) {

        console.error(
            '[ChatbotService] Error en searchProducts:',
            error.message
        );

        return (
            '⚠️ Error al buscar productos. Intenta de nuevo.'
        );
    }
}

// ================================================================
// TRANSFERIR A ASESOR
// ================================================================
// ABRE WHATSAPP + NOTIFICA ADMIN
// ================================================================

async function transferToHuman(
    phone
) {

    try {

        console.log(
            `[Chatbot] Transferiendo a asesor: ${phone}`
        );

        // ========================================================
        // CREAR TRANSPORTER
        // ========================================================

        const transporter =
            nodemailer.createTransporter({

                service:
                    'gmail',

                auth: {

                    user:
                        process.env.EMAIL_USER,

                    pass:
                        process.env.EMAIL_PASS
                }
            });

        // ========================================================
        // NOTIFICAR ADMIN
        // ========================================================

        await transporter.sendMail({

            from:
                process.env.EMAIL_USER,

            to:
                CONFIG.ADMIN_EMAIL,

            subject:
                '👤 Solicitud de atención - Chat Asistente Brioni',

            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                        }

                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                        }

                        .header {
                            background: #075E54;
                            color: white;
                            padding: 15px;
                            border-radius: 8px 8px 0 0;
                        }

                        .content {
                            background: #f5f5f5;
                            padding: 20px;
                            border-radius: 0 0 8px 8px;
                        }

                        .info {
                            background: white;
                            padding: 15px;
                            border-radius: 8px;
                            margin: 10px 0;
                        }

                        .btn {
                            display: inline-block;
                            background: #25D366;
                            color: white;
                            padding: 10px 20px;
                            border-radius: 5px;
                            text-decoration: none;
                        }
                    </style>
                </head>

                <body>

                    <div class="container">

                        <div class="header">

                            <h2>
                                👤 Cliente solicita atención personalizada
                            </h2>

                        </div>

                        <div class="content">

                            <div class="info">

                                <p>
                                    <strong>📱 Teléfono:</strong>
                                    ${phone || 'No disponible'}
                                </p>

                                <p>
                                    <strong>📅 Fecha:</strong>
                                    ${new Date().toLocaleString('es-PE')}
                                </p>

                                <p>
                                    <strong>🌐 Origen:</strong>
                                    Chat web Brioni
                                </p>

                            </div>

                            <p style="margin-top: 20px;">

                                <a
                                    href="https://wa.me/${phone || CONFIG.COMPANY_WHATSAPP}"
                                    class="btn"
                                    target="_blank"
                                >
                                    💬 Responder por WhatsApp
                                </a>

                            </p>

                            <p
                                style="
                                    font-size: 12px;
                                    color: #888;
                                    margin-top: 20px;
                                "
                            >
                                Este mensaje fue generado automáticamente
                                por el asistente virtual Brioni.
                            </p>

                        </div>

                    </div>

                </body>
                </html>
            `
        });

        console.log(
            '[ChatbotService] Email de notificación enviado'
        );

        // ========================================================
        // RESPUESTA AL USUARIO
        // ========================================================

        return (
            `👤 *ATENCIÓN PERSONALIZADA*\n\n` +
            `Un asesor te atenderá en breve.\n\n` +
            `📱 *WhatsApp*: https://wa.me/${CONFIG.COMPANY_WHATSAPP}?text=Hola%2C%20necesito%20ayuda\n` +
            `📞 *Teléfono*: ${CONFIG.COMPANY_PHONE}\n` +
            `📧 *Email*: ${CONFIG.COMPANY_EMAIL}\n\n` +
            `⏰ *Horario de atención*: Lunes a Viernes 9am - 6pm\n\n` +
            `🌐 *Web*: ${CONFIG.DOMAIN}\n\n` +
            `_Escribe 'menu' para volver al inicio_`
        );

    } catch (error) {

        console.error(
            '[ChatbotService] Error en transferToHuman:',
            error.message
        );

        return (
            `👤 *ATENCIÓN PERSONALIZADA*\n\n` +
            `📱 *WhatsApp*: https://wa.me/${CONFIG.COMPANY_WHATSAPP}\n` +
            `📞 *Teléfono*: ${CONFIG.COMPANY_PHONE}\n` +
            `📧 *Email*: ${CONFIG.COMPANY_EMAIL}\n\n` +
            `⏰ L-V 9am-6pm\n\n` +
            `_Escribe 'menu' para volver_`
        );
    }
}

// ================================================================
// RESPUESTAS ESTÁTICAS
// ================================================================

// ================================================================
// MENÚ PRINCIPAL
// ================================================================

function getMainMenu() {

    return (
        `🤖 *ASISTENTE BRIONI*\n\n` +
        `¿En qué puedo ayudarte?\n\n` +
        `📦 *Pedidos* - Consulta el estado de tu orden\n` +
        `📏 *Tallas* - Guía de tallas completa\n` +
        `🚚 *Envíos* - Costos y tiempos de entrega\n` +
        `🔄 *Cambios* - Política de cambios y devoluciones\n` +
        `💳 *Pagos* - Métodos de pago disponibles\n` +
        `👤 *Asesor* - Hablar con un humano\n\n` +
        `🔍 *Buscar producto* - Escribe el nombre de lo que buscas\n\n` +
        `📌 *Ejemplos:*\n` +
        `• "pedido BR-2026-1234"\n` +
        `• "tallas"\n` +
        `• "blazer"\n` +
        `• "envío Lima"\n\n` +
        `_Escribe 'menu' en cualquier momento_`
    );
}

// ================================================================
// GUÍA DE TALLAS
// ================================================================

function getSizeGuide() {

    return (
        `📏 *GUÍA DE TALLAS BRIONI*\n\n` +
        `👨 *HOMBRE*\n` +
        `S: 38-40 | M: 40-42 | L: 42-44 | XL: 44-46\n\n` +
        `👩 *MUJER*\n` +
        `S: 34-36 | M: 36-38 | L: 38-40 | XL: 40-42\n\n` +
        `👶 *NIÑOS*\n` +
        `4-6 | 6-8 | 8-10 | 10-12\n\n` +
        `📐 *¿Cómo medirte?*\n` +
        `• Pecho: alrededor de la parte más ancha\n` +
        `• Cintura: alrededor de la cintura natural\n` +
        `• Cadera: alrededor de la parte más ancha\n\n` +
        `🌐 Guía completa: ${CONFIG.DOMAIN}/guia-de-tallas\n\n` +
        `_Escribe 'menu' para volver_`
    );
}

// ================================================================
// INFORMACIÓN DE ENVÍOS
// ================================================================

function getShippingInfo() {

    return (
        `🚚 *INFORMACIÓN DE ENVÍOS*\n\n` +
        `📦 *LIMA Y CALLAO*\n` +
        `• Envío a domicilio: S/7.00\n` +
        `• Entrega: 24 horas (L-V 9am-6pm)\n\n` +
        `📦 *PROVINCIAS*\n` +
        `• Envío por Olva/Shalom: S/15.00\n` +
        `• Entrega: 2-4 días hábiles\n\n` +
        `🆓 *ENVÍO GRATIS*\n` +
        `En compras mayores a S/200\n\n` +
        `📍 *RETIRO EN TIENDA*\n` +
        `Santa Anita - Lima (sin costo)\n\n` +
        `_Escribe 'menu' para volver_`
    );
}

// ================================================================
// CAMBIOS Y DEVOLUCIONES
// ================================================================

function getReturnsPolicy() {

    return (
        `🔄 *POLÍTICA DE CAMBIOS Y DEVOLUCIONES*\n\n` +
        `✅ *Plazo:* Hasta 30 días después de la compra\n` +
        `✅ *Condiciones:* Producto sin usar y con etiquetas\n` +
        `✅ *Documentación:* Presentar boleta o factura\n\n` +
        `📍 *Cambios en tienda:*\n` +
        `Santa Anita - Lima (sin costo)\n\n` +
        `📦 *Cambios por envío:*\n` +
        `Costo de envío adicional\n\n` +
        `🌐 Más información: ${CONFIG.DOMAIN}/cambios-y-devoluciones\n\n` +
        `_Escribe 'menu' para volver_`
    );
}

// ================================================================
// MÉTODOS DE PAGO
// ================================================================

function getPaymentMethods() {

    return (
        `💳 *MÉTODOS DE PAGO*\n\n` +
        `Aceptamos:\n\n` +
        `💳 *Tarjetas de crédito/débito*\n` +
        `• Visa\n` +
        `• Mastercard\n` +
        `• American Express\n` +
        `• Diners Club\n\n` +
        `📱 *Billeteras digitales*\n` +
        `• Yape\n` +
        `• Plin\n` +
        `• Tunki\n\n` +
        `🏦 *Transferencia bancaria*\n` +
        `• BCP\n` +
        `• Interbank\n` +
        `• BBVA\n\n` +
        `🔐 *Seguridad:* Todos los pagos son seguros (SSL)\n\n` +
        `🌐 Más info: ${CONFIG.DOMAIN}/formadepago\n\n` +
        `_Escribe 'menu' para volver_`
    );
}

// ================================================================
// EXPORTAR
// ================================================================

module.exports = {

    processMessage,

    getOrderStatus,

    searchProducts,

    transferToHuman,

    getMainMenu,

    getSizeGuide,

    getShippingInfo,

    getReturnsPolicy,

    getPaymentMethods
};
