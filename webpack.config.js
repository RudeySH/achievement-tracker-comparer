const path = require('path');
const WebpackUserscript = require('webpack-userscript');

var config = {
  entry: './src/index.ts',
  externals: {
    he: 'he',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  mode: 'production',
  optimization: {
    minimize: false,
  },
  output: {
    filename: 'achievement-tracker-comparer.user.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new WebpackUserscript({
      headers: {
        name: 'Achievement Tracker Comparer',
        include: [
          '/^https://steamcommunity\\.com/id/\\w{3,32}/*$/',
          '/^https://steamcommunity\\.com/profiles/\\d{17}/*$/',
        ],
        namespace: 'https://github.com/RudeySH/achievement-tracker-comparer',
        grant: 'GM.xmlHttpRequest',
        connect: [
          'astats.nl',
          'completionist.me',
          'exophase.com',
          'metagamerscore.com',
          'steamhunters.com',
        ],
        require: [
          'https://cdnjs.cloudflare.com/ajax/libs/es6-promise-pool/2.5.0/es6-promise-pool.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/he/1.2.0/he.min.js',
        ],
      },
      downloadBaseUrl: 'https://github.com/RudeySH/achievement-tracker-comparer/raw/main/dist/',
    }),
  ],
};

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    config.devtool = 'inline-source-map';
    config.output.path = path.resolve(__dirname, 'dist', 'development');
    config.watch = true;
  }

  return config;
};
