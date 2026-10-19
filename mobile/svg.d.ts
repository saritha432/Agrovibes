declare module "*.svg" {
  const content: number | string | { uri?: string; default?: string };
  export default content;
}

declare module "*.wav" {
  const asset: number;
  export default asset;
}
