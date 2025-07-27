import { NextRequest, NextResponse } from 'next/server'

// Proxy requests to Prometheus
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || '/api/v1/query'
  
  // Remove the path param and forward the rest
  searchParams.delete('path')
  
  try {
    const prometheusUrl = `https://metrics.gmac.io${path}?${searchParams.toString()}`
    
    const response = await fetch(prometheusUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.OAUTH_TOKEN}`,
      },
    })
    
    const data = await response.json()
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Prometheus proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}