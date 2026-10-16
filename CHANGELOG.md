# Changelog

## [0.4.0](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.3.0...v0.4.0) (2026-10-16)


### Features

* **tools:** name the (ad click) source in the descriptions ([c68a964](https://github.com/samuelcsantana/pyxis-mcp/commit/c68a964d222b5b19f218e62ab636a288372a6885))
* **tools:** write the times of every answer in the project time zone ([4dde548](https://github.com/samuelcsantana/pyxis-mcp/commit/4dde548adfd41268425f616171007eaaeaa7e5e0))


### Bug Fixes

* **tools:** send the timeline cursor to the API in UTC ([41505d6](https://github.com/samuelcsantana/pyxis-mcp/commit/41505d6acd5da0f1c7712ce4f885fac6dc5d4964))


### Documentation

* record why the tools write times in the project time zone ([2a5894a](https://github.com/samuelcsantana/pyxis-mcp/commit/2a5894a93a90db13e3083ae07480771c3032c208))

## [0.3.0](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.2.0...v0.3.0) (2026-10-16)


### Features

* **server:** point an agent with an empty project to the install guide ([a75ad76](https://github.com/samuelcsantana/pyxis-mcp/commit/a75ad7647aeb7c0483933297a713b67c844c78c2))


### Documentation

* **readme:** explain how to connect Pyxis from Claude ([bf3bcb8](https://github.com/samuelcsantana/pyxis-mcp/commit/bf3bcb8c06feb30de8272daaefe7929e3b977178))

## [0.2.0](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.1.0...v0.2.0) (2026-10-15)


### Features

* export the server, the HTTP handler and the API client ([147ea85](https://github.com/samuelcsantana/pyxis-mcp/commit/147ea8574c1027b626c0d78c8ea44e2e30e53916))
* **http:** serve the tools over stateless streamable HTTP ([af2debd](https://github.com/samuelcsantana/pyxis-mcp/commit/af2debd9f64ed453e8ae99f86d1a4a61926c3698))
* **server:** name the server with the package's version by default ([356fd40](https://github.com/samuelcsantana/pyxis-mcp/commit/356fd40e4675af77ca77a48c847369931226e2d7))


### Bug Fixes

* **api:** pass on the API's reason for every refusal ([1879717](https://github.com/samuelcsantana/pyxis-mcp/commit/1879717ab9b8e5321c9b9b6c90a4fbba84bb67f1))


### Refactoring

* **api:** take the client's options as one object ([7bc2c1b](https://github.com/samuelcsantana/pyxis-mcp/commit/7bc2c1b8c56e44166e5002dcecf755885eca0fa9))


### Documentation

* document the library and record ADR 0003 ([9901d40](https://github.com/samuelcsantana/pyxis-mcp/commit/9901d402f986cbed4c6ce38dd50944af105fc4d2))
* **readme:** add the npm version and provenance badges ([ea5a644](https://github.com/samuelcsantana/pyxis-mcp/commit/ea5a644c3d6af04bb156b43934242e9be7714280))

## 0.1.0 (2026-10-14)


### Features

* **api:** read the Pyxis API with the access token ([831b30d](https://github.com/samuelcsantana/pyxis-mcp/commit/831b30ddff76986deb0001adf651d99de34f8d4c))
* **cli:** start the server over stdio as pyxis-mcp ([2b4aa5b](https://github.com/samuelcsantana/pyxis-mcp/commit/2b4aa5bd54592e3dcdae0cb90a8542e3bc44942f))
* **config:** read the token and the API address from the environment ([b034c9b](https://github.com/samuelcsantana/pyxis-mcp/commit/b034c9b6b1db61ba4a60df0ef11b7c435a63b203))
* **server:** serve the tools over MCP ([2e8d007](https://github.com/samuelcsantana/pyxis-mcp/commit/2e8d007edb350e33b3211a6ad36acffe0372ac74))
* **tools:** describe a read-only tool for every dashboard screen ([30d4bca](https://github.com/samuelcsantana/pyxis-mcp/commit/30d4bcabbd1a7e89ddf3e9269d50c70b25441bfc))


### Documentation

* add community health files ([203109e](https://github.com/samuelcsantana/pyxis-mcp/commit/203109eb52e2165f601e8a2907a1a7f2c0ff23d7))
* add the readme, brand assets and the first ADRs ([cf0c7ef](https://github.com/samuelcsantana/pyxis-mcp/commit/cf0c7ef941ea4735008820535937b23cb4765e49))
* **readme:** add the coverage badge ([65984bb](https://github.com/samuelcsantana/pyxis-mcp/commit/65984bb24e061b4a153876397b0267812b4b3f12))
* **readme:** document the tools, their setup and the test layers ([99261eb](https://github.com/samuelcsantana/pyxis-mcp/commit/99261ebddd9fce7128cda9baf4721e2ed8bf896e))
* **readme:** run the server with npx once it is on npm ([8e3ea33](https://github.com/samuelcsantana/pyxis-mcp/commit/8e3ea3303859545134c5929cc8a100acee429925))
