import { NextResponse } from 'next/server';
import { storeGet } from '@/lib/store';

export async function GET(req, { params }) {
  const logs = await storeGet('panel:logs:' + params.id, []);
  return NextResponse.json(logs);
}
