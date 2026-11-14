import type { NextConfig } from 'next';

/**
 * URL interna de la API dentro de la red Docker (nombre de servicio, nunca localhost).
 * Ej.: API_INTERNAL_URL=http://api:8000 en docker-compose.yml.
 * El navegador llama a /backend/* (mismo origen) y el servidor Next.js reenvia
 * la peticion al contenedor "api" por la red interna de Docker.
 */
const apiInternalUrl = process.env.API_INTERNAL_URL?.replace(/\/$/, '');

const nextConfig: NextConfig = {
	agentRules: false,
	turbopack: {
		root: process.cwd(),
	},
	async rewrites() {
		if (!apiInternalUrl) {
			return [];
		}
		return [
			{
				source: '/backend/:path*',
				destination: `${apiInternalUrl}/:path*`,
			},
		];
	},
};

export default nextConfig;
