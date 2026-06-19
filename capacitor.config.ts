import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.local.progress.tracker",
  appName: "科研进度管理平台",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
