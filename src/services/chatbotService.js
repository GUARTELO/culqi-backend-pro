// ================================================================
// SERVICIO DEL CHATBOT - LÓGICA PRINCIPAL
// ================================================================
// Ubicación:
// src/services/chatbotService.js
//
// ================================================================
// BRIONI CHATBOT - VERSIÓN PROFESIONAL
// ================================================================
//
// RESPONSABILIDAD:
//
// Este servicio pertenece EXCLUSIVAMENTE al chatbot.
//
// NO administra:
//   - Pagos
//   - Culqi
//   - Órdenes
//   - Correlativos
//   - Inventario
//   - Firebase principal
//   - CERBERUS
//
// El chatbot únicamente:
//
//   1. Gestiona conversaciones.
//   2. Consulta información.
//   3. Consulta pedidos en modo SOLO LECTURA.
//   4. Busca productos en modo SOLO LECTURA.
//   5. Facilita contacto con un asesor.
//
// ================================================================
//
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

'use strict';

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
// Todas las operaciones Firebase de este servicio pasan por:
//
//     chatbotFirebase.getFirestore()
//
// El chatbot NO crea otra instancia de Firebase.
// El chatbot NO utiliza admin.firestore().
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
        'https://www.goldinfiniti.com',

    URLS: {

        ORDERS:
            '/pedidos.html',

        SIZE_GUIDE:
            '/guia_de_tallas.html',

        RETURNS:
            '/politica-de-cambios-y-devoluciones.html',

        PAYMENTS:
            '/formadepago.html',

        WHATSAPP_PAGE:
            '/whatsapp.html',

        SEARCH:
            '/'
    },

    // ============================================================
    // LÍMITES DEL CHATBOT
    // ============================================================

    MAX_PRODUCT_SCAN:
        20,

    MAX_PRODUCT_RESULTS:
        5,

    MAX_ORDER_LENGTH:
        20
};

// ================================================================
// UTILIDADES INTERNAS
// ================================================================

/**
 * Construye una URL absoluta utilizando el dominio oficial.
 */
function buildUrl(path) {

    if (
        typeof path !== 'string' ||
        !path.trim()
    ) {

        return CONFIG.DOMAIN;
    }

    return (
        CONFIG.DOMAIN.replace(/\/$/, '') +
        '/' +
        path.replace(/^\//, '')
    );
}

/**
 * Normaliza texto para comparaciones internas.
 */
function normalizeText(value) {

    if (
        typeof value !== 'string'
    ) {

        return '';
    }

    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza un número de orden.
 *
 * FORMATO OFICIAL:
 *
 *     ORD-YYYYMM-NNNN
 *
 * Ejemplo:
 *
 *     ORD-202608-0029
 *
 * IMPORTANTE:
 *
 * El chatbot NO genera correlativos.
 * Solo valida y normaliza el valor recibido.
 */
function normalizeOrderNumber(value) {

    if (
        typeof value !== 'string'
    ) {

        return null;
    }

    const normalized =
        value
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '');

    if (
        normalized.length >
        CONFIG.MAX_ORDER_LENGTH
    ) {

        return null;
    }

    const match =
        normalized.match(
            /^ORD-(\d{6})-(\d{4})$/
        );

    if (!match) {

        return null;
    }

    return (
        `ORD-${match[1]}-${match[2]}`
    );
}

/**
 * Extrae un correlativo válido desde un mensaje.
 *
 * Acepta:
 *
 *     ORD-202608-0029
 *     ord-202608-0029
 *
 * No acepta formatos antiguos como:
 *
 *     BR-2026-1234
 *
 * porque el correlativo REAL del sistema es:
 *
 *     ORD-YYYYMM-NNNN
 */
function extractOrderNumber(text) {

    if (
        typeof text !== 'string'
    ) {

        return null;
    }

    const match =
        text.match(
            /ORD-\d{6}-\d{4}/i
        );

    if (!match) {

        return null;
    }

    return normalizeOrderNumber(
        match[0]
    );
}

/**
 * Normaliza estados provenientes de Firestore.
 */
function normalizeStatus(value) {

    if (
        typeof value !== 'string'
    ) {

        return '';
    }

    return normalizeText(value);
}

/**
 * Convierte estados reales de envío a una respuesta profesional.
 */
function getShippingStatusLabel(status) {

    const normalized =
        normalizeStatus(status);

    const statusMap = {

        pendiente:
            '⏳ Pendiente',

        procesando:
            '🔄 En procesamiento',

        proceso:
            '🔄 En procesamiento',

        preparado:
            '📦 Pedido preparado',

        listo:
            '📦 Pedido listo para despacho',

        enviado:
            '🚚 En camino',

        despacho:
            '🚚 En despacho',

        entregado:
            '✅ Entregado',

        cancelado:
            '❌ Cancelado',

        devuelto:
            '↩️ Devuelto',

        rechazado:
            '❌ Rechazado'
    };

    return (
        statusMap[normalized] ||
        `ℹ️ ${status || 'No disponible'}`
    );
}

/**
 * Convierte estados reales de pago a una respuesta profesional.
 */
function getPaymentStatusLabel(status) {

    const normalized =
        normalizeStatus(status);

    const statusMap = {

        completado:
            '✅ Completado',

        aprobado:
            '✅ Aprobado',

        pagado:
            '✅ Pagado',

        pendiente:
            '⏳ Pendiente',

        procesando:
            '🔄 Procesando',

        rechazado:
            '❌ Rechazado',

        cancelado:
            '❌ Cancelado',

        fallido:
            '❌ Fallido'
    };

    return (
        statusMap[normalized] ||
        `ℹ️ ${status || 'No disponible'}`
    );
}

/**
 * Escapa valores que serán insertados en HTML.
 *
 * Se utiliza para evitar que información proveniente
 * del usuario termine interpretándose como HTML.
 */
function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Formatea un monto monetario.
 */
function formatMoney(value) {

    const amount =
        Number(value);

    if (
        !Number.isFinite(amount)
    ) {

        return 'S/0.00';
    }

    return (
        `S/${amount.toFixed(2)}`
    );
}

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
            normalizeText(message);

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

            await session.setStep(
                'menu'
            );

            return getMainMenu();
        }

       // ========================================================
