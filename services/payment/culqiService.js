// services/payment/culqiService.js
const CulqiService = {
  createCharge: async (paymentData) => {
    console.log("✅ CulqiService: Creando cargo con:", {
      amount: paymentData.amount,
      currency: paymentData.currency_code,
      email: paymentData.email
    });
    
    // Simulación de pago exitoso
    return {
      id: `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      object: "charge",
      amount: paymentData.amount,
      currency: paymentData.currency_code || "PEN",
      description: paymentData.description || "Pago Infiniti",
      email: paymentData.email,
      status: "paid",
      authorization_code: `auth_${Math.random().toString(36).substr(2, 10)}`,
      created_at: Math.floor(Date.now() / 1000),
      captured: true,
      metadata: {
        source: "culqi-backend",
        environment: process.env.NODE_ENV || "development"
      }
    };
  },
  
  getCharge: async (chargeId) => {
    return {
      id: chargeId,
      status: "paid",
      amount: 10000,
      currency: "PEN"
    };
  }
};

module.exports = CulqiService;
