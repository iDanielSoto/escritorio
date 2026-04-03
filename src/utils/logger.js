/**
 * Frontend Logger Utility
 * Captures core errors and strictly diverts them to the electron backend to be written to a file.
 * Non-errors (info/debug) are currently swallowed to maintain complete dev tools console silence
 * as per the extreme minimalism requirements.
 */

export const Logger = {
  error: (...args) => {
    // Attempt stringification for structured objects, otherwise pass raw text
    const payload = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`;
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' | ');

    if (window.electronAPI && window.electronAPI.logError) {
      window.electronAPI.logError(payload);
    } else {
      // Si estamos en web o no está Electron (Fallback)
      // Guardaremos silenciosamente en dev solo si es estrictamente necesario, 
      // pero el usuario pidió quitar TODO console.log
    }
  },
  
  // To entirely suppress regular logs
  info: () => {},
  warn: () => {},
  log: () => {},
};

export default Logger;
