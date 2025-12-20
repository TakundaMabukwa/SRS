import { createClient } from '@supabase/supabase-js'

let _supabase = null

export function getSupabase() {
  if (typeof window === 'undefined') return null
  
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (supabaseUrl && supabaseKey) {
      _supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      })
    }
  }
  return _supabase
}

export const supabase = typeof window !== 'undefined' ? getSupabase() : null