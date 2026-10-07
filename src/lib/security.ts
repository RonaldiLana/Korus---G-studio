import crypto from "crypto";
import { promisify } from "util";
import type { Request, Response, NextFunction } from "express";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const SESSION_TTL_SECONDS = 12 * 60 * 60;

const sessionSecret =
  process.env.SESSION_SECRET ||
  (() => {
    console.warn("[SECURITY] SESSION_SECRET não definido: usando segredo efêmero (sessões caem a cada reinício).");
    return crypto.randomBytes(32).toString("hex");
  })();

export interface SessionPayload {
  sub: number;
  role: string;
  agency_id: number | null;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: SessionPayload;
    }
  }
}

const b64u = (value: string) => Buffer.from(value).toString("base64url");
const hmac = (data: string) => crypto.createHmac("sha256", sessionSecret).update(data).digest("base64url");

export function signSession(user: { id: number; role: string; agency_id?: number | null }): string {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      agency_id: user.agency_id ?? null,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    } satisfies SessionPayload)
  );
  return `${header}.${body}.${hmac(`${header}.${body}`)}`;
}

export function verifySession(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = Buffer.from(hmac(`${parts[0]}.${parts[1]}`));
  const received = Buffer.from(parts[2]);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** `legacy` indica senha ainda em texto puro, que deve ser regravada com hash. */
export async function verifyPassword(plain: string, stored: string): Promise<{ ok: boolean; legacy: boolean }> {
  if (!stored.startsWith("scrypt$")) {
    const a = Buffer.from(plain);
    const b = Buffer.from(stored);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { ok, legacy: ok };
  }
  const [, saltHex, hashHex] = stored.split("$");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(plain, Buffer.from(saltHex, "hex"), expected.length);
  return { ok: crypto.timingSafeEqual(expected, actual), legacy: false };
}

export function createRateLimiter(maxAttempts: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt < now) hits.delete(key);
  }, windowMs).unref();

  return {
    isBlocked(key: string): boolean {
      const entry = hits.get(key);
      return !!entry && entry.resetAt > Date.now() && entry.count >= maxAttempts;
    },
    fail(key: string) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt < now) hits.set(key, { count: 1, resetAt: now + windowMs });
      else entry.count++;
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}

// Rotas sem sessão: login, acompanhamento do cliente, arquivos/logos em <img>/<iframe> e webhooks externos
const PUBLIC_ROUTES: Array<[string, RegExp]> = [
  ["POST", /^\/api\/login$/],
  ["POST", /^\/api\/processes\/start$/],
  ["GET", /^\/api\/processes\/track\/[^/]+$/],
  ["POST", /^\/api\/documents\/track\/[^/]+$/],
  ["GET", /^\/api\/files\/[^/]+$/],
  ["GET", /^\/api\/agencies\/\d+\/logo$/],
  ["GET", /^\/api\/agencies\/by-slug\/[^/]+$/],
  ["GET", /^\/api\/whatsapp\/web-proxy$/],
  ["POST", /^\/api\/whatsapp\/webhook(\/[^/]+)?$/],
  ["POST", /^\/api\/contracts\/webhook$/],
];

const ENFORCE = process.env.AUTH_ENFORCE !== "false";

function claimedAgencyId(req: Request): number | null {
  const fromPath = req.path.match(/^\/api\/(?:agencies|whatsapp\/(?:status|connect|qr|disconnect))\/(\d+)/);
  const raw = fromPath?.[1] ?? req.query.agency_id ?? req.query.agencyId ?? (req.body as any)?.agency_id;
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) return next();

  const header = req.headers.authorization;
  const session = header?.startsWith("Bearer ") ? verifySession(header.slice(7)) : null;
  if (session) req.auth = session;

  if (!ENFORCE || PUBLIC_ROUTES.some(([method, re]) => method === req.method && re.test(req.path))) return next();

  if (!session) return res.status(401).json({ error: "Sessão inválida ou expirada" });

  // Isolamento entre agências: não-master só acessa a própria agência
  if (session.role !== "master" && session.agency_id != null) {
    const requested = claimedAgencyId(req);
    if (requested !== null && requested !== session.agency_id) {
      return res.status(403).json({ error: "Acesso negado a outra agência" });
    }
  }

  // O papel informado na query não pode divergir do papel da sessão
  for (const key of ["role", "user_role"] as const) {
    const claimed = req.query[key];
    if (typeof claimed === "string" && claimed !== session.role) {
      return res.status(403).json({ error: "Papel inconsistente com a sessão" });
    }
  }

  next();
}