// 2. EXTRAER CORRELATIVO DEL MENSAJE
// ========================================================

const detectedOrder =
    extractOrderNumber(
        message
    );

// ========================================================
// DETECTAR CORRELATIVO CON FORMATO INVÁLIDO
// ========================================================
//
// IMPORTANTE:
//
// Solo detectamos entradas que claramente parecen
// números de orden.
//
// Esto evita que una búsqueda normal de productos
// sea interpretada como un pedido.
//
// Ejemplos detectados:
//
//     BR-2026-1234
//     ORD-2026-0029
//     ORD-202608-29
//     ORD-202608-99999
//
// Ejemplo que NO se interfiere:
//
//     polo negro
//     polo premium
//     camisa blanca
//
// ========================================================

const looksLikeInvalidOrderNumber =
    /(?:^|\s)(?:BR-\d{4}-\d{4}|ORD-[^\s]*)(?:\s|$)/i.test(
        message.trim()
    );

if (
    looksLikeInvalidOrderNumber &&
    !detectedOrder
) {

    return (
        `❌ *CORRELATIVO NO VÁLIDO*\n\n` +
        `El número de orden debe tener este formato:\n\n` +
        `*ORD-202608-0029*\n\n` +
        `Por favor, revisa tu correo o confirmación de compra ` +
        `y vuelve a escribir el correlativo.\n\n` +
        `_Escribe "menu" para volver_`
    );
}

// ========================================================
// CORRELATIVO VÁLIDO
// ========================================================

