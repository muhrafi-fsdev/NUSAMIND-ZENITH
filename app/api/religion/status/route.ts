import { NextResponse } from 'next/server';
import { religionSummary } from '@/lib/religion';
export const runtime='nodejs';
export async function GET(){return NextResponse.json({ok:true,...religionSummary()});}
