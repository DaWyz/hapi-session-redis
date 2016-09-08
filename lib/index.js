'use strict';

const Bluebird = require('bluebird');
const Hoek = require('hoek');
const Joi = require('joi');
const Redis = require('redis');

Bluebird.promisifyAll(Redis.RedisClient.prototype);
Bluebird.promisifyAll(Redis.Multi.prototype);

const internals = {};

internals.schema = Joi.object({
  cookieName: Joi.string().default('authentication'),
  prefixKey: Joi.string().default('auth'),
  redis: Joi.object().keys({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).required(),
    db: Joi.number().integer().min(0).max(255).required(),
    password: Joi.string()
  }).required(),
  ttl: Joi.number().integer().min(0).required(),
  isSecure: Joi.boolean().default(true),
  keepAlive: Joi.boolean().default(false),
  clearInvalid: Joi.boolean().default(false),
  validateFunc: Joi.func()
}).required();

internals.implementation = (server, options = {}) => {
  const results = Joi.validate(options, internals.schema);
  Hoek.assert(!results.error, results.error);

  const settings = results.value;

  server.state(settings.cookieName, {
    ttl: settings.ttl,
    isSecure: settings.isSecure,
    isHttpOnly: true,
    encoding: 'none',
    strictHeader: true
  });

  const client = Redis.createClient(settings.redis);

  server.event(['redis:ready', 'redis:connect', 'redis:reconnect', 'redis:error', 'redis:warning', 'redis:end']);

  client.on('ready', server.emit.bind(server, 'redis:ready'));
  client.on('connect', server.emit.bind(server, 'redis:connect'));
  client.on('reconnect', server.emit.bind(server, 'redis:reconnect'));
  client.on('error', server.emit.bind(server, 'redis:error'));
  client.on('warning', server.emit.bind(server, 'redis:warning'));
  client.on('end', server.emit.bind(server, 'redis:end'));

  server.decorate('request', 'redis', require('./decoration')(client, settings), { apply: true });
  server.ext('onPreAuth', (request, reply) => {
    // Used for setting and unsetting state, not for replying to request
    request.redis.reply = reply;

    return reply.continue();
  });

  return require('./scheme')(client, settings);
};

exports.register = (server, options, next) => {
  server.auth.scheme('redis', internals.implementation);
  next();
};


exports.register.attributes = {
  pkg: require('../package.json')
};
