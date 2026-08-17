// Proves the token rules in eslint.config.mjs still fire. Lints in memory
// against the real config, using paths that match its files/ignores globs.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({ cwd: root });

async function lint(filePath, code) {
	const [result] = await eslint.lintText(code, { filePath: join(root, filePath) });
	return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax');
}

const text = (messages) => messages.map((m) => m.message).join('\n');

describe('design-token lint rules', () => {
	it('flags a raw hex color literal in a screen', async () => {
		assert.match(text(await lint('app/fixture.tsx', "const x = { color: '#123ABC' };\n")), /hex color/i);
	});

	it('flags an arbitrary spacing value in a plain className', async () => {
		const messages = await lint('src/components/fixture.tsx', 'const x = <View className="ml-[68px]" />;\n');
		assert.match(text(messages), /radius\/spacing/i);
	});

	it('flags an arbitrary radius inside a template literal', async () => {
		const messages = await lint(
			'src/components/fixture.tsx',
			'const x = <View className={`rounded-[13px] ${tone}`} />;\n'
		);
		assert.match(text(messages), /radius\/spacing/i);
	});

	it('flags an arbitrary color inside a template literal', async () => {
		const messages = await lint(
			'src/components/fixture.tsx',
			'const x = <View className={`${tone} bg-[#ABCDEF]`} />;\n'
		);
		assert.match(text(messages), /color value/i);
	});

	it('leaves tokens.ts alone', async () => {
		assert.deepEqual(await lint('src/components/ui/tokens.ts', "export const X = '#123ABC';\n"), []);
	});

	it('passes the named steps that replaced the arbitrary ones', async () => {
		const messages = await lint(
			'src/components/fixture.tsx',
			'const x = <View className="ml-row-inset p-track-inset rounded-lg bg-surface" />;\n'
		);
		assert.deepEqual(messages, []);
	});
});
