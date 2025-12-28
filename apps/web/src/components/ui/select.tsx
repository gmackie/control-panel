import * as React from 'react'

type Props = { 
  children?: React.ReactNode; 
  className?: string; 
  value?: string; 
  onValueChange?: (v: string) => void;
  placeholder?: string;
}

export function Select({ children, className, value, onValueChange }: Props) {
  return <div className={className} data-value={value}>{children}</div>
}

export function SelectTrigger({ children, className }: Props) {
  return <div className={className}>{children}</div>
}

export function SelectValue({ children, placeholder }: Props) {
  return <div>{children || placeholder}</div>
}

export function SelectContent({ children }: Props) {
  return <div>{children}</div>
}

export function SelectItem({ children, className, value }: Props & { value: string }) {
  return <div className={className} data-value={value}>{children}</div>
}
