# hapi-session-redis

Hapi session provides redis-based session management. Authentication is not part of this repo, you will have to implement it yourself via other means. Once you authenticate the user, the browser will receive a session cookie. 

The following request containing the session cookie will be authenticated via the validateFunc provided as a parameter in case the cookie's request requires validation on each request.

## Installation

run `npm install hapi-session-redis`

## Settings

The 'redis' scheme takes the following options: 

- `cookieName`: the name of the cookie sent to the browser (default to authentication)
- `prefixKey`: the prefix used in when saving to redis (default to auth)
- `redis`: an object that will be passed to node_redis createClient
- `ttl`: the redis expiry time
- `cookieTtl`: cookie max-age (default to 30 days)
- `isSecure`: force cookie to be send over secure connection (default to true)
- `keepAlive`: refresh the cookie ttl 
- `clearInvalid`: clear invalid cookie (default to false),
- `validateFunc`: an optional session validation function used to validate the content of the session cookie on each request. Used to verify that the internal session state is still valid (e.g. user account still exists). The function has the signature `function(request, session, callback)` where:
  - `request` - is the Hapi request object of the request which is being authenticated.
  - `session` - is the session object set via request.cookieAuth.set().
  - `callback` - a callback function with the signature function(err, isValid, credentials) where:
  - `err` - an internal error.
  - `isValid` - true if the content of the session is valid, otherwise false.
  - `credentials` - a credentials object passed back to the application in request.auth.credentials. If value is null or undefined, defaults to session.

## Available methods

When the redis scheme is enabled on a route, the `request.redis` object get decorated with the following methods:
- `set(key, session)` - saves the session to redis. It must be called after a successful login.
  - `key` - is session id (you should safely generate this using a ramdom string by using something like uuid.v4).
  - `session` - must be an object (can't be null).
- `get(key)` - to get the session using the session id. You don't really need this function. after accessing a route configured to use the redis scheme, you should be able to access the session using `request.auth.artifacts`.
  - `key` - is the session id.
- `expire(key)` - expires the session where:
  - `key` - is the session id.

Because this scheme decorates the request object with session-specific methods, it cannot be registered more than once.

## Example

example is available in the `example/` directory.
