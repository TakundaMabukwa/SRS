import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function clean(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ success: false, drivers: [], message: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('drivers')
      .select('id, first_name, surname, fleet_number, cell_number, license_number, license_expiry_date, pdp_expiry_date')
      .order('surname');

    if (error) {
      return NextResponse.json({ success: false, drivers: [], message: error.message }, { status: 500 });
    }

    const drivers = (data || []).map((d: any) => ({
      id: String(d.id),
      first_name: clean(d.first_name) || '',
      surname: clean(d.surname) || '',
      fleet_number: clean(d.fleet_number),
      cell_number: clean(d.cell_number),
      license_number: clean(d.license_number),
      license_expiry: clean(d.license_expiry_date),
      pdp_expiry: clean(d.pdp_expiry_date),
    }));

    return NextResponse.json({ success: true, drivers });
  } catch (error: any) {
    return NextResponse.json({ success: false, drivers: [], error: error.message }, { status: 500 });
  }
}
