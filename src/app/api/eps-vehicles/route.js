import { NextResponse } from 'next/server'

export async function GET(request) {
  // EPS integration intentionally disabled for this project.
  return NextResponse.json(
    { success: true, disabled: true, message: 'EPS integration disabled', data: [] },
    { status: 200 }
  )
}
