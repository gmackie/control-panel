import * as React from 'react'

type Props = { children: React.ReactNode; className?: string; value?: string; onValueChange?: (v: string)=>void }

export function Select({ children, className }: Props) {
  return <div className={className}>{children}</div>
}

export function SelectTrigger({ children, className }: Props) {
  return <div className={className}>{children}</div>
}

export function SelectValue({ children }: Props) {
  return <div>{children}</div>
}

export function SelectContent({ children }: Props) {
  return <div>{children}</div>
}

export function SelectItem({ children, className }: Props & { value: string }) {
  return <div className={className}>{children}</div>
}

