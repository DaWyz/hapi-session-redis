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
- `cookie`: an object containing the cookie options
  - `ttl`: cookie max-age (default to 30 days)
  - `isSecure`: force cookie to be send over secure connection (default to true)
  - `isHttpOnly`: set the flag HttpOnly (default to true)
  - `isSameSite`: disable third-party usage for the cookie (default to Strict)
  - `path`: indicates a URL path that must exist in the requested resource before sending the Cookie header
  - `domain`: indicates the domain(s) for which the cookie should be sent
  - `encoding`: method of encoding (none, base64, base64json or iron)
  - `password`: password used for 'iron' encoding (must be at least 32 characters long).
  - `clearInvalid`: clear invalid cookie (default to false)
- `keepAlive`: refresh the cookie ttl
- `validateFunc`: an optional session validation function used to validate the content of the session cookie on each request. Used to verify that the internal session state is still valid (e.g. user account still exists). The function has the signature `async function(request, session)` where:
  
  - `request`: is the Hapi request object of the request which is being authenticated.
  - `session`: is the session object set via request.cookieAuth.set().

  it must return an object with the following signature:

  - `valid`: true if the content of the session is valid, otherwise false.
  - `credentials`: a credentials object passed back to the application in request.auth.credentials. If value is null or undefined, defaults to session.

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

## Contribute

In order to contribute, please create a pull request and follow the PR template. make sure the tests are passing and linting is fine.

You will need to install `redis` locally beforehand.

```sh
sudo apt-get install redis-server
```

If your redis server is not running locally, don't forget to change the hostname in [server.js](./examples/server.js), [auth.spec.js](./test/auth.spec.js) and [config.spec.js](./test/config.spec.js).

Then, you can install dependencies and start the server.

```sh
npm install
npm start
```

Make sure everything works by running:

```sh
npm run test
npm run functional
npm lint
```

If you want to play with the example folder, here is the list of endpoints you can call:

- Login

```sh
curl -X POST -H "Content-Type: application/json" -c ./tmp/cookie.txt \
 -d '{"email":"john@company.com","password":"supersafe"}' \
 http://localhost:3000/sessions

```

- Query users

```sh
curl -X GET http://localhost:3000/users -b ./tmp/cookie.txt
```

- Logout

```sh
curl -X DELETE http://localhost:3000/sessions -b ./tmp/cookie.txt
```

Once you are ready, you can create a Pull Request. I'm not activily maintaining the plugin as I don't use it at the moment but I'm happy to review pull request/fix issues/add functionalities when needed.
