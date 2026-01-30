console.log("=== PRUEBA CONEXIÓN FIREBASE ===");

try {
  // 1. Cargar firebase-admin
  const admin = require('firebase-admin');
  console.log("✅ firebase-admin cargado");
  
  // 2. Cargar credenciales
  const serviceAccount = require('./config/firebase-service-account.json');
  console.log("✅ Credenciales cargadas");
  console.log("   Project ID:", serviceAccount.project_id);
  
  // 3. Inicializar (solo si no está inicializado)
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: \`https://\${serviceAccount.project_id}.firebaseio.com\`
    });
    console.log("✅ Firebase inicializado");
  }
  
  // 4. Probar Firestore
  const db = admin.firestore();
  console.log("✅ Firestore listo");
  
  // 5. Intentar contar órdenes
  console.log("⏳ Contando órdenes...");
  
  const ordersRef = db.collection('orders');
  ordersRef.get()
    .then(snapshot => {
      console.log(\`✅ Órdenes encontradas: \${snapshot.size}\`);
      console.log("🎉 ¡CONEXIÓN EXITOSA!");
      process.exit(0);
    })
    .catch(error => {
      console.log("❌ Error accediendo a Firestore:", error.message);
      console.log("💡 Posibles causas:");
      console.log("   - Firestore no está habilitado en Firebase");
      console.log("   - No hay colección 'orders'");
      console.log("   - Permisos insuficientes");
      process.exit(1);
    });
    
} catch (error) {
  console.log("❌ Error general:", error.message);
  process.exit(1);
}
