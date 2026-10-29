# Changelog

## [0.6.1](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.6.0...v0.6.1) (2026-10-29)


### Bug Fixes

* **time-zone:** write UTC when the runtime does not know the project zone ([8a49f7e](https://github.com/samuelcsantana/pyxis-mcp/commit/8a49f7ee9c25badbf1e922921286bde891d22ef4))


### Documentation

* say the times fall back to UTC when the zone is unknown ([dffa518](https://github.com/samuelcsantana/pyxis-mcp/commit/dffa5184d831b8208aee59174b5ef0c945c0ffab))

## [0.6.0](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.5.0...v0.6.0) (2026-10-29)


### Features

* **tools:** describe the cities and the reach that devices answers ([ce49972](https://github.com/samuelcsantana/pyxis-mcp/commit/ce499722a5217f04b72f4503688f026ececfa4c5))
* **tools:** filter visits and property summaries by city ([f41be16](https://github.com/samuelcsantana/pyxis-mcp/commit/f41be16a2a133d77a5dec3d08dea3a417c07224e))


### Bug Fixes

* **time-zone:** follow only the keys a body has, never inherited members ([1f4ddb8](https://github.com/samuelcsantana/pyxis-mcp/commit/1f4ddb831facb59f8430f3c3579ad98008f132fe))


### Documentation

* **readme:** add the OpenSSF Scorecard badge ([a0ec857](https://github.com/samuelcsantana/pyxis-mcp/commit/a0ec857d634b5c08ea9f7c3648118552beaf30d8))
* **readme:** align the Ecosystem table and the access in Why it exists ([63712fc](https://github.com/samuelcsantana/pyxis-mcp/commit/63712fc1745cacb990015078a08d07a86669aeb2))
* **readme:** describe the property-based tests ([f8e41ef](https://github.com/samuelcsantana/pyxis-mcp/commit/f8e41efabd9a69150f43698ac2faaf0e710b843e))
* **readme:** name the city and the reach in the tools table ([ba2bf72](https://github.com/samuelcsantana/pyxis-mcp/commit/ba2bf7266e06f95bc6f0695706739667bc0c392a))
* **readme:** shorten the status note and point the roadmap at the changelog ([b93ff2c](https://github.com/samuelcsantana/pyxis-mcp/commit/b93ff2cf4ff6df818cbcef831141a45dc1e0a4d9))

## [0.5.0](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.4.3...v0.5.0) (2026-10-28)


### Features

* **tools:** answer the median of a numeric event property ([9724b3f](https://github.com/samuelcsantana/pyxis-mcp/commit/9724b3f7f6dbc6545fdf731474e53fca5fab7f9d))


### Bug Fixes

* **deps:** take body-parser 2.4.0 for the compressed body advisory ([2e82d89](https://github.com/samuelcsantana/pyxis-mcp/commit/2e82d89a2096ddfe1d85ed64c829a0cbd91ed063))
* **deps:** take fast-uri 3.1.9 for the URI normalization advisories ([aeaaf6b](https://github.com/samuelcsantana/pyxis-mcp/commit/aeaaf6bb966174555c63a05bf252b514e97dd824))


### Refactoring

* **tools:** define the visit filters once ([4e566db](https://github.com/samuelcsantana/pyxis-mcp/commit/4e566dba2cc25d44907ba6246226fb94d400ff2c))


### Documentation

* **readme:** list property_summary among the tools ([04fbf53](https://github.com/samuelcsantana/pyxis-mcp/commit/04fbf53a6dbebdc8d4b5d54d6f7c05823afb6d39))

## [0.4.3](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.4.2...v0.4.3) (2026-10-19)


### Bug Fixes

* **tools:** describe what each tool does, without telling the agent what to do ([a11a777](https://github.com/samuelcsantana/pyxis-mcp/commit/a11a7772e23e449148b986010576ead6e044af24))

## [0.4.2](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.4.1...v0.4.2) (2026-10-19)


### Bug Fixes

* **server:** repeat each tool's title in its annotations ([a1efb02](https://github.com/samuelcsantana/pyxis-mcp/commit/a1efb02c2bfeddc89cf9f09d2da62ef3bb2d3bd5))

## [0.4.1](https://github.com/samuelcsantana/pyxis-mcp/compare/v0.4.0...v0.4.1) (2026-10-19)


### Bug Fixes

* **server:** point to the install guide as documentation for the site's developers ([05d6520](https://github.com/samuelcsantana/pyxis-mcp/commit/05d652059e7636323a33a5e75a43dee2f90b12aa))


### Documentation

* **readme:** show how Cursor, VS Code and other clients connect with a token ([6c24380](https://github.com/samuelcsantana/pyxis-mcp/commit/6c24380fe25f6fe16b152aa25d8faec487bb43f5))

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
