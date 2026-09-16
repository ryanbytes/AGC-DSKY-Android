'use strict';

function installServiceRegistry(context) {
  if (!context || typeof context !== 'object') throw new TypeError('test registry context required');
  if (context.AGCDSKY_SERVICE_REGISTRY) return context.AGCDSKY_SERVICE_REGISTRY;
  const services = new Map();
  const reasons = new Map();
  const registry = Object.freeze({
    publish(name, service, reason = 'test publication') {
      if (typeof name !== 'string' || !name.startsWith('AGCDSKY_')) throw new TypeError(`invalid test service name: ${name}`);
      if (services.has(name) && services.get(name) !== service) throw new Error(`test service already published: ${name}`);
      services.set(name, service);
      reasons.set(name, String(reason));
      if (!Object.prototype.hasOwnProperty.call(context, name)) {
        Object.defineProperty(context, name, {
          enumerable: true,
          configurable: false,
          get: () => services.get(name)
        });
      }
      return service;
    },
    service(name) { return services.get(name); },
    reason(name) { return reasons.get(name); }
  });
  Object.defineProperty(context, 'AGCDSKY_SERVICE_REGISTRY', {
    value: registry,
    enumerable: true,
    configurable: false,
    writable: false
  });
  return registry;
}

module.exports = {installServiceRegistry};
