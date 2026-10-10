import nextPlugin from "@next/eslint-plugin-next";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**"],
  },
  nextPlugin.configs["core-web-vitals"],
];

export default eslintConfig;
