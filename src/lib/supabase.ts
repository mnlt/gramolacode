import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Artifact {
  id: string
  code: string
  user_id: string | null
  created_at: string
}

export interface Comment {
  id: string
  artifact_id: string
  user_id: string | null
  user_name: string
  message: string
  created_at: string
}