import type { StorybookConfig } from "@storybook/react-webpack5";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    getAbsolutePath("@storybook/addon-webpack5-compiler-swc"),
    getAbsolutePath("@storybook/addon-docs"),
    {
      name: "@storybook/addon-styling-webpack",
      options: {
        rules: [
          {
            test: /\.css$/,
            use: [
              "style-loader",
              {
                loader: "css-loader",
                options: { importLoaders: 1 },
              },
              {
                loader: "postcss-loader",
                options: {
                  postcssOptions: {
                    config: resolve(
                      dirname(fileURLToPath(import.meta.url)),
                      "../postcss.config.cjs"
                    ),
                  },
                },
              },
            ],
          },
        ],
      },
    },
  ],
  framework: getAbsolutePath("@storybook/react-webpack5"),
  webpackFinal: async (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": resolve(dirname(fileURLToPath(import.meta.url)), "../src"),
    };
    return config;
  },
};

export default config;
