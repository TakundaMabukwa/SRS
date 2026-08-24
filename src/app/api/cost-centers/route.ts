import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ success: false, costCenters: [], message: 'Supabase client unavailable' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('cost_centers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      return NextResponse.json({ success: false, costCenters: [], message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, costCenters: data || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, costCenters: [], error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Supabase client unavailable' }, { status: 500 });
    }

    const body = await req.json();
    const { name, code, description } = body;
    if (!name || !code) {
      return NextResponse.json({ success: false, message: 'name and code are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('cost_centers')
      .insert({ name, code, description: description || null, is_active: true })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, costCenter: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Supabase client unavailable' }, { status: 500 });
    }

    const body = await req.json();
    const { id, name, code, description } = body;
    if (!id) {
      return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabase
      .from('cost_centers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, costCenter: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Supabase client unavailable' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('cost_centers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Cost center deactivated' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
