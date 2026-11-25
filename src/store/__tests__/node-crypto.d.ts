declare module 'node:crypto' {
  export interface Hmac {
    update(data: string): Hmac;
    digest(encoding: 'hex'): string;
  }

  export function createHmac(algorithm: string, key: string): Hmac;
}
