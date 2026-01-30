console.log("=== DEBUG FIREBASE ERROR ===");

try {
  // Intentar cargar EXACTAMENTE como tu controller
  const path = require("path");
  const firebasePath = path.join(__dirname, "../../../core/config/firebase");
  console.log("Intentando cargar:", firebasePath);
  
  const { firestore } = require(firebasePath);
  console.log("✅ firestore cargado");
  
  // Probar conexión
  const collections = await firestore.listCollections();
  console.log("✅ Colecciones obtenidas:", collections.length);
  
} catch (error) {
  console.log("❌ ERROR COMPLETO:");
  console.log("Mensaje:", error.message);
  console.log("Stack:", error.stack);
  console.log("Path intentado:", require("path").join(__dirname, "../../../core/config/firebase"));
}
