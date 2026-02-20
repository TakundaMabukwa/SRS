import { NextResponse } from 'next/server'

export async function GET(request) {
  // CTrack integration intentionally disabled for this project.
  return NextResponse.json(
    { success: true, disabled: true, message: 'CTrack integration disabled', vehicles: [] },
    { status: 200 }
  )
}
