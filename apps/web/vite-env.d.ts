declare module "node:url" {
  export function fileURLToPath(url: string | { href: string }): string;
}

declare class URL {
  constructor(input: string, base?: string | URL);
  readonly href: string;
}

interface ImportMeta {
  readonly url: string;
  readonly env: {
    readonly BASE_URL: string;
  };
}
