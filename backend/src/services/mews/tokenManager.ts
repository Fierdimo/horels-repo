import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export type AuthTokens = {
  ClientToken: string
  AccessToken: string
}

export type AuthHeaders = Record<string, string>;

function findFirstVar(names: string[]): string | undefined {
  for (const name of names) {
    if (process.env[name]) return process.env[name]
  }
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [k, ...rest] = trimmed.split('=')
      const key = k.trim()
      if (names.includes(key)) return rest.join('=').trim().replace(/^\"|\"$/g, '').replace(/^'|'$/g, '')
    }
  }
  return undefined
}

export default class TokenManager {
  private cached?: { token: string; expiresAt: number; type: 'bearer' | 'connector' };

  constructor(private opts?: { tokenUrl?: string; clientId?: string; clientSecret?: string; clientToken?: string; accessToken?: string } ) {
    this.opts = opts || {};
  }

  private now() {
    return Date.now();
  }

  // Return raw connector tokens (preferred for Connector API)
  async getTokens(): Promise<AuthTokens> {
    const client = this.opts?.clientToken ?? findFirstVar(['MEWS_CLIENT_TOKEN', 'MEWS_CONNECTOR_CLIENT_TOKEN', 'CLIENTTOKEN', 'CLIENT_TOKEN', 'CONNECTOR_CLIENT_TOKEN', 'MEWS_CLIENT'])
    const access = this.opts?.accessToken ?? findFirstVar(['MEWS_ACCESS_TOKEN', 'MEWS_CONNECTOR_ACCESS_TOKEN', 'ACCESS_TOKEN', 'ACCESS', 'CONNECTOR_ACCESS_TOKEN', 'MEWS_ACCESS'])
    if (client && access) return { ClientToken: client, AccessToken: access }

    // fallback to OAuth flow if configured
    const tokenUrl = this.opts?.tokenUrl ?? process.env.MEWS_TOKEN_URL
    const clientId = this.opts?.clientId ?? process.env.MEWS_CLIENT_ID
    const clientSecret = this.opts?.clientSecret ?? process.env.MEWS_CLIENT_SECRET
    if (!tokenUrl || !clientId || !clientSecret) {
      throw new Error('Mews tokens not found and OAuth not configured')
    }

    if (this.cached && this.cached.expiresAt - 60000 > this.now()) {
      if (this.cached.type === 'bearer') return { ClientToken: '', AccessToken: this.cached.token }
    }

    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
    const res = await fetch(tokenUrl, { method: 'POST', body: body.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Failed obtaining token: ${res.status} ${txt}`)
    }
    const json = await res.json() as any
    const token = json.access_token
    const expires = json.expires_in || 300
    this.cached = { token, expiresAt: this.now() + expires * 1000, type: 'bearer' }
    return { ClientToken: '', AccessToken: token }
  }

  async getAuthHeaders(): Promise<AuthHeaders> {
    const tokens = await this.getTokens()
    if (tokens.ClientToken && tokens.AccessToken) return { ClientToken: tokens.ClientToken, AccessToken: tokens.AccessToken, Client: process.env.MEWS_CLIENT ?? 'SW2-Connector' }
    if (tokens.AccessToken) return { Authorization: `Bearer ${tokens.AccessToken}` }
    return {}
  }

  // For idempotency keys used by adapter
  generateIdempotencyKey(prefix = 'sw2') {
    return `${prefix}-${crypto.randomBytes(8).toString('hex')}`
  }
}
