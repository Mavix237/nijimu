import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('../src/app/lib/transcriptTyping.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(code, { module, exports: module.exports, Intl });
const { transcriptCharacters, transcriptTypingDelay: delay } = module.exports;
for (let i = 0; i < 100; i++) {
  assert.ok(delay('a', i) < delay(' ', i), 'letters print faster than word boundaries');
  assert.ok(delay(' ', i) < delay(',', i), 'commas allow a breath');
  assert.ok(delay(',', i) < delay('.', i), 'sentences allow a longer pause');
}
assert.ok(new Set(Array.from({ length: 20 }, (_, i) => delay('a', i))).size > 5, 'letter timing varies gently');
for (const text of ['A quiet afternoon. Then, rain.', 'cafe\u0301 👩🏽‍🚀', '回忆。慢慢地回来。']) {
  const characters = transcriptCharacters(text);
  assert.equal(characters.join(''), text, 'the full passage is preserved');
  assert.ok(characters.every((char, i) => Number.isFinite(delay(char, i)) && delay(char, i) > 0));
  assert.deepEqual(Array.from(characters), Array.from(transcriptCharacters(text)), 'timing is repeatable');
}
assert.deepEqual(Array.from(transcriptCharacters('e\u0301👩🏽‍🚀')), ['e\u0301', '👩🏽‍🚀'], 'accented letters and joined emoji print whole');
console.log('Transcript typing checks passed: word and punctuation pauses, varied letters, Unicode and complete text.');
