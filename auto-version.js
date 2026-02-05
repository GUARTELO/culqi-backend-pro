// auto-version.js
// ARCHIVO INDEPENDIENTE - NO TOCA TU CÓDIGO EXISTENTE
const fs = require('fs');
const path = require('path');

console.log('🚀 INICIANDO ACTUALIZACIÓN AUTOMÁTICA DE VERSIÓN');
console.log('📂 Directorio actual:', __dirname);

// Clase para manejar versiones automáticas
class AutoVersion {
  constructor() {
    // Ruta del package.json (en la raíz del proyecto)
    this.packagePath = path.join(__dirname, 'package.json');
    
    // Ruta donde se guardará la versión (se creará automáticamente)
    this.versionFile = path.join(__dirname, 'src', 'config', 'version.json');
    
    console.log('📍 Package.json encontrado en:', this.packagePath);
  }

  // Método para incrementar la versión actual
  incrementVersion(currentVersion, commitType = 'patch') {
    console.log('🔄 Incrementando versión:', currentVersion);
    
    // Separar versión en partes: major.minor.patch
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    // Determinar qué parte incrementar
    let newVersion;
    switch (commitType.toLowerCase()) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        console.log('📈 Incremento MAJOR:', `${major}.${minor}.${patch} → ${newVersion}`);
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        console.log('📈 Incremento MINOR:', `${major}.${minor}.${patch} → ${newVersion}`);
        break;
      case 'patch':
      default:
        newVersion = `${major}.${minor}.${patch + 1}`;
        console.log('📈 Incremento PATCH:', `${major}.${minor}.${patch} → ${newVersion}`);
        break;
    }
    
    return newVersion;
  }

  // Método principal que actualiza la versión
  async updateVersion() {
    try {
      console.log('\n════════════════════════════════════════════');
      console.log('🛠️  PROCESO DE ACTUALIZACIÓN DE VERSIÓN');
      console.log('════════════════════════════════════════════\n');
      
      // 1. VERIFICAR QUE EXISTE package.json
      if (!fs.existsSync(this.packagePath)) {
        throw new Error('No se encontró package.json en: ' + this.packagePath);
      }
      
      console.log('✅ 1. Package.json encontrado');
      
      // 2. LEER LA VERSIÓN ACTUAL
      const packageData = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
      const currentVersion = packageData.version || '1.0.0';
      
      console.log('✅ 2. Versión actual:', currentVersion);
      
      // 3. DETERMINAR NUEVA VERSIÓN (siempre patch para seguridad)
      const newVersion = this.incrementVersion(currentVersion, 'patch');
      
      console.log('✅ 3. Nueva versión calculada:', newVersion);
      
      // 4. ACTUALIZAR SOLO LA VERSIÓN EN package.json
      // Mantiene TODO lo demás igual
      packageData.version = newVersion;
      
      // Guardar package.json
      fs.writeFileSync(this.packagePath, JSON.stringify(packageData, null, 2));
      console.log('✅ 4. Package.json actualizado');
      
      // 5. CREAR ARCHIVO DE VERSIÓN PARA LA API
      const versionInfo = {
        version: newVersion,
        lastUpdated: new Date().toISOString(),
        buildNumber: `build-${Date.now()}`,
        environment: "production",
        service: "Culqi Payment Processor + Libro de Reclamaciones INDECOPI"
      };
      
      // Crear directorio si no existe
      const versionDir = path.dirname(this.versionFile);
      if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
        console.log('📁 Directorio creado:', versionDir);
      }
      
      // Guardar archivo de versión
      fs.writeFileSync(this.versionFile, JSON.stringify(versionInfo, null, 2));
      console.log('✅ 5. Archivo de versión creado:', this.versionFile);
      
      // 6. MENSAJE FINAL
      console.log('\n════════════════════════════════════════════');
      console.log('🎉 ¡ACTUALIZACIÓN COMPLETADA CON ÉXITO!');
      console.log('════════════════════════════════════════════');
      console.log(`📊 RESUMEN:`);
      console.log(`   Versión anterior: ${currentVersion}`);
      console.log(`   Versión nueva:    ${newVersion}`);
      console.log(`   Archivo creado:   ${this.versionFile}`);
      console.log(`   Timestamp:        ${new Date().toISOString()}`);
      console.log('════════════════════════════════════════════\n');
      
      return {
        success: true,
        oldVersion: currentVersion,
        newVersion: newVersion,
        versionFile: this.versionFile
      };
      
    } catch (error) {
      console.error('\n❌ ❌ ❌ ERROR EN LA ACTUALIZACIÓN ❌ ❌ ❌');
      console.error('Mensaje:', error.message);
      console.error('Stack:', error.stack);
      console.error('\n⚠️  Tu código NO ha sido modificado.');
      console.error('⚠️  Tu API sigue funcionando normalmente.\n');
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Si se ejecuta directamente desde la terminal
if (require.main === module) {
  console.log('🔧 Ejecutando script de actualización automática...\n');
  
  const autoVersion = new AutoVersion();
  
  // Preguntar confirmación (solo en ejecución manual)
  if (process.argv.includes('--force')) {
    // Ejecutar sin confirmación
    autoVersion.updateVersion();
  } else {
    // Mostrar confirmación
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('⚠️  ¿Actualizar versión automáticamente? (s/n): ', (answer) => {
      if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'si') {
        autoVersion.updateVersion();
      } else {
        console.log('🚫 Operación cancelada por el usuario.');
        console.log('ℹ️  Para forzar ejecución: node auto-version.js --force\n');
      }
      readline.close();
    });
  }
}

// Exportar para uso en otros scripts
module.exports = AutoVersion;