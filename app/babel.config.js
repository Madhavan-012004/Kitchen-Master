module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ['babel-preset-expo', { jsxRuntime: 'automatic' }]
        ],
        plugins: [
            '@babel/plugin-proposal-export-namespace-from',
            'babel-plugin-transform-import-meta',
            'react-native-reanimated/plugin'
        ],
        overrides: [
            {
                test: /node_modules[\\/](engine\.io-client|socket\.io-client)/,
                plugins: ['babel-plugin-transform-import-meta']
            }
        ]
    };
};
