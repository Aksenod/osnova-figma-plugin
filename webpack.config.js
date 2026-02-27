const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = (env, argv) => ({
  mode: argv.mode || 'production',
  devtool: false,

  entry: {
    code: './src/code.ts',
    ui: './src/ui.tsx',
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },

  optimization: {
    minimizer: ['...', new CssMinimizerPlugin()],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/ui/index.html',
      filename: 'ui.html',
      chunks: ['ui'],
      inject: 'body',
      cache: false,
    }),
    new HtmlInlineScriptPlugin(),
  ],
});
