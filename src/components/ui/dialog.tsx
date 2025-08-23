import * as React from 'react'

export function Dialog({ children }: { children: React.ReactNode }) {
  return <div role="dialog">{children}</div>
}

export function DialogContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function DialogTrigger({ children }: { children: React.ReactNode }) {
  return <button type="button">{children}</button>
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h3>{children}</h3>
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}
