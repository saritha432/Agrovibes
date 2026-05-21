declare module "*.svg" {
  const content: number | string | { uri?: string; default?: string };
  export default content;
}
