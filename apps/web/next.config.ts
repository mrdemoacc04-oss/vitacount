import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vita's voice (Kokoro TTS) runs on onnxruntime-node — a native addon that must be
  // required at runtime, not bundled.
  serverExternalPackages: ["kokoro-js", "@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
