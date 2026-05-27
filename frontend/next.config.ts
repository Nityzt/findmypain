import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Match prototype: disable Strict Mode to prevent double-mounting WebGL Canvas
  // React StrictMode mounts components twice in dev → two GPU contexts → context loss
  reactStrictMode: false,
  reactCompiler: false,
  turbopack: {},
  serverExternalPackages: [],
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
};

export default nextConfig;
