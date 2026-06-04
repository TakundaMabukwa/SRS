import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_request: NextRequest) {
  return Response.json({
    success: true,
    data: [],
  })
}
