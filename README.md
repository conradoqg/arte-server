![logo][logo] Arte-server
====
_A simple artifact server with front-end, CLI, webhook and in the future authentication/authorization and retention policy_

[![Node.js version support][shield-node]](#)
[![Build][shield-build]](https://travis-ci.org/conradoqg/arte-server)
[![Coverage][shield-coverage]](https://coveralls.io/github/conradoqg/arte-server)
[![MIT licensed][shield-license]](LICENSE.md)

Summary
----

1. [Description](#description)
2. [Technology and Requirements](#technology-and-requirements)
3. [Getting Started](#getting-started)
4. [Contributing](#contributing)
5. [Support and Migration](#support-and-migration)
6. [Code of Conduct](#code-of-conduct)
7. [License](#license)

Description
----

The Arte server is a simple and straightforward artifact storage server. It has a UI to help the user find the artifact a [CLI](https://github.com/conradoqg/arte-cli) to help developers to upload and download their binaries and a webhook to help with the flow of a CI system.

Below a list of planned features:
- Authentication/authorization (using tokens);
- Retention policy;
- Swagger API documentation;

UI:

![UI][UI]

Technology and Requirements
----

This project uses the following stack:

- [Node.js](https://nodejs.org) for the back-end and CLI;
- [Pug.js](https://pugjs.org) for the front-end (server-side rendering);
- [MongoDB](https://www.mongodb.com) to store the artifact metadata;
- [Filesystem](https://en.wikipedia.org/wiki/File_system) to store the binary of the artifact;

Getting Started
----

Local:

```bash
# Clone the repository
$ git clone https://github.com/conradoqg/arte-server.git

# Run the arte-server
$ cd arte-server
$ node ./bin/arte-server.js
```

Using Docker (you must install docker beforehand):
```bash
# Clone the repository
$ git clone https://github.com/conradoqg/arte-server.git

# Build docker image
$ docker build . -t arte-server:latest

# Run a docker container using the previous image
$ docker run -it --rm -p 80:80 arte-server:latest
```

Usind Docker Compose (you must install docker beforehand):
```bash
# Clone the repository
$ git clone https://github.com/conradoqg/arte-server.git

# Docker compose up
$ docker-compose up
```

Contributing
----

Check the [contributing guide](CONTRIBUTING.md) to see more information.

Before submitting a pull request make sure that your code is passing the tests and has a good coverage

```bash
# Run only the tests
$ npm test

# Run tests and coverage
$ npm run coverage
```

Support and Migration
----

This is a beta server, there is no support right now until it becomes stable. Expect breaking changes on every commit.

Code of Conduct
----

Check the [code of conduct](CODE_OF_CONDUCT.md) to see more information.

License
----
This project is licensed under the [MIT](LICENSE.md) License.

[logo]: public/arte32x32.png "Arte-server"
[UI]: public/UI.png
[shield-coverage]: https://coveralls.io/repos/github/conradoqg/arte-server/badge.svg?branch=master
[shield-build]: https://travis-ci.org/conradoqg/arte-server.svg?branch=master
[shield-license]: https://img.shields.io/badge/license-MIT-blue.svg
[shield-node]: https://img.shields.io/badge/node.js%20support-8.8.1-brightgreen.svg