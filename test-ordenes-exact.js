console.log("=== PRUEBA CON 'ordenes' (minúscula) ===");

try {
  const admin = require("firebase-admin");
  const serviceAccount = require("./config/firebase-service-account.json");
  
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://" + serviceAccount.project_id + ".firebaseio.com"
    });
  }
  
  const db = admin.firestore();
  console.log("✅ Firestore listo");
  
  // Nombre EXACTO: "ordenes" (minúscula)
  const ordenesRef = db.collection("ordenes");
  console.log("🔍 Buscando colección: 'ordenes'");
  
  ordenesRef.get()
    .then(snapshot => {
      console.log("📊 Resultado: " + snapshot.size + " documentos");
      
      if (snapshot.size > 0) {
        console.log("\n🎉 ¡ÉXITO! Órdenes encontradas.");
        console.log("Primeras 3 órdenes:");
        
        let count = 0;
        snapshot.forEach(doc => {
          if (count < 3) {
            const data = doc.data();
            console.log("\n  🔸 Orden: " + (data.id || data.numeroOrden || doc.id));
            console.log("     Estado: " + (data.estado || "pendiente"));
            console.log("     Total: S/ " + (data.resumen?.total || 0).toFixed(2));
            console.log("     Cliente: " + (data.cliente?.nombre || "N/A") + " " + (data.cliente?.apellido || ""));
            
            if (data.productos && data.productos.length > 0) {
              console.log("     Productos: " + data.productos.length);
              data.productos.slice(0, 2).forEach((prod, i) => {
                console.log("       " + (i + 1) + ". " + (prod.nombre || prod.titulo) + " x" + prod.cantidad);
              });
              if (data.productos.length > 2) {
                console.log("       ... y " + (data.productos.length - 2) + " más");
              }
            }
          }
          count++;
        });
        
        console.log("\n✅ Firebase funcionando correctamente");
        console.log("📈 Total órdenes: " + snapshot.size);
      } else {
        console.log("⚠️  Colección 'ordenes' existe pero está vacía");
        console.log("💡 Verifica:");
        console.log("   - ¿Estás en el proyecto Firebase correcto?");
        console.log("   - ¿Los datos se guardan en otra colección?");
      }
      
      process.exit(0);
    })
    .catch(error => {
      console.log("❌ Error: " + error.message);
      console.log("💡 Acciones:");
      console.log("   1. Revisa Firestore Rules en Firebase Console");
      console.log("   2. Verifica que la service account tenga permisos");
      console.log("   3. Asegúrate de que Firestore esté en modo 'Native'");
      process.exit(1);
    });
    
} catch (error) {
  console.log("❌ Error inicial: " + error.message);
  process.exit(1);
}
