console.log("=== PRUEBA CONEXIÓN FIREBASE ===");

try {
  // 1. Cargar firebase-admin
  const admin = require("firebase-admin");
  console.log("✅ firebase-admin cargado");
  
  // 2. Cargar credenciales
  const serviceAccount = require("./config/firebase-service-account.json");
  console.log("✅ Credenciales cargadas");
  console.log("   Project ID:", serviceAccount.project_id);
  
  // 3. Inicializar (solo si no está inicializado)
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://" + serviceAccount.project_id + ".firebaseio.com"
    });
    console.log("✅ Firebase inicializado");
  }
  
  // 4. Probar Firestore
  const db = admin.firestore();
  console.log("✅ Firestore listo");
  
  // 5. Intentar contar órdenes
  console.log("⏳ Contando órdenes...");
  
  const ordersRef = db.collection("orders");
  ordersRef.get()
    .then(snapshot => {
      console.log("✅ Órdenes encontradas: " + snapshot.size);
      console.log("🎉 ¡CONEXIÓN EXITOSA!");
      
      // Mostrar primeras 3 órdenes
      let count = 0;
      snapshot.forEach(doc => {
        if (count < 3) {
          const data = doc.data();
          console.log("\n  Orden " + (count + 1) + ": " + doc.id);
          console.log("    Estado: " + (data.estado || "N/A"));
          console.log("    Total: S/ " + (data.resumen?.total || 0));
          if (data.fechaCreacion?.toDate) {
            console.log("    Fecha: " + data.fechaCreacion.toDate().toLocaleString());
          }
        }
        count++;
      });
      
      console.log("\n📊 Resumen: " + snapshot.size + " órdenes en total");
      process.exit(0);
    })
    .catch(error => {
      console.log("❌ Error accediendo a Firestore:", error.message);
      console.log("💡 Verifica en Firebase Console:");
      console.log("   1. Firestore está habilitado");
      console.log("   2. Existe colección 'orders'");
      console.log("   3. La service account tiene permisos de lectura");
      process.exit(1);
    });
    
} catch (error) {
  console.log("❌ Error general:", error.message);
  process.exit(1);
}
