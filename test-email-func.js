const emailService = require('./src/services/payment/emailService');

console.log('=== EMAIL SERVICE FUNCTIONS ===');
console.log('Type:', typeof emailService);
console.log('Keys:', Object.keys(emailService));

// Verifica funciones específicas
console.log('\n=== CHECKING FUNCTIONS ===');
console.log('sendPaymentConfirmation?:', typeof emailService.sendPaymentConfirmation);
console.log('enviarEmailOrden?:', typeof emailService.enviarEmailOrden);
console.log('sendOrderEmail?:', typeof emailService.sendOrderEmail);
console.log('sendEmail?:', typeof emailService.sendEmail);

// Si existe, prueba con datos dummy
if (emailService.sendPaymentConfirmation) {
  console.log('\n✅ Función encontrada!');
  const testData = {
    order_id: 'TEST-' + Date.now(),
    cliente: { nombre: 'Test', email: 'test@test.com' },
    productos: [{ nombre: 'Producto', precio: 100 }],
    resumen: { total: 100 }
  };
  
  try {
    const result = emailService.sendPaymentConfirmation(testData);
    console.log('Resultado:', result);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
