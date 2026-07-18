import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://twvksmibddyckzyiafcc.supabase.co";
const supabaseKey = "sb_publishable_NJdRBIcmzHOD9JsHJ_IhSg_lOXTTAf5";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);