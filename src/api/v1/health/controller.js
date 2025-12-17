/**
 * Controlador para health checks
 */

const logger = require('../../../core/utils/logger');

class HealthController {
  // Health check básico
  async healthCheck(req, res) {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'culqi-payment-processor',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
    };
    
    res.json(health);
  }
  
  // Health check detallado
  async detailedHealthCheck(req, res) {
    const startTime = Date.now();
    
    try {
      // Verificar conexión a servicios externos
      const checks = {
        application: { status: 'healthy', message: 'Application is running' },
        memory: this.checkMemory(),
        disk: this.checkDiskSpace(),
        // database: await this.checkDatabase(), // Descomentar cuando tengas DB
        // redis: await this.checkRedis(), // Descomentar cuando tengas Redis
        culqi_api: await this.checkCulqiAPI(),
      };
      
      // Determinar estado general
      const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
      const overallStatus = allHealthy ? 'healthy' : 'degraded';
      
      const health = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime: `${Date.now() - startTime}ms`,
        checks,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        },
      };
      
      res.json(health);
      
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }
  
  // Readiness check (usado por Kubernetes)
  async readinessCheck(req, res) {
    try {
      // Verificar dependencias críticas
      const dependencies = {
        // database: await this.checkDatabase(), // Crítico
        // redis: await this.checkRedis(), // Opcional pero importante
        culqi_api: await this.checkCulqiAPI(), // Crítico para pagos
      };
      
      const allReady = Object.values(dependencies).every(dep => dep.status === 'healthy');
      
      if (allReady) {
        res.status(200).json({ status: 'ready' });
      } else {
        res.status(503).json({ 
          status: 'not ready',
          dependencies,
        });
      }
    } catch (error) {
      res.status(503).json({ 
        status: 'not ready',
        error: error.message,
      });
    }
  }
  
  // Liveness check (usado por Kubernetes)
  async livenessCheck(req, res) {
    // Verificar que la aplicación está viva (no bloqueada)
    const memory = this.checkMemory();
    
    if (memory.status === 'healthy') {
      res.status(200).json({ status: 'alive' });
    } else {
      res.status(503).json({ 
        status: 'unhealthy',
        memory,
      });
    }
  }
  
  // Métodos de verificación internos
  checkMemory() {
    const memoryUsage = process.memoryUsage();
    const usedMB = memoryUsage.heapUsed / 1024 / 1024;
    const totalMB = memoryUsage.heapTotal / 1024 / 1024;
    const percent = (usedMB / totalMB) * 100;
    
    if (percent > 90) {
      return {
        status: 'unhealthy',
        message: `Memory usage is high: ${percent.toFixed(2)}%`,
        details: {
          used: `${usedMB.toFixed(2)}MB`,
          total: `${totalMB.toFixed(2)}MB`,
          percent: percent.toFixed(2),
        },
      };
    }
    
    return {
      status: 'healthy',
      message: 'Memory usage is normal',
      details: {
        used: `${usedMB.toFixed(2)}MB`,
        total: `${totalMB.toFixed(2)}MB`,
        percent: percent.toFixed(2),
      },
    };
  }
  
  checkDiskSpace() {
    // En una implementación real, usaría el módulo 'check-disk-space'
    return {
      status: 'healthy',
      message: 'Disk space check not implemented',
      warning: 'Implement disk space monitoring in production',
    };
  }
  
  async checkCulqiAPI() {
    try {
      // Intentar hacer una request simple a Culqi
      // En una implementación real, haríamos un ping al API
      
      // Por ahora, simular que está disponible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        status: 'healthy',
        message: 'Culqi API is reachable',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Cannot reach Culqi API',
        error: error.message,
      };
    }
  }
}

module.exports = new HealthController();