'use strict';

const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Lab = require('@hapi/lab');

const lab = (exports.lab = Lab.script());
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

const testConfig = (failingConfig) => {
  return async () => {
    const server = new Hapi.Server();
    await server.register(require('../lib/'));

    expect(() => {
      server.auth.strategy('default', 'redis', failingConfig);
    }).to.throw(Error);
  };
};

describe('scheme', () => {
  if (process.env.NODE_ENV === 'functional') {
    const Mockery = require('mockery');
    Mockery.registerMock('redis', require('./mocks/redis.mock'));

    lab.beforeEach(() => {
      Mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false
      });
    });

    lab.afterEach(() => {
      Mockery.disable();
    });
  }

  it(
    'fails when no redis.db options is not set',
    testConfig({ redis: { host: '127.0.0.1', port: 3333 }, ttl: 60 })
  );
  it(
    'fails when no redis.host options is not set',
    testConfig({ redis: { db: 0, port: 3333 }, ttl: 60 })
  );
  it(
    'fails when no redis.port options is not set',
    testConfig({ redis: { host: '127.0.0.1', db: 0 }, ttl: 60 })
  );
  it(
    'fails when validateFunc is not a function',
    testConfig({
      redis: { host: '127.0.0.1', db: 0, port: 3333 },
      ttl: 60,
      validateFunc: 'tada'
    })
  );
  it(
    'fails when ttl options is not set',
    testConfig({ redis: { host: '127.0.0.1', db: 0, port: 3333 } })
  );
});