if (detectedOrder) {

    await session.updateContext({

        orderId:
            detectedOrder,

        waitingFor:
            null
    });

    await session.setStep(
        'order_tracking'
    );

    return await getOrderStatus(
        detectedOrder
    );
}
        // ========================================================
        // 3. CONSULTAR PEDIDO
        // ========================================================

        if (
            cleanText.includes('pedido') ||
            cleanText.includes('orden') ||
            cleanText.includes('seguimiento') ||
            cleanText.includes('estado') ||
            cleanText.includes('mi pedido') ||
            cleanText.includes('mis pedidos')
        ) {

            await session.setStep(
                'waiting_order'
            );

            await session.updateContext({

                waitingFor:
                    'order_number'
            });

            return (
                `📦 *CONSULTA DE PEDIDO*\n\n` +
                `Para consultar el estado real de tu pedido, ` +
                `necesito tu número de orden.\n\n` +
                `🔢 *Ejemplo:*\n` +
                `ORD-202608-0029\n\n` +
                `Escribe el correlativo exactamente como aparece ` +
                `en tu confirmación de compra.\n\n` +
                `_Escribe "menu" para volver al inicio_`
            );
        }

        // ========================================================
        // 4. ESPERANDO CORRELATIVO
        // ========================================================

        if (
            userSession.step ===
                'waiting_order' ||
            userSession.context?.waitingFor ===
                'order_number'
        ) {

            const orderNumber =
                extractOrderNumber(
                    message
                );

            if (orderNumber) {

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
                `❌ *CORRELATIVO NO VÁLIDO*\n\n` +
                `El número de orden debe tener este formato:\n\n` +
                `*ORD-202608-0029*\n\n` +
                `Por favor, revisa tu correo o confirmación de compra ` +
                `y vuelve a escribir el correlativo.\n\n` +
                `_Escribe "menu" para volver_`
            );
        }

        // ========================================================
        // 5. GUÍA DE TALLAS
        // ========================================================

        if (
            cleanText.includes('talla') ||
            cleanText.includes('medida') ||
            cleanText.includes('talle') ||
            cleanText.includes('como mido')
        ) {

            await session.setStep(
                'menu'
            );

            return getSizeGuide();
        }

        // ========================================================
        // 6. ENVÍOS
        // ========================================================

        if (
            cleanText.includes('envio') ||
            cleanText.includes('entrega') ||
            cleanText.includes('domicilio') ||
            cleanText.includes('costo envio')
        ) {

            await session.setStep(
                'menu'
            );

            return getShippingInfo();
        }

        // ========================================================
        // 7. CAMBIOS Y DEVOLUCIONES
        // ========================================================

        if (
            cleanText.includes('cambio') ||
            cleanText.includes('devolucion') ||
            cleanText.includes('garantia')
        ) {

            await session.setStep(
                'menu'
            );

            return getReturnsPolicy();
        }

        // ========================================================
        // 8. MÉTODOS DE PAGO
        // ========================================================

        if (
            cleanText.includes('pago') ||
            cleanText.includes('pagar') ||
            cleanText.includes('tarjeta') ||
            cleanText.includes('yape') ||
            cleanText.includes('plin')
        ) {

            await session.setStep(
                'menu'
            );

            return getPaymentMethods();
        }

        // ========================================================
        // 9. ASESOR
        // ========================================================

        if (
            cleanText.includes('asesor') ||
            cleanText.includes('humano') ||
            cleanText.includes('persona') ||
            cleanText.includes('hablar') ||
            cleanText.includes('atencion') ||
            cleanText.includes('contacto')
        ) {

            await session.setStep(
                'menu'
            );

            return await transferToHuman(
                normalizedPhone
            );
        }

        // ========================================================
        // 10. BUSCAR PRODUCTOS
        // ========================================================

        if (
            cleanText.length > 3
        ) {

            const result =
                await searchProducts(
                    cleanText
                );

            if (
                !result.includes(
                    'No encontré productos'
                )
            ) {

                await session.updateContext({

                    lastQuery:
                        cleanText
                });

                return result;
            }
        }

        // ========================================================
        // 11. RESPUESTA POR DEFECTO
        // ========================================================

        return getMainMenu();

    } catch (error) {

        console.error(
            '[ChatbotService] Error en processMessage:',
            error
        );

        return (
            `⚠️ Ocurrió un problema temporal con el asistente.\n\n` +
            `Por favor, escribe *"menu"* para volver a empezar.`
        );
    }
}

// ================================================================
// CONSULTAR PEDIDO
// ================================================================
//
// IMPORTANTE:
//
// Esta función:
//
//     NO MODIFICA LA ORDEN.
//
//     NO MODIFICA EL ESTADO.
//
//     NO MODIFICA EL PAGO.
//
//     NO MODIFICA EL ENVÍO.
//
//     NO GENERA CORRELATIVOS.
//
//     NO UTILIZA EL EMAIL COMO IDENTIFICADOR.
//
//     NO UTILIZA EL TELÉFONO COMO IDENTIFICADOR.
//
// Busca EXCLUSIVAMENTE:
//
//     numeroOrden
//
// ================================================================

