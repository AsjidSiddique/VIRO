// lib/supabaseNoop.js
// Webpack alias target — replaces @supabase/supabase-js with a no-op
// so it can never be bundled and cause the "auth" crash.
// This file is NEVER called at runtime — it just satisfies the module resolver.
export const createClient = () => ({})
const noopModule = { createClient: () => ({}) }
export default noopModule
