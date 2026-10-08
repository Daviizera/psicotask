import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const HASH_PATTERN = /^scrypt\$131072\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/;
const SCRYPT_OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  const passwordBytes = Buffer.from(password, "utf8");
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(passwordBytes, salt, 64, SCRYPT_OPTIONS, (error, key) => {
        if (error) reject(error);
        else resolve(key);
      });
    });
  } finally {
    passwordBytes.fill(0);
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  try {
    return `scrypt$131072$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
  } finally {
    key.fill(0);
  }
}

export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const match = storedHash === null ? null : HASH_PATTERN.exec(storedHash);
  // Ausência de usuário ou hash inválido também executa a derivação, evitando
  // o retorno imediato que distinguiria um email inexistente de senha incorreta.
  const salt = match ? Buffer.from(match[1], "hex") : Buffer.alloc(16);
  const expected = match ? Buffer.from(match[2], "hex") : Buffer.alloc(64);
  const actual = await deriveKey(password, salt);
  try {
    const equal = timingSafeEqual(actual, expected);
    return match !== null && equal;
  } finally {
    actual.fill(0);
    expected.fill(0);
  }
}