async function getOrderStatus(
    orderNumber
) {

    try {

        // ========================================================
        // VALIDAR CORRELATIVO
        // ========================================================

        const normalizedOrder =
            normalizeOrderNumber(
                orderNumber
            );

        if (!normalizedOrder) {

            return (
                `❌ El número de orden no tiene un formato válido.\n\n` +
                `Ejemplo: *ORD-202608-0029*`
            );
        }

        console.log(
            `[Chatbot] Consultando pedido por numeroOrden: ${normalizedOrder}`
        );

        // ========================================================
        // COLECCIÓN DE ÓRDENES
        // ========================================================

        const ordersRef =
            firestore
                .collection('ordenes');

        // ========================================================
        // CONSULTA EXCLUSIVA POR CORRELATIVO
        // ========================================================
        //
        // SOLO LECTURA.
        //
        // No se utiliza:
        //
        //     email
        //     DNI
        //     teléfono
        //     culqi_id
        //     metadata.orderId
        //     firebaseDocId
        //
        // El identificador conversacional es:
        //
        //     numeroOrden
        //
        // ========================================================

        const snapshot =
            await ordersRef
                .where(
                    'numeroOrden',
                    '==',
                    normalizedOrder
                )
                .limit(1)
                .get();

        // ========================================================
        // PEDIDO NO ENCONTRADO
        // ========================================================

        if (
            snapshot.empty
        ) {

            console.log(
                `[Chatbot] Pedido no encontrado: ${normalizedOrder}`
            );

            return (
                `❌ *PEDIDO NO ENCONTRADO*\n\n` +
                `No encontré ninguna orden asociada al correlativo:\n\n` +
                `🔢 *${normalizedOrder}*\n\n` +
                `Verifica que el número sea exactamente el mismo ` +
                `que aparece en tu confirmación de compra.\n\n` +
                `🌐 También puedes revisar tus pedidos aquí:\n` +
                `${buildUrl(CONFIG.URLS.ORDERS)}\n\n` +
                `_Escribe "menu" para volver al inicio_`
            );
        }

        // ========================================================
        // OBTENER DOCUMENTO
        // ========================================================

        const doc =
            snapshot.docs[0];

        const order = {

            id:
                doc.id,

            ...doc.data()
        };

        // ========================================================
        // ESTADOS REALES
        // ========================================================
        //
        // TU FIRESTORE REAL UTILIZA:
        //
        //     envio.estado
        //
        // para el estado logístico.
        //
        // Y:
        //
        //     pago.estado
        //
        // para el estado del pago.
        //
        // NO SE UTILIZA:
        //
        //     order.estado
        //
        // como fuente principal.
        //
        // ========================================================

        const estadoPedido =
            order.envio?.estado ||
            'pendiente';

        const estadoPago =
            order.pago?.estado ||
            'pendiente';

        // ========================================================
        // ESTADOS PRESENTADOS AL USUARIO
        // ========================================================

        const shippingLabel =
            getShippingStatusLabel(
                estadoPedido
            );

        const paymentLabel =
            getPaymentStatusLabel(
                estadoPago
            );

        // ========================================================
        // PRODUCTOS
        // ========================================================

        const productos =
            Array.isArray(
                order.productos
            )
                ? order.productos
                : [];

        // ========================================================
        // RESUMEN
        // ========================================================

        const resumen =
            order.resumen || {};

        const total =
            resumen.total ??
            order.pago?.monto ??
            0;

        const cantidadItems =
            resumen.cantidadItems ??
            productos.reduce(
                (totalItems, producto) => {

                    const cantidad =
                        Number(
                            producto.cantidad ??
                            producto.quantity ??
                            1
                        );

                    return (
                        totalItems +
                        (
                            Number.isFinite(
                                cantidad
                            )
                                ? cantidad
                                : 0
                        )
                    );
                },
                0
            );

        // ========================================================
        // RESPUESTA PRINCIPAL
        // ========================================================

        let response =
            `📦 *ESTADO DE TU PEDIDO*\n\n`;

        response +=
            `🔢 *Orden:* ${normalizedOrder}\n\n`;

        response +=
            `🚚 *Estado del pedido:* ${shippingLabel}\n`;

        response +=
            `💳 *Estado del pago:* ${paymentLabel}\n\n`;

        // ========================================================
        // PRODUCTOS
        // ========================================================

        if (
            productos.length > 0
        ) {

            response +=
                `🛍️ *PRODUCTOS*\n\n`;

            const productsToShow =
                productos.slice(
                    0,
                    5
                );

            productsToShow.forEach(
                (producto, index) => {

                    const nombre =
                        producto.nombre ||
                        producto.titulo ||
                        'Producto';

                    const cantidad =
                        producto.cantidad ??
                        producto.quantity ??
                        1;

                    const talla =
                        producto.talla ||
                        producto.size ||
                        '';

                    const color =
                        producto.color ||
                        '';

                    response +=
                        `${index + 1}. *${nombre}*\n`;

                    response +=
                        `   Cantidad: ${cantidad}\n`;

                    if (talla) {

                        response +=
                            `   Talla: ${talla}\n`;
                    }

                    if (color) {

                        response +=
                            `   Color: ${color}\n`;
                    }

                    response +=
                        `\n`;
                }
            );
        }

        // ========================================================
        // RESUMEN ECONÓMICO
        // ========================================================

        response +=
            `💰 *RESUMEN*\n\n`;

        response +=
            `• Productos: ${cantidadItems}\n`;

        if (
            resumen.subtotal !== undefined
        ) {

            response +=
                `• Subtotal: ${formatMoney(resumen.subtotal)}\n`;
        }

        if (
            resumen.envio !== undefined
        ) {

            response +=
                `• Envío: ${formatMoney(resumen.envio)}\n`;
        }

        response +=
            `• *Total: ${formatMoney(total)}*\n\n`;

        // ========================================================
        // INFORMACIÓN DE ENVÍO
        // ========================================================

        if (
            order.envio
        ) {

            response +=
                `📍 *ENVÍO*\n\n`;

            if (
                order.envio.direccion
            ) {

                response +=
                    `Dirección: ${order.envio.direccion}\n`;
            }

            if (
                order.envio.distrito
            ) {

                response +=
                    `Distrito: ${order.envio.distrito}\n`;
            }

            if (
                order.envio.provincia
            ) {

                response +=
                    `Provincia: ${order.envio.provincia}\n`;
            }

            if (
                order.envio.referencia
            ) {

                response +=
                    `Referencia: ${order.envio.referencia}\n`;
            }

            if (
                order.envio.guia
            ) {

                response +=
                    `📮 Guía: ${order.envio.guia}\n`;
            }

            response +=
                `\n`;
        }

        // ========================================================
        // MENSAJE INTELIGENTE SEGÚN ESTADO
        // ========================================================

        const normalizedShippingStatus =
            normalizeStatus(
                estadoPedido
            );

        const normalizedPaymentStatus =
            normalizeStatus(
                estadoPago
            );

        // ========================================================
        // PEDIDO PENDIENTE
        // ========================================================

        if (
            normalizedShippingStatus ===
            'pendiente'
        ) {

            if (
                [
                    'completado',
                    'aprobado',
                    'pagado'
                ].includes(
                    normalizedPaymentStatus
                )
            ) {

                response +=
                    `⏳ *Tu pago ya fue confirmado.*\n` +
                    `Tu pedido se encuentra pendiente de despacho.`;
            } else {

                response +=
                    `⏳ Tu pedido se encuentra pendiente de procesamiento.`;
            }
        }

        // ========================================================
        // PROCESANDO
        // ========================================================

        else if (
            [
                'procesando',
                'proceso'
            ].includes(
                normalizedShippingStatus
            )
        ) {

            response +=
                `🔄 Tu pedido está siendo procesado.`;
        }

        // ========================================================
        // PREPARADO
        // ========================================================

        else if (
            [
                'preparado',
                'listo'
            ].includes(
                normalizedShippingStatus
            )
        ) {

            response +=
                `📦 Tu pedido está preparado para despacho.`;
        }

        // ========================================================
        // ENVIADO
        // ========================================================

        else if (
            [
                'enviado',
                'despacho'
            ].includes(
                normalizedShippingStatus
            )
        ) {

            response +=
                `🚚 *Tu pedido está en camino.*`;
        }

        // ========================================================
        // ENTREGADO
        // ========================================================

        else if (
            normalizedShippingStatus ===
            'entregado'
        ) {

            response +=
                `✅ *Tu pedido ha sido entregado.*\n\n` +
                `¡Gracias por confiar en ${CONFIG.COMPANY_NAME}!`;
        }

        // ========================================================
        // CANCELADO
        // ========================================================

        else if (
            normalizedShippingStatus ===
            'cancelado'
        ) {

            response +=
                `❌ Este pedido figura como cancelado.\n\n` +
                `Si necesitas asistencia, puedes solicitar atención personalizada.`;
        }

        // ========================================================
        // ESTADO DESCONOCIDO
        // ========================================================

        else {

            response +=
                `ℹ️ El pedido fue encontrado correctamente. ` +
                `El estado actual es: ${estadoPedido}.`;
        }

        response +=
            `\n\n_¿Necesitas más ayuda? Escribe "menu"_`;

        console.log(
            `[Chatbot] Pedido encontrado: ${normalizedOrder} | ` +
            `envio.estado=${estadoPedido} | ` +
            `pago.estado=${estadoPago}`
        );

        return response;

    } catch (error) {

        console.error(
            '[ChatbotService] Error en getOrderStatus:',
            error
        );

        return (
            `⚠️ *No fue posible consultar el pedido en este momento.*\n\n` +
            `Por favor, inténtalo nuevamente más tarde.\n\n` +
            `_Escribe "menu" para volver al inicio_`
        );
    }
}

