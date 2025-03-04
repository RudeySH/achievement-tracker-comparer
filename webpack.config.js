const path = require('path');
const { UserscriptPlugin } = require('webpack-userscript');

var config = {
  entry: './src/index.ts',
  externals: {
    'es6-promise-pool': 'PromisePool',
    'he': 'he',
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
    filename: 'achievement-tracker-comparer.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new UserscriptPlugin({
      headers: {
        name: 'Achievement Tracker Comparer',
        include: [
          '/^https://steamcommunity\\.com/id/[a-zA-Z0-9_-]{3,32}/*$/',
          '/^https://steamcommunity\\.com/profiles/\\d{17}/*$/',
        ],
        connect: [
          'astats.nl',
          'completionist.me',
          'exophase.com',
          'metagamerscore.com',
          'steamhunters.com',
        ],
        grant: [
          'GM.getValue',
          'GM.setValue',
          'GM.xmlHttpRequest',
        ],
        license: 'AGPL-3.0-or-later',
        namespace: 'https://github.com/RudeySH/achievement-tracker-comparer',
        require: [
          'https://cdnjs.cloudflare.com/ajax/libs/es6-promise-pool/2.5.0/es6-promise-pool.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/he/1.2.0/he.min.js',
        ],
      },
      downloadBaseURL: 'https://raw.githubusercontent.com/RudeySH/achievement-tracker-comparer/main/dist/',
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
