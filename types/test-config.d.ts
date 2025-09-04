declare module '@playwright/test' {
  export function defineConfig(config: any): any;
  export const devices: Record<string, any>;
}

declare module 'vitest/config' {
  export function defineConfig(config: any): any;
}

declare module 'vitest' {
  export const vi: any;
}

declare module '@vitejs/plugin-react' {
  const react: () => any;
  export default react;
}
