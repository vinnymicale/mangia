import { NextResponse } from 'next/server'
import { listTagsWithCounts } from '@/lib/db/tags'

export async function GET() {
  return NextResponse.json(await listTagsWithCounts())
}
