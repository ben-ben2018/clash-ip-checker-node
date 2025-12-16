const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'production',
  entry: './clash_automator.ts',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'clash_automator.bundle.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  externals: [
    // 只排除 playwright 相关模块（包含浏览器二进制文件，无法打包）
    // 其他所有依赖都会被打包进 bundle
    nodeExternals({
      // 允许打包所有模块，除了 playwright
      allowlist: [
        /^(?!playwright$|playwright-core$).*$/,
      ],
    }),
    // 明确排除 playwright 相关模块
    {
      'playwright': 'commonjs playwright',
      'playwright-core': 'commonjs playwright-core',
    },
  ],
  optimization: {
    minimize: false, // 不压缩，便于调试
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};

