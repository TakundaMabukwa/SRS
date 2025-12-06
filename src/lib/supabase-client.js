import { createClient } from '@supabase/supabase-js'

let _supabase = null

export const supabase = (() => {
  if (!_supabase && typeof window !== 'undefined') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (supabaseUrl && supabaseKey) {
      _supabase = createClient(supabaseUrl, supabaseKey)
    }
  }
  return _supabase
})()