// ================================================================
// BUSCAR PRODUCTOS
// ================================================================
//
// SOLO LECTURA.
//
// El chatbot NO modifica:
//
//     productos
//
// ================================================================
async function searchProducts(query) {

    try {

        const normalizedQuery =
            normalizeText(query);

        if (
            !normalizedQuery ||
            normalizedQuery.length < 2
        ) {

            return (
                `🔍 Escribe el nombre del producto que deseas buscar.`
            );
        }

        console.log(
            `[Chatbot] Buscando producto: "${normalizedQuery}"`
        );

        // ========================================================
        // CATÁLOGOS REALES DE GOLDINFINITI
        // SOLO LECTURA
        // ========================================================

        const catalogs = [
            {
                file: 'productos.js',
                stock: 'goldinfiniti_stock_inicio'
            },
            {
                file: 'productos-hombre.js',
                stock: 'goldinfiniti_stock_hombre'
            },
            {
                file: 'productos-mujer.js',
                stock: 'goldinfiniti_stock_mujer'
            },
            {
                file: 'productos-ninos.js',
                stock: 'goldinfiniti_stock_ninos'
            },
            {
                file: 'productos-accesorios.js',
                stock: 'goldinfiniti_stock_accesorios'
            },
            {
                file: 'productos-colecciones.js',
                stock: 'goldinfiniti_stock_colecciones'
            },
            {
                file: 'productos-ofertas.js',
                stock: 'goldinfiniti_stock_ofertas'
            }
        ];

        const results = [];

        // ========================================================
        // LEER CATÁLOGOS
        // ========================================================

        for (const catalog of catalogs) {

            try {

                const response =
                    await fetch(
                        `https://www.goldinfiniti.com/js/${catalog.file}`
                    );

                if (!response.ok) {

                    console.warn(
                        `[Chatbot] No se pudo leer ${catalog.file}`
                    );

                    continue;
                }

                const source =
                    await response.text();

                // =================================================
                // EXTRAER ARRAY productos
                // =================================================

                const match =
                    source.match(
                        /const\s+productos\s*=\s*(\[[\s\S]*?\]);/
                    );

                if (!match) {

                    console.warn(
                        `[Chatbot] No se encontró catálogo en ${catalog.file}`
                    );

                    continue;
                }

                /*
                 * IMPORTANTE:
                 *
                 * NO ejecutamos el JavaScript remoto.
                 *
                 * El catálogo de la tienda es código JS,
                 * por lo que aquí solamente extraemos los
                 * campos necesarios de cada producto.
                 */

                const productBlocks =
                    match[1].match(
                        /\{[\s\S]*?\}/g
                    ) || [];

                for (const block of productBlocks) {

                    const idMatch =
                        block.match(
                            /["']?id["']?\s*:\s*(\d+)/
                        );

                    const slugMatch =
                        block.match(
                            /["']?slug["']?\s*:\s*["']([^"']*)["']/
                        );

                    const titleMatch =
                        block.match(
                            /["']?titulo["']?\s*:\s*["']([^"']*)["']/
                        );

                    const priceMatch =
                        block.match(
                            /["']?precioActual["']?\s*:\s*([\d.]+)/
                        );

                    if (!idMatch) {
                        continue;
                    }

                    const id =
                        Number(idMatch[1]);

                    const titulo =
                        titleMatch
                            ? titleMatch[1]
                            : '';

                    const slug =
                        slugMatch
                            ? slugMatch[1]
                            : '';

                    const precioActual =
                        priceMatch
                            ? Number(priceMatch[1])
                            : 0;

                    const normalizedTitle =
                        normalizeText(titulo);

                    const normalizedSlug =
                        normalizeText(slug);

                    // =================================================
                    // BUSCAR POR NOMBRE O SLUG
                    // =================================================

                    if (
                        !normalizedTitle.includes(
                            normalizedQuery
                        ) &&
                        !normalizedSlug.includes(
                            normalizedQuery
                        )
                    ) {

                        continue;
                    }

                    // =================================================
                    // FIREBASE STOCK
                    //
                    // SOLO .get()
                    // SOLO LECTURA
                    // =================================================

                    const stockSnapshot =
                        await firestore
                            .collection('stock')
                            .doc(catalog.stock)
                            .get();

                    const stockData =
                        stockSnapshot.exists
                            ? stockSnapshot.data() || {}
                            : {};

                    const productStock =
                        stockData[String(id)] || {};

                    let totalStock = 0;

                    const availability = [];

                    for (
                        const [color, sizes]
                        of Object.entries(
                            productStock
                        )
                    ) {

                        const colorSizes = {};

                        for (
                            const [size, quantity]
                            of Object.entries(
                                sizes || {}
                            )
                        ) {

                            const qty =
                                Number(quantity) || 0;

                            colorSizes[size] =
                                qty;

                            totalStock +=
                                qty;
                        }

                        availability.push({

                            color,

                            sizes:
                                colorSizes
                        });
                    }

                    results.push({

                        id,

                        titulo,

                        slug,

                        precioActual,

                        stock:
                            totalStock,

                        availability
                    });

                }

            } catch (error) {

                console.error(
                    `[Chatbot] Error leyendo ${catalog.file}:`,
                    error.message
                );
            }
        }

        // ========================================================
        // SIN RESULTADOS
        // ========================================================

        if (
            results.length === 0
        ) {

            return (
                `🔍 *No encontré productos* para "${query}".\n\n` +
                `Puedes intentar con:\n` +
                `• Una palabra más general\n` +
                `• El tipo de prenda\n` +
                `• El nombre del producto\n\n` +
                `🌐 Ver productos:\n` +
                `${buildUrl(CONFIG.URLS.SEARCH)}\n\n` +
                `_Escribe "menu" para volver_`
            );
        }

        // ========================================================
        // RESPUESTA
        // ========================================================

        let response =
            `🔍 *PRODUCTOS ENCONTRADOS*\n\n`;

        const maxResults =
            Math.min(
                results.length,
                CONFIG.MAX_PRODUCT_RESULTS
            );

        for (
            let i = 0;
            i < maxResults;
            i++
        ) {

            const product =
                results[i];

            response +=
                `👕 *${product.titulo || 'Producto'}*\n`;

            if (
                product.precioActual > 0
            ) {

                response +=
                    `💰 Precio: ${formatMoney(
                        product.precioActual
                    )}\n`;
            }

            if (
                product.stock > 0
            ) {

                response +=
                    `✅ *Disponible*\n`;

                for (
                    const item
                    of product.availability
                ) {

                    const availableSizes =
                        Object.entries(
                            item.sizes
                        )
                        .filter(
                            ([, quantity]) =>
                                Number(quantity) > 0
                        )
                        .map(
                            ([size, quantity]) =>
                                `${size} (${quantity})`
                        );

                    if (
                        availableSizes.length > 0
                    ) {

                        response +=
                            `   🎨 ${item.color}: ` +
                            `${availableSizes.join(', ')}\n`;
                    }
                }

            } else {

                response +=
                    `❌ *Agotado*\n`;
            }

            if (
                product.slug
            ) {

                response +=
                    `🌐 ${buildUrl(
                        `/producto/${product.slug}`
                    )}\n`;
            }

            response +=
                `\n`;
        }

        response +=
            `_Escribe "menu" para volver al inicio_`;

        console.log(
            `[Chatbot] Productos encontrados: ${results.length}`
        );

        return response;

    } catch (error) {

        console.error(
            '[ChatbotService] Error en searchProducts:',
            error
        );

        return (
            `⚠️ No fue posible realizar la búsqueda en este momento.\n\n` +
            `Intenta nuevamente más tarde.`
        );
    }
}
// ================================================================
// TRANSFERIR A ASESOR
// ================================================================
//
// Esta función pertenece exclusivamente al chatbot.
//
// Envía una notificación al administrador.
//
// NO modifica Firebase.
//
// ================================================================

async function transferToHuman(
    phone
) {

    try {

        console.log(
            `[Chatbot] Transferencia a asesor solicitada: ${phone}`
        );

        // ========================================================
        // VALIDAR CONFIGURACIÓN SMTP
        // ========================================================

        if (
            !process.env.EMAIL_USER ||
            !process.env.EMAIL_PASS
        ) {

            console.error(
                '[ChatbotService] EMAIL_USER/EMAIL_PASS no configurados'
            );

            return (
                `👤 *ATENCIÓN PERSONALIZADA*\n\n` +
                `Puedes comunicarte directamente con nuestro equipo:\n\n` +
                `📱 WhatsApp:\n` +
                `https://wa.me/${CONFIG.COMPANY_WHATSAPP}\n\n` +
                `📞 Teléfono: ${CONFIG.COMPANY_PHONE}\n` +
                `📧 Email: ${CONFIG.COMPANY_EMAIL}\n\n` +
                `_Escribe "menu" para volver al inicio_`
            );
        }

        // ========================================================
        // CREAR TRANSPORTER
        // ========================================================
        //
        // MÉTODO CORRECTO DE NODEMAILER:
        //
        //     createTransport()
        //
        // ========================================================

        const transporter =
            nodemailer.createTransport({

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
        // DATOS SEGUROS PARA HTML
        // ========================================================

        const safePhone =
            escapeHtml(
                phone ||
                'No disponible'
            );

        const whatsappPhone =
            encodeURIComponent(
                phone ||
                CONFIG.COMPANY_WHATSAPP
            );

        // ========================================================
        // NOTIFICAR ADMINISTRADOR
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

                <html lang="es">

                <head>

                    <meta charset="UTF-8">

                    <title>
                        Solicitud de atención Brioni
                    </title>

                    <style>

                        body {
                            font-family:
                                Arial,
                                Helvetica,
                                sans-serif;

                            background:
                                #f5f5f5;

                            padding:
                                20px;
                        }

                        .container {
                            max-width:
                                600px;

                            margin:
                                0 auto;
                        }

                        .header {
                            background:
                                #075E54;

                            color:
                                white;

                            padding:
                                20px;

                            border-radius:
                                8px 8px 0 0;
                        }

                        .content {
                            background:
                                #ffffff;

                            padding:
                                25px;

                            border-radius:
                                0 0 8px 8px;
                        }

                        .info {
                            background:
                                #f5f5f5;

                            padding:
                                15px;

                            border-radius:
                                8px;

                            margin:
                                10px 0;
                        }

                        .btn {
                            display:
                                inline-block;

                            background:
                                #25D366;

                            color:
                                white;

                            padding:
                                12px 20px;

                            border-radius:
                                6px;

                            text-decoration:
                                none;
                        }

                        .footer {
                            font-size:
                                12px;

                            color:
                                #888;

                            margin-top:
                                20px;
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
                                    <strong>
                                        📱 Teléfono:
                                    </strong>

                                    ${safePhone}
                                </p>

                                <p>
                                    <strong>
                                        📅 Fecha:
                                    </strong>

                                    ${escapeHtml(
                                        new Date()
                                            .toLocaleString(
                                                'es-PE'
                                            )
                                    )}
                                </p>

                                <p>
                                    <strong>
                                        🌐 Origen:
                                    </strong>

                                    Chat web Brioni
                                </p>

                            </div>

                            <p style="margin-top:20px;">

                                <a
                                    href="https://wa.me/${whatsappPhone}"
                                    class="btn"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    💬 Responder por WhatsApp
                                </a>

                            </p>

                            <p class="footer">

                                Este mensaje fue generado
                                automáticamente por el
                                asistente virtual Brioni.

                            </p>

                        </div>

                    </div>

                </body>

                </html>
            `
        });

        console.log(
            '[ChatbotService] Notificación al administrador enviada'
        );

        // ========================================================
        // RESPUESTA
        // ========================================================

        return (
            `👤 *ATENCIÓN PERSONALIZADA*\n\n` +
            `Tu solicitud fue enviada correctamente.\n\n` +
            `Un asesor podrá ayudarte directamente.\n\n` +
            `📱 *WhatsApp:*\n` +
            `https://wa.me/${CONFIG.COMPANY_WHATSAPP}?text=Hola%2C%20necesito%20ayuda\n\n` +
            `📞 *Teléfono:* ${CONFIG.COMPANY_PHONE}\n` +
            `📧 *Email:* ${CONFIG.COMPANY_EMAIL}\n\n` +
            `⏰ *Horario:* Lunes a Viernes 9am - 6pm\n\n` +
            `🌐 *Web:* ${CONFIG.DOMAIN}\n\n` +
            `_Escribe "menu" para volver al inicio_`
        );

    } catch (error) {

        console.error(
            '[ChatbotService] Error en transferToHuman:',
            error
        );

        // ========================================================
        // FALLBACK
        // ========================================================

        return (
            `👤 *ATENCIÓN PERSONALIZADA*\n\n` +
            `Puedes comunicarte directamente con nuestro equipo:\n\n` +
            `📱 *WhatsApp:*\n` +
            `https://wa.me/${CONFIG.COMPANY_WHATSAPP}\n\n` +
            `📞 *Teléfono:* ${CONFIG.COMPANY_PHONE}\n` +
            `📧 *Email:* ${CONFIG.COMPANY_EMAIL}\n\n` +
            `⏰ *Horario:* Lunes a Viernes 9am - 6pm\n\n` +
            `_Escribe "menu" para volver al inicio_`
        );
    }
}

// ================================================================
// MENÚ PRINCIPAL
// ================================================================

function getMainMenu() {

    return (
        `🤖 *ASISTENTE BRIONI*\n\n` +
        `Hola. Estoy aquí para ayudarte.\n\n` +
        `¿En qué puedo ayudarte?\n\n` +
        `📦 *Mi pedido* - Consulta el estado real de tu orden\n` +
        `📏 *Tallas* - Guía de tallas\n` +
        `🚚 *Envíos* - Costos y tiempos de entrega\n` +
        `🔄 *Cambios* - Cambios y devoluciones\n` +
        `💳 *Pagos* - Métodos de pago\n` +
        `👤 *Asesor* - Hablar con una persona\n\n` +
        `🔍 *Buscar producto* - Escribe el nombre de lo que buscas\n\n` +
        `📌 *Ejemplos:*\n` +
        `• "mi pedido"\n` +
        `• "ORD-202608-0029"\n` +
        `• "tallas"\n` +
        `• "polo negro"\n` +
        `• "envíos"\n\n` +
        `_Puedes escribir "menu" en cualquier momento._`
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

        `🌐 *Guía completa:*\n` +
        `${buildUrl(CONFIG.URLS.SIZE_GUIDE)}\n\n` +

        `_Escribe "menu" para volver_`
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

        `_Escribe "menu" para volver_`
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

        `🌐 *Más información:*\n` +
        `${buildUrl(CONFIG.URLS.RETURNS)}\n\n` +

        `_Escribe "menu" para volver_`
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

        `🔐 *Seguridad:* Todos los pagos son procesados mediante canales seguros.\n\n` +

        `🌐 *Más información:*\n` +
        `${buildUrl(CONFIG.URLS.PAYMENTS)}\n\n` +

        `_Escribe "menu" para volver_`
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