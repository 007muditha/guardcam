const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'web/index.js'),
  output: {
    path: path.resolve(__dirname, 'web/dist'),
    filename: 'bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js'],
    alias: {
      'react-native$': 'react-native-web',
      'react-native-vision-camera': path.resolve(__dirname, 'src/mocks/vision-camera.ts'),
      'react-native-keep-awake': path.resolve(__dirname, 'src/mocks/keep-awake.ts'),
      '@react-native-camera-roll/camera-roll': path.resolve(__dirname, 'src/mocks/camera-roll.ts'),
      '@react-native-google-signin/google-signin': path.resolve(__dirname, 'src/mocks/google-signin.ts'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/mocks/async-storage.ts'),
      'react-native-fs': path.resolve(__dirname, 'src/mocks/rnfs.ts'),
      'react-native-worklets-core': path.resolve(__dirname, 'src/mocks/worklets-core.ts'),
    },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules\/(?!(react-native|@react-native|react-native-web|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|@react-navigation|react-native-vector-icons)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@react-native/babel-preset', '@babel/preset-typescript'],
            plugins: ['react-native-web'],
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'web/index.html'),
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },
};
