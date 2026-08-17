// @ts-check
// Design-token guard only. No `recommended`, no style rules.
// tokens.ts is exempt: it is the hex source of truth, checked by scripts/check-tokens.mjs.

import tseslint from 'typescript-eslint';

const HEX = '/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/';
const ARBITRARY_SPACE =
	'/(rounded[a-z-]*|(?:^|[^a-zA-Z])(?:p|m|gap|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr))-\\[/';
const ARBITRARY_COLOR = '/(?:bg|text|border|fill|stroke)-\\[#/';

const HEX_MSG = 'Raw hex color. Use a semantic token from tokens.ts (useTheme().C).';
const SPACE_MSG = 'Arbitrary radius/spacing value. Add a named step to tailwind.config.js.';
const COLOR_MSG = 'Arbitrary color value. Use a semantic color utility backed by global.css.';

// TemplateElement as well as Literal: most classNames here are template strings.
export default tseslint.config({
	files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
	ignores: ['src/components/ui/tokens.ts'],
	extends: [tseslint.configs.base],
	rules: {
		'no-restricted-syntax': [
			'error',
			{ selector: `Literal[value=${HEX}]`, message: HEX_MSG },
			{ selector: `TemplateElement[value.raw=${HEX}]`, message: HEX_MSG },
			{ selector: `TemplateElement[value.raw=${ARBITRARY_SPACE}]`, message: SPACE_MSG },
			{ selector: `Literal[value=${ARBITRARY_SPACE}]`, message: SPACE_MSG },
			{ selector: `TemplateElement[value.raw=${ARBITRARY_COLOR}]`, message: COLOR_MSG },
			{ selector: `Literal[value=${ARBITRARY_COLOR}]`, message: COLOR_MSG }
		]
	}
});
