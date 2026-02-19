import * as React from 'react'

export function Sheet({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function SheetTrigger({ children }: { children: React.ReactNode }) {
  return <button type="button">{children}</button>
}

export function SheetContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function SheetHeader({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <h3>{children}</h3>
}

export function SheetDescription({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}

