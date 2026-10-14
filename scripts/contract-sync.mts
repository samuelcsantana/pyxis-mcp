import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const CONTRACT_URL =
  'https://raw.githubusercontent.com/samuelcsantana/pyxis-api/main/openapi/openapi.json';
export const CONTRACT_FILE = path.join('contract', 'openapi.json');

export function formatContract(text: string): string {
  const document: unknown = JSON.parse(text);
  return `${JSON.stringify(document, null, 2)}\n`;
}

async function main(): Promise<void> {
  const response = await fetch(CONTRACT_URL);
  if (!response.ok) {
    throw new Error(`Could not download the contract: HTTP ${String(response.status)}`);
  }
  mkdirSync(path.dirname(CONTRACT_FILE), { recursive: true });
  writeFileSync(CONTRACT_FILE, formatContract(await response.text()));
  console.log(`${CONTRACT_FILE} synced from ${CONTRACT_URL}`);
}

if (import.meta.main) {
  await main();
}
