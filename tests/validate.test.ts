import test from 'node:test';
import assert from 'node:assert/strict';
import { getPackageRoot, getTemplateDir } from '../src/utils/paths.js';
import { isValidNpmName, isValidPrefix, isValidSnowflake } from '../src/utils/validate.js';

test('validates common CLI inputs', () => {
  assert.equal(isValidSnowflake('123456789012345678'), true);
  assert.equal(isValidSnowflake('abc'), false);
  assert.equal(isValidPrefix('!'), true);
  assert.equal(isValidPrefix('!!!!!'), false);
  assert.equal(isValidNpmName('my-discord-bot'), true);
  assert.equal(isValidNpmName('Bad Name'), false);
});

test('resolves package and template paths from the compiled runtime', () => {
  assert.match(getPackageRoot().replace(/\\/g, '/'), /(djs-kit|djskit)$/);
  assert.match(getTemplateDir('ts').replace(/\\/g, '/'), /src\/templates\/ts$/);
});
