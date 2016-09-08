'use strict';

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');


const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

const testConfig = (failingConfig) => {
  return (done) => {
    const server = new Hapi.Server();
    server.connection();
    server.register(require('../lib/'), (err) => {
      expect(err).to.not.exist();
      expect(() => {
        server.auth.strategy('default', 'redis', failingConfig);
      }).to.throw(Error);
    });
    done();
  };
};

describe('scheme', () => {
  it('fails when no redis.db options is not set', testConfig({ redis: { host: '127.0.0.1', port: 3333 }, ttl: 60 }));
  it('fails when no redis.host options is not set', testConfig({ redis: { db: 0, port: 3333 }, ttl: 60 }));
  it('fails when no redis.port options is not set', testConfig({ redis: { host: '127.0.0.1', db: 0 }, ttl: 60 }));
  it('fails when validateFunc is not a function', testConfig({ redis: { host: '127.0.0.1', db: 0, port: 3333 }, ttl: 60, validateFunc: 'tada' }));
  it('fails when ttl options is not set', testConfig({ redis: { host: '127.0.0.1', db: 0, port: 3333 } }));
});
