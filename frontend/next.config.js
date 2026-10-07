/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = {
    // NEXT_PUBLIC_* подставляется при next build; задайте NEXT_PUBLIC_DOMAIN в .env.production на сервере перед сборкой.
    env: {
        NEXT_PUBLIC_DOMAIN:
            process.env.NEXT_PUBLIC_DOMAIN ||
            (process.env.NODE_ENV === 'production'
                ? 'https://jbi.kord.uz'
                : 'http://localhost:5009'),
    },
    images: {
        // Обновлено для Next.js 16 - используем remotePatterns вместо domains
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'jbi.kord.uz',
                pathname: '/api/upload/image/**',
            },
            {
                protocol: 'https',
                hostname: 'mebers.kord.uz',
                pathname: '/api/upload/image/**',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '5009',
                pathname: '/api/upload/image/**',
            },
        ],
    },
    // В Next.js 16 Server Actions включены по умолчанию
    // Настраиваем их для безопасности
    experimental: {
        serverActions: {
            allowedOrigins: [],
        },
    },
    reactStrictMode: true,
    turbopack: {},
    webpack(config, options) {
        // Блокируем выполнение shell команд во время сборки
        config.resolve.fallback = {
            ...config.resolve.fallback,
            child_process: false,
            fs: false,
        };
        
        config.module.rules.push({
            loader: '@svgr/webpack',
            issuer: /\.[jt]sx?$/,
            options: {
                prettier: false,
                svgo: true,
                svgoConfig: {
                    plugins: [
                        {
                            name: 'preset-default',
                            params: {
                                overrides: {
                                    removeViewBox: false,
                                },
                            },
                        }
                    ],
                },
                titleProp: true,
            },
            test: /\.svg$/,
        });

        return config;
    },
};
