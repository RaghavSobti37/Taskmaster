import { logger, getLogConfig, LOG_LEVELS } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Logger Utility', () => {
  const logDir = path.join(__dirname, '../../logs');

  afterEach(() => {
    // Clean up test logs
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      files.forEach(file => {
        if (file.endsWith('.log')) {
          try {
            fs.unlinkSync(path.join(logDir, file));
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      });
    }
  });

  describe('Log Levels', () => {
    test('logger should have all log levels defined', () => {
      expect(LOG_LEVELS).toHaveProperty('DEBUG');
      expect(LOG_LEVELS).toHaveProperty('INFO');
      expect(LOG_LEVELS).toHaveProperty('WARN');
      expect(LOG_LEVELS).toHaveProperty('ERROR');
      expect(LOG_LEVELS).toHaveProperty('CRITICAL');
    });

    test('logger.info should be callable', () => {
      expect(typeof logger.info).toBe('function');
      // Call the function to ensure it doesn't throw
      logger.info('Test info message', 'TEST');
    });

    test('logger.warn should be callable', () => {
      expect(typeof logger.warn).toBe('function');
      logger.warn('Test warning message', 'TEST');
    });

    test('logger.error should be callable with error object', () => {
      expect(typeof logger.error).toBe('function');
      const testError = new Error('Test error');
      logger.error('Test error occurred', 'TEST', testError);
    });

    test('logger.critical should be callable', () => {
      expect(typeof logger.critical).toBe('function');
      const criticalError = new Error('Critical failure');
      logger.critical('Test critical', 'TEST', criticalError);
    });
  });

  describe('Metadata Logging', () => {
    test('logger should support metadata', () => {
      const metadata = { userId: '123', action: 'login' };
      expect(() => logger.info('User action', 'USER', metadata)).not.toThrow();
    });

    test('logger should support user ID', () => {
      expect(() => logger.info('User action', 'USER', null, 'user-123')).not.toThrow();
    });
  });

  describe('Log Configuration', () => {
    test('getLogConfig should return configuration object', () => {
      const config = getLogConfig();
      
      expect(config).toHaveProperty('debugMode');
      expect(config).toHaveProperty('logToConsole');
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('logsDir');
      expect(config).toHaveProperty('files');
    });

    test('getLogConfig.files should have all log file paths', () => {
      const config = getLogConfig();
      
      expect(config.files).toHaveProperty('appLog');
      expect(config.files).toHaveProperty('errorsLog');
      expect(config.files).toHaveProperty('debugLog');
    });
  });

  describe('Error Logging', () => {
    test('logger.error should handle error objects', () => {
      const error = new Error('Test error message');
      error.code = 'TEST_CODE';
      
      expect(() => logger.error('Error occurred', 'TEST', error)).not.toThrow();
    });
  });

  describe('File Logging', () => {
    test('logs directory should be created automatically', () => {
      const config = getLogConfig();
      expect(fs.existsSync(config.logsDir)).toBe(true);
    });

    test('app.log file should be created', () => {
      logger.info('Test message', 'TEST');
      
      const config = getLogConfig();
      expect(fs.existsSync(config.files.appLog)).toBe(true);
    });

    test('logger should write to file without errors', () => {
      logger.info('Test message 1', 'TEST');
      logger.warn('Test message 2', 'TEST');
      logger.error('Test error', 'TEST', new Error('Test'));
      
      const config = getLogConfig();
      expect(fs.existsSync(config.files.appLog)).toBe(true);
    });
  });
});
