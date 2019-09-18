'use strict';

const Bluebird = require('bluebird');
const Hoek = require('@hapi/hoek');
const Joi = require('@hapi/joi');
const Redis = require('redis');

Bluebird.promisifyAll(Redis.RedisClient.prototype);
Bluebird.promisifyAll(Redis.Multi.prototype);

const internals = {};

internals.schema = Joi.object({
  cookieName: Joi.string().default('authentication'),
  prefixKey: Joi.string().default('auth'),
  redis: Joi.object()
    .keys({
      host: Joi.string().required(),
      port: Joi.number()
        .integer()
        .min(1)
        .max(65535)
        .required(),
      db: Joi.number()
        .integer()
        .min(0)
        .max(255)
        .required(),
      password: Joi.string()
    })
    .required(),
  ttl: Joi.number()
    .integer()
    .min(0)
    .required(),
  cookie: Joi.object().keys({
    ttl: Joi.number()
      .integer()
      .min(0)
      .default(1000 * 60 * 60 * 24 * 30),
    isSecure: Joi.boolean().default(true),
    isHttpOnly: Joi.boolean().default(true),
    isSameSite: Joi.any()
      .valid(false, 'Strict', 'Lax')
      .default('Strict'),
    path: Joi.string().default(null),
    domain: Joi.string().default(null),
    encoding: Joi.string().valid('none', 'base64', 'base64json', 'iron'),
    password: Joi.string(),
    clearInvalid: Joi.boolean().default(false)
  }),
  keepAlive: Joi.boolean().default(false),
  validateFunc: Joi.func()
}).required();

internals.implementation = (server, options = {}) => {
  const results = internals.schema.validate(options);
  Hoek.assert(!results.error, results.error);

  const settings = results.value;

  server.state(settings.cookieName, settings.cookie);

  const client = Redis.createClient(settings.redis);

  server.event([
    'redis:ready',
    'redis:connect',
    'redis:reconnect',
    'redis:error',
    'redis:warning',
    'redis:end'
  ]);

  client.on('ready', server.events.emit.bind(server.events, 'redis:ready'));
  client.on('connect', server.events.emit.bind(server.events, 'redis:connect'));
  client.on(
    'reconnect',
    server.events.emit.bind(server.events, 'redis:reconnect')
  );
  client.on('error', server.events.emit.bind(server.events, 'redis:error'));
  client.on('warning', server.events.emit.bind(server.events, 'redis:warning'));
  client.on('end', server.events.emit.bind(server.events, 'redis:end'));

  server.decorate(
    'request',
    'redis',
    require('./decoration')(client, settings),
    { apply: true }
  );
  server.ext('onPreAuth', (request, h) => {
    // Used for setting and unsetting state, not for replying to request
    request.redis.h = h;

    return h.continue;
  });

  return require('./scheme')(client, settings);
};

exports.plugin = {
  pkg: require('../package.json'),
  register: function(server, options) {
    server.auth.scheme('redis', internals.implementation);
  }
};
