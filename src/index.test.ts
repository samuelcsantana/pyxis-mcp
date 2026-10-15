import { describe, expect, it } from 'vitest';
import { handleHttpRequest } from './http.js';
import * as library from './index.js';
import { PyxisApi } from './pyxis-api.js';
import { createServer } from './server.js';

describe('the library entry point', () => {
  it('exports the server, the HTTP handler and the API client, and nothing else', () => {
    expect(Object.keys(library).sort()).toEqual(['PyxisApi', 'createServer', 'handleHttpRequest']);
    expect(library.createServer).toBe(createServer);
    expect(library.handleHttpRequest).toBe(handleHttpRequest);
    expect(library.PyxisApi).toBe(PyxisApi);
  });
});
