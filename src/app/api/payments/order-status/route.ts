import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrderById } from '@/lib/payments/PaymentService';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = request.nextUrl.searchParams.get('order');
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order parameter' }, { status: 400 });
    }

    const order = await getOrderById(orderId, user.id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
