/**
 * We generate index.html from the readme markdown with pandoc. The index.html
 * is then used as homepage for
 * https://crypto_project.gitlab.io/defi/borrow-lending.
 *
 * Because pandoc works a little bit differently to Gitlab KaTex parsing,
 * we change the codeblock to double dollar and single latex quote to single
 * dollar like so:
 *
 * ```math
 * abc
 * ```
 *
 * becomes
 *
 * $$
 * abc
 * $$
 *
 * and $`abc`$ becomes $abc$.
 */

const { readFileSync } = require("fs");

// print the output to stdin which is then used by .gitlab-ci.yml
console.log(
  readFileSync("README.md").toString()
    .replace(/```math(.*?)```/gms, "$$$ $1$$$")
    .replace(/```math/gm, "$$$")
    .replace(/\$`|`\$/g, "$")
);
