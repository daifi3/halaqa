/**
 * Must be imported before anything from mathjax-full.
 *
 * MathJax's version module reads `PACKAGE_VERSION` if a bundler defined it, and
 * otherwise falls back to `eval('require')` to read its package.json — which
 * crashes in React Native, where `require` isn't a real global. Defining it
 * here takes the safe branch.
 */
const g = globalThis as { PACKAGE_VERSION?: string };
g.PACKAGE_VERSION ??= '3.2.1';

export {};
