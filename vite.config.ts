import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 根據當前模式（development 或 production）載入環境變數
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // 【修正1】將 base: '/AI-/' 移到這裡，確保它生效
    base: '/AI-/',

    plugins: [react()],
    
    // 【修正2】define 和 resolve 也都放在同一個 return 物件中
    define: {
      // 警告：請看下方的安全性說明！
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // 建議指向 src 資料夾
      },
    },
  };
});