import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONTRACT_URL, formatContract } from './contract-sync.mts';

describe('formatContract', () => {
  it('pretty-prints with two spaces, keeps key order and ends with a newline', () => {
    assert.equal(
      formatContract('{"openapi":"3.1.0","info":{"title":"Pyxis API"}}'),
      '{\n  "openapi": "3.1.0",\n  "info": {\n    "title": "Pyxis API"\n  }\n}\n',
    );
  });

  it('rejects a body that is not JSON', () => {
    assert.throws(() => formatContract('<html>Not Found</html>'), SyntaxError);
  });
});

describe('CONTRACT_URL', () => {
  it("points at pyxis-api's committed export on main", () => {
    assert.equal(
      CONTRACT_URL,
      'https://raw.githubusercontent.com/samuelcsantana/pyxis-api/main/openapi/openapi.json',
    );
  });
});
