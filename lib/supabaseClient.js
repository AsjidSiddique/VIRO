// ── Universal Supabase REST client (browser + server) ────────────────────────
// Replaces @supabase/supabase-js entirely. Uses plain fetch() against
// Supabase REST API (PostgREST + Storage). Zero dependencies. Zero React hooks.
// Safe for SSR, edge runtime, and browser use.
// ─────────────────────────────────────────────────────────────────────────────

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL     || ''
const KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const BASE_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        KEY,
  'Authorization': `Bearer ${KEY}`,
  'Prefer':        'return=representation',
}

// ── Query builder ─────────────────────────────────────────────────────────────
class Query {
  constructor(table) {
    this._table   = table
    this._select  = '*'
    this._filters = []
    this._order   = null
    this._limit   = null
    this._offset  = null
    this._single  = false
    this._maybe   = false
    this._method  = 'GET'
    this._body    = null
    this._count   = null
    this._head    = false
    this._upsert  = false
    this._rpcFn   = null
    this._rpcArgs = null
  }

  select(cols = '*', opts = {}) {
    this._select = cols
    if (opts.count === 'exact') this._count = 'exact'
    if (opts.head) this._head = true
    return this
  }

  // ── Filters ──────────────────────────────────────────────────────────────
  eq(col, val)     { this._filters.push(`${col}=eq.${encodeURIComponent(val)}`);    return this }
  neq(col, val)    { this._filters.push(`${col}=neq.${encodeURIComponent(val)}`);   return this }
  gt(col, val)     { this._filters.push(`${col}=gt.${encodeURIComponent(val)}`);    return this }
  gte(col, val)    { this._filters.push(`${col}=gte.${encodeURIComponent(val)}`);   return this }
  lt(col, val)     { this._filters.push(`${col}=lt.${encodeURIComponent(val)}`);    return this }
  lte(col, val)    { this._filters.push(`${col}=lte.${encodeURIComponent(val)}`);   return this }
  like(col, val)   { this._filters.push(`${col}=like.${encodeURIComponent(val)}`);  return this }
  ilike(col, val)  { this._filters.push(`${col}=ilike.${encodeURIComponent(val)}`); return this }
  is(col, val)     { this._filters.push(`${col}=is.${val}`);                        return this }
  in(col, vals)    { this._filters.push(`${col}=in.(${vals.map(v => encodeURIComponent(v)).join(',')})`); return this }
  or(expr) {
    // PostgREST: string values in or() need quoting if they could be numeric.
    // e.g. phone.eq.03184485469 → phone.eq."03184485469"
    // Replace unquoted .eq. values that aren't already quoted
    const safeExpr = expr.replace(/(\.eq\.)([^,)]+)/g, (m, op, val) => {
      if (val.startsWith('"') || val.startsWith("'")) return m
      // Quote if value starts with digit or + (phone numbers, IDs etc.)
      if (/^[0-9+]/.test(val)) return `${op}"${val}"`
      return m
    })
    this._filters.push(`or=(${safeExpr})`)
    return this
  }
  not(col, op, val) {
    // PostgREST: col=not.op.val  e.g. slug=not.is.null
    this._filters.push(`${col}=not.${op}.${val}`)
    return this
  }
  contains(col, val) {
    // For array/json columns: col=cs.{val1,val2}
    const v = Array.isArray(val) ? `{${val.join(',')}}` : val
    this._filters.push(`${col}=cs.${encodeURIComponent(v)}`)
    return this
  }

  // ── Ordering / pagination ─────────────────────────────────────────────────
  order(col, opts = {}) {
    const dir = opts.ascending === false ? 'desc' : 'asc'
    const nulls = opts.nullsFirst ? '.nullsfirst' : opts.nullsLast ? '.nullslast' : ''
    this._order = `${col}.${dir}${nulls}`
    return this
  }
  limit(n)      { this._limit  = n;    return this }
  offset(n)     { this._offset = n;    return this }
  // range(from, to) — PostgREST uses offset + limit to implement range
  range(from, to) {
    this._offset = from
    this._limit  = to - from + 1
    return this
  }
  single()      { this._single = true; return this }
  maybeSingle() { this._maybe  = true; return this }

  // ── Mutations ─────────────────────────────────────────────────────────────
  insert(body) {
    this._method = 'POST'
    this._body   = Array.isArray(body) ? body : [body]
    return this
  }
  update(body) {
    this._method = 'PATCH'
    this._body   = body
    return this
  }
  upsert(body, opts = {}) {
    this._method  = 'POST'
    this._body    = Array.isArray(body) ? body : [body]
    this._upsert  = true
    this._onConflict = opts.onConflict || null
    return this
  }
  delete() {
    this._method = 'DELETE'
    return this
  }
  rpc(fn, args) {
    this._rpcFn   = fn
    this._rpcArgs = args
    this._method  = 'POST'
    return this
  }

  // ── Promise interface ─────────────────────────────────────────────────────
  then(resolve, reject) {
    return this._execute().then(resolve, reject)
  }
  catch(fn) { return this.then(r => r, fn) }

  async _execute() {
    if (!URL_BASE || !KEY) {
      return { data: null, error: { message: 'Missing Supabase env vars' }, count: null }
    }

    try {
      let url, headers = { ...BASE_HEADERS }, body = undefined

      if (this._rpcFn) {
        url  = `${URL_BASE}/rest/v1/rpc/${this._rpcFn}`
        body = JSON.stringify(this._rpcArgs || {})
      } else {
        const params = []
        if (this._select && this._method === 'GET') {
          // PostgREST requires literal special chars in select (commas, parens for joins).
          // encodeURIComponent() breaks join syntax like categories(name,slug) → DO NOT encode.
          // Only encode the value portion of filter params (handled in each filter method).
          // Strip spaces — PostgREST rejects spaces in select (browser encodes as %20 → 400)
          params.push(`select=${this._select.replace(/\s/g, '')}`)
        }
        if (this._filters.length) params.push(...this._filters)
        if (this._order)  params.push(`order=${this._order}`)
        if (this._offset) params.push(`offset=${this._offset}`)
        if (this._limit)  params.push(`limit=${this._limit}`)

        let prefer = 'return=representation'
        if (this._upsert)  prefer += ',resolution=merge-duplicates'
        if (this._count)   prefer += ',count=exact'
        if (this._head)    prefer += ',count=exact'
        headers['Prefer'] = prefer

        // BUGFIX: on_conflict was captured in this._onConflict but never
        // actually sent to PostgREST. Without it, PostgREST falls back to
        // the table's PRIMARY KEY as the conflict target — so an upsert
        // meant to match on a unique column (e.g. session_id, key) that
        // ISN'T the primary key silently just inserts duplicate rows
        // instead of updating the existing one.
        if (this._upsert && this._onConflict) params.push(`on_conflict=${encodeURIComponent(this._onConflict)}`)

        url = `${URL_BASE}/rest/v1/${this._table}${params.length ? '?' + params.join('&') : ''}`
        if (this._body) body = JSON.stringify(this._body)
      }

      const method = this._head ? 'HEAD' : this._method
      // ── Timeout: abort after 8s so Vercel function never times out waiting for Supabase ──
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      let resp
      try {
        resp = await fetch(url, { method, headers, body, signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      const countHdr = resp.headers.get('content-range')?.split('/')[1] || null

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText)
        return { data: null, error: { message: errText, status: resp.status }, count: null }
      }

      if (method === 'HEAD' || method === 'DELETE') {
        return { data: null, error: null, count: countHdr ? +countHdr : null }
      }

      const text = await resp.text()
      const json = text ? JSON.parse(text) : null

      if (this._single) {
        if (!json || (Array.isArray(json) && !json.length)) {
          return { data: null, error: { message: 'Not found' }, count: null }
        }
        return { data: Array.isArray(json) ? json[0] : json, error: null, count: countHdr }
      }
      if (this._maybe) {
        if (!json || (Array.isArray(json) && !json.length)) {
          return { data: null, error: null, count: null }
        }
        return { data: Array.isArray(json) ? json[0] : json, error: null, count: null }
      }

      return { data: json, error: null, count: countHdr ? +countHdr : null }
    } catch (e) {
      return { data: null, error: { message: e.message }, count: null }
    }
  }
}

