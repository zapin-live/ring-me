import path from 'path'
import webpack from 'webpack'
import CopyWebpackPlugin from 'copy-webpack-plugin'

const config: webpack.Configuration = {
    entry: {
        background: './src/background.ts',
        popup: './src/popup.ts',
        offscreen: './src/offscreen.ts',
    },
    resolve: {
        extensions: [".ts"],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [{from: 'static', globOptions: {ignore: ['**/index.html']}}],
        }),
    ]
}

export default config

