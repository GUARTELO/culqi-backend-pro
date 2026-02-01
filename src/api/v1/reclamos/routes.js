const express = require('express');
const router = express.Router();
const reclamoController = require('./controller');

// 🔥 ENDPOINT PRINCIPAL - ENVÍO DE EMAILS DE CONFIRMACIÓN
router.post('/', reclamoController.crearReclamo.bind(reclamoController));

// 🔥 HEALTH CHECK
router.get('/health', reclamoController.healthCheck.bind(reclamoController));

// 🔥 VERIFICAR ESTADO DE RECLAMO
router.get('/:reclamoId/status', async (req, res) => {
    try {
        const { reclamoId } = req.params;
        
        if (!reclamoId.startsWith('REC-')) {
            return res.status(400).json({
                success: false,
                error: 'Formato de reclamoId inválido'
            });
        }
        
        res.status(200).json({
            success: true,
            reclamoId,
            service: 'libro_reclamaciones',
            timestamp: new Date().toISOString(),
            status: 'ENDPOINT_ACTIVE',
            note: 'Para enviar emails de confirmación, use POST /api/v1/reclamos'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;