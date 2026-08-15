// ================================================================
// MODELO DE SESIÓN - CHATBOT BRIONI v2.0
// ================================================================
// Ubicación: src/models/chatbotSession.js
// ================================================================

const admin = require('firebase-admin');

/**
 * Normaliza un número de teléfono
 * Elimina todo lo que no sea dígito
 */
function normalizePhone(phone) {
    if (!phone) return null;
    return String(phone).replace(/\D/g, '');
}

/**
 * Verifica si una sesión ha expirado (30 minutos de inactividad)
 */
function isSessionExpired(lastActivityAt) {
    if (!lastActivityAt) return true;
    const now = Date.now();
    const lastActivity = lastActivityAt.toDate ? 
        lastActivityAt.toDate().getTime() : 
        new Date(lastActivityAt).getTime();
    return (now - lastActivity) / (1000 * 60) > 30;
}

class ChatbotSession {
    constructor(phone, channel = 'web') {
        this.phone = normalizePhone(phone);
        this.channel = channel;
        if (!this.phone) throw new Error('Teléfono inválido');
        this.collection = admin.firestore().collection('chatbot_sessions');
        this.doc = this.collection.doc(this.phone);
    }

    /**
     * Obtiene la sesión del usuario
     * Si no existe, la crea
     * Si expiró, la resetea
     */
    async get() {
        try {
            const snapshot = await this.doc.get();
            
            if (snapshot.exists) {
                const data = snapshot.data();
                // Verificar expiración
                if (isSessionExpired(data.lastActivityAt)) {
                    await this.reset();
                    return await this.get();
                }
                return data;
            }

            // Sesión nueva
            const newSession = {
                phone: this.phone,
                channel: this.channel,
                step: 'menu',
                context: {
                    orderId: null,
                    productId: null,
                    waitingFor: null,
                    lastQuery: null
                },
                messages: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await this.doc.set(newSession);
            const created = await this.doc.get();
            return created.data();

        } catch (error) {
            console.error('[ChatbotSession] Error en get():', error);
            return { 
                phone: this.phone,
                channel: this.channel,
                step: 'menu',
                context: {},
                messages: 0
            };
        }
    }

    /**
     * Actualiza la sesión del usuario
     * Siempre actualiza updatedAt y lastActivityAt
     */
    async update(data) {
        try {
            delete data.phone;
            delete data.channel;
            
            const updateData = {
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await this.doc.set(updateData, { merge: true });
            return true;
            
        } catch (error) {
            console.error('[ChatbotSession] Error en update():', error);
            return false;
        }
    }

    /**
     * Incrementa el contador de mensajes (ATÓMICO)
     * Usa FieldValue.increment() para evitar problemas de concurrencia
     */
    async incrementMessages() {
        try {
            await this.doc.update({
                messages: admin.firestore.FieldValue.increment(1),
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            const snapshot = await this.doc.get();
            return snapshot.data()?.messages || 0;
            
        } catch (error) {
            console.error('[ChatbotSession] Error en incrementMessages():', error);
            return 0;
        }
    }

    /**
     * Actualiza el contexto de la sesión
     */
    async updateContext(contextData) {
        try {
            await this.doc.update({
                context: contextData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('[ChatbotSession] Error en updateContext():', error);
            return false;
        }
    }

    /**
     * Cambia el paso (step) de la sesión
     */
    async setStep(step) {
        try {
            await this.doc.update({
                step: step,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('[ChatbotSession] Error en setStep():', error);
            return false;
        }
    }

    /**
     * Reinicia la sesión (vuelve al menú)
     */
    async reset() {
        try {
            await this.doc.set({
                step: 'menu',
                context: {
                    orderId: null,
                    productId: null,
                    waitingFor: null,
                    lastQuery: null
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('[ChatbotSession] Error en reset():', error);
            return false;
        }
    }

    /**
     * Verifica si la sesión está activa (no expirada)
     */
    async isActive() {
        try {
            const snapshot = await this.doc.get();
            if (!snapshot.exists) return false;
            const data = snapshot.data();
            return !isSessionExpired(data.lastActivityAt);
        } catch (error) {
            console.error('[ChatbotSession] Error en isActive():', error);
            return false;
        }
    }
}

module.exports = { 
    ChatbotSession, 
    normalizePhone, 
    isSessionExpired 
};