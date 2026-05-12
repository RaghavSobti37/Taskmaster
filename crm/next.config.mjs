/** @type {import('next').NextConfig} */
const basePath = "/crm";
const nextConfig = {
  basePath,
  assetPrefix: basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
