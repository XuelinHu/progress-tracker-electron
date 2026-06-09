import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.local.progress.tracker",
  appName: "项目进度跟踪",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