// ── Storage helper ────────────────────────────────────────────────────────────
class StorageBucket {
  constructor(bucket) { this._bucket = bucket }

  async upload(path, file, opts = {}) {
    const ct = opts.contentType || file.type || 'application/octet-stream'
    const headers = {
      'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': ct,
    }
    if (opts.upsert) headers['x-upsert'] = 'true'
    const resp = await fetch(`${URL_BASE}/storage/v1/object/${this._bucket}/${path}`, {
      method: 'POST', headers, body: file,
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: resp.statusText }))
      return { data: null, error: err }
    }
    return { data: { path }, error: null }
  }

  async remove(paths) {
    const resp = await fetch(`${URL_BASE}/storage/v1/object/${this._bucket}`, {
      method: 'DELETE',
      headers: { ...BASE_HEADERS },
      body: JSON.stringify({ prefixes: paths }),
    })
    if (!resp.ok) return { data: null, error: { message: resp.statusText } }
    return { data: paths, error: null }
  }

  async list(prefix = '', opts = {}) {
    const resp = await fetch(`${URL_BASE}/storage/v1/object/list/${this._bucket}`, {
      method: 'POST',
      headers: { ...BASE_HEADERS },
      body: JSON.stringify({ prefix, limit: opts.limit || 100, offset: opts.offset || 0 }),
    })
    if (!resp.ok) return { data: null, error: { message: resp.statusText } }
    const data = await resp.json()
    return { data, error: null }
  }

  getPublicUrl(path) {
    return {
      data: { publicUrl: `${URL_BASE}/storage/v1/object/public/${this._bucket}/${path}` }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export const browserSupabase = {
  from:    (table)    => new Query(table),
  rpc:     (fn, args) => new Query(null).rpc(fn, args),
  storage: { from: (bucket) => new StorageBucket(bucket) },
}

export default browserSupabase
