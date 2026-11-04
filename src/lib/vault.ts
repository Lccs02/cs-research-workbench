import { Data, validateData } from './model';

export type Envelope = {
  format: 'research-vault-v1'; kdf: 'PBKDF2-SHA256'; iterations: number;
  salt: string; iv: string; ciphertext: string;
};
export type Snapshot = { schemaVersion: 1; data: Data; revision: number; updatedAt: string };
export const STORAGE_KEY = 'cs-research-workbench:vault:v1';
export const ITERATIONS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, x => String.fromCharCode(x)).join(''));
const decode = (s: string) => Uint8Array.from(atob(s), x => x.charCodeAt(0));
export function parseEnvelope(value: unknown): Envelope {
  const e = value as Envelope;
  if (!e || e.format !== 'research-vault-v1' || e.kdf !== 'PBKDF2-SHA256' ||
      !Number.isInteger(e.iterations) || e.iterations < 600000 || e.iterations > 2000000 ||
      typeof e.salt !== 'string' || typeof e.iv !== 'string' || typeof e.ciphertext !== 'string' ||
      e.ciphertext.length > 12000000 || decode(e.salt).length !== 16 || decode(e.iv).length !== 12) {
    throw Error('加密备份格式无效。');
  }
  return e;
}
export async function deriveKey(password: string, salt: string, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt), iterations}, material,
    {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
export async function seal(snapshot: Snapshot, key: CryptoKey, template: Pick<Envelope, 'salt'|'iterations'>): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc.encode(JSON.stringify(snapshot)));
  return {format:'research-vault-v1', kdf:'PBKDF2-SHA256', iterations:template.iterations, salt:template.salt,
    iv:encode(iv), ciphertext:encode(new Uint8Array(bytes))};
}
export async function openEnvelope(input: unknown, password: string) {
  const envelope = parseEnvelope(input);
  const key = await deriveKey(password, envelope.salt, envelope.iterations);
  let value: Snapshot;
  try {
    const bytes = await crypto.subtle.decrypt({name:'AES-GCM', iv:decode(envelope.iv)}, key, decode(envelope.ciphertext));
    value = JSON.parse(dec.decode(bytes));
  } catch { throw Error('口令不正确，或备份文件已损坏。'); }
  if(value.schemaVersion !== 1 || !Number.isInteger(value.revision) || value.revision < 0) throw Error('不支持的备份版本。');
  value.data = validateData(value.data);
  return {snapshot:value, key, envelope};
}
export function salt() { return encode(crypto.getRandomValues(new Uint8Array(16))); }

// This only prepares a replacement. Persist it after checking for concurrent writes.
export async function rekeyEnvelope(input: unknown, currentPassword: string, newPassword: string) {
  if(newPassword.length < 12) throw Error('新口令至少需要 12 个字符。');
  if(newPassword === currentPassword) throw Error('新口令不能与当前口令相同。');
  const opened = await openEnvelope(input, currentPassword);
  const template = {salt: salt(), iterations: ITERATIONS};
  const key = await deriveKey(newPassword, template.salt, template.iterations);
  const envelope = await seal(opened.snapshot, key, template);
  return {snapshot: opened.snapshot, key, envelope};
}
