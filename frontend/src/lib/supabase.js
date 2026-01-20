import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Only create client if configured, otherwise create a dummy client
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : { auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }), signUp: () => Promise.resolve({}), signInWithPassword: () => Promise.resolve({}), signInWithOAuth: () => Promise.resolve({}), signOut: () => Promise.resolve({}) }, from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({}) }) }) }) }) }

export const isSupabaseConfigured = () => {
  return supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== ''
}
