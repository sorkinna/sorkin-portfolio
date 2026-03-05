import { createClient } from "@supabase/supabase-js";

export const supabaseVilr = createClient(
  process.env.NEXT_PUBLIC_VILR_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_VILR_SUPABASE_KEY!
);