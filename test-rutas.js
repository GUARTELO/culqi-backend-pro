const path = require("path");
console.log("Directorio actual:", __dirname);

const rutas = [
    path.join(__dirname, "../../../../config/firebase-service-account.json"),
    path.join(__dirname, "../../../config/firebase-service-account.json"),
    path.join(__dirname, "../../config/firebase-service-account.json"),
    path.join(__dirname, "../config/firebase-service-account.json"),
    path.join(process.cwd(), "config/firebase-service-account.json")
];

rutas.forEach((ruta, i) => {
    console.log(\`Ruta \${i+1}: \${ruta}\`);
    try {
        require(ruta);
        console.log("  ✅ EXISTE");
    } catch {
        console.log("  ❌ NO EXISTE");
    }
});
