console.log("=== DEBUG FIREBASE ERROR ===");

// Usar CommonJS como tu controller
const path = require("path");
const fs = require("fs");

try {
  // Ruta EXACTA que usa tu controller
  const firebaseConfigPath = path.join(__dirname, "../../../core/config/firebase.js");
  console.log("📍 Buscando archivo en:", firebaseConfigPath);
  
  if (fs.existsSync(firebaseConfigPath)) {
    console.log("✅ Archivo existe");
    
    // Ver contenido
    const content = fs.readFileSync(firebaseConfigPath, "utf8");
    console.log("📄 Primeras 5 líneas:");
    console.log(content.split("\n").slice(0, 5).join("\n"));
    
    // Intentar cargar
    const firebaseConfig = require(firebaseConfigPath);
    console.log("✅ Módulo cargado");
    console.log("Contenido:", Object.keys(firebaseConfig));
    
    if (firebaseConfig.firestore) {
      console.log("✅ firestore disponible");
    } else {
      console.log("❌ firestore NO disponible en el módulo");
    }
    
  } else {
    console.log("❌ Archivo NO existe:", firebaseConfigPath);
    
    // Buscar archivos similares
    const configDir = path.join(__dirname, "../../../core/config");
    console.log("🔍 Buscando en:", configDir);
    
    if (fs.existsSync(configDir)) {
      const files = fs.readdirSync(configDir);
      console.log("📁 Archivos en config/:", files.filter(f => f.includes("firebase")));
    }
  }
  
} catch (error) {
  console.log("❌ ERROR al cargar Firebase config:");
  console.log("Mensaje:", error.message);
  console.log("Code:", error.code);
  
  if (error.message.includes("Cannot find module")) {
    console.log("💡 El archivo firebase.js NO existe en core/config/");
  }
}
