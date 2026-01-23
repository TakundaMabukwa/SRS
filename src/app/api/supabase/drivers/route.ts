import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, first_name, surname')
    .limit(50);

  if (error) {
    return NextResponse.json({ data: [] });
  }

  return NextResponse.json({ data });
}
