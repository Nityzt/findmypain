import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  // Match prototype: disable Strict Mode to prevent double-mounting WebGL Canvas
  // React StrictMode mounts components twice in dev → two GPU contexts → context loss
  reactStrictMode: false,
  reactCompiler: false,
  turbopack: {},
  serverExternalPackages: [],
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  env: {
    NEXT_PUBLIC_VAPI_API_KEY:
      process.env.NEXT_PUBLIC_VAPI_API_KEY ||
      process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ||
      process.env.VITE_VAPI_PUBLIC_KEY ||
      process.env.VITE_VAPI_API_KEY ||
      "",
    NEXT_PUBLIC_VAPI_ASSISTANT_ID:
      process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ||
      process.env.VITE_VAPI_ASSISTANT_ID ||
      "",
  },
};

export default nextConfig;
