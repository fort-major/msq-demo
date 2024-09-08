interface ImportMeta {
  env: {
    DEV: boolean;
    MODE: "dev" | "ic";
    VITE_DEMO_BACKEND_CANISTER_ID: string;
    VITE_ROOT_KEY: string;
    VITE_IC_HOST: string;
  };
}

declare module "*.svg" {
  const content: string;
  export default content;
}
