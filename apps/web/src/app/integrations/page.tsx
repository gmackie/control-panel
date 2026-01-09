'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function IntegrationsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/integrations/dashboard')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading Integrations...</span>
      </div>
    </div>
  )
}
