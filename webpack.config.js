// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require("path");
const process = require("process");
const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const isProduction = process.env.NODE_ENV == "production";

const commonConfig = {
  devServer: {
    open: true,
    host: "localhost",
  },
  devtool: "cheap-source-map", //Necessary to avoid evals in dev mode which would need loose CSP rules.
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/i,
        loader: "babel-loader",
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"], // NB: no 'style-loader' with MCEP; throws errors.
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
        type: "asset",
      },
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [new ForkTsCheckerWebpackPlugin()],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  // Did nothing to build times, curiously.
  // cache: {
  //   type: "filesystem",
  //   buildDependencies: {
  //     config: [__filename],
  //   }
  // }
};

const rendererConfig = merge(commonConfig, {
  entry: ["./src/renderer/index.ts"],
  target: "electron18.2-renderer",
  output: {
    path: path.resolve(__dirname, "dist/renderer"),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "src/renderer/index.html"
    }),
    new MiniCssExtractPlugin(),
  ],
});

const mainConfig = merge(commonConfig, {
  entry: ["./src/main/index.ts"],
  target: "electron18.2-main",
  output: {
    path: path.resolve(__dirname, "dist/main"),
  },
});

const preloadConfig = merge(commonConfig, {
  entry: "./src/main/preload.ts",
  target: "electron18.2-preload",
  output: {
    path: path.resolve(__dirname, "dist/main"),
    filename: "preload.js",
  },
});

module.exports = () => {
  let configMode = isProduction ? "production" : "development";
  let configs = [rendererConfig, mainConfig, preloadConfig];
  for (let c of configs) {
    c.mode = configMode;
  }
  return configs;
};
