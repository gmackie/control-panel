"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Check, X, Loader2 } from "lucide-react";

export interface EditableTextProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  disabled?: boolean;
  maxLength?: number;
  multiline?: boolean;
  showEditIcon?: boolean;
  emptyText?: string;
}

export function EditableText({
  value,
  onSave,
  placeholder = "Click to edit",
  className,
  inputClassName,
  as: Component = "span",
  disabled = false,
  maxLength = 100,
  multiline = false,
  showEditIcon = true,
  emptyText = "Add text...",
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Update local value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  }, [disabled, value]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  }, [value]);

  const handleSave = useCallback(async () => {
    const trimmedValue = editValue.trim();

    // Don't save if unchanged
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    // Validate
    if (!trimmedValue) {
      setError("Cannot be empty");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel, multiline]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Don't blur if clicking save/cancel buttons
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest("[data-editable-actions]")) {
        return;
      }
      handleSave();
    },
    [handleSave]
  );

  if (isEditing) {
    const InputComponent = multiline ? "textarea" : "input";

    return (
      <div className="inline-flex items-center gap-2 w-full">
        <InputComponent
          ref={inputRef as any}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          maxLength={maxLength}
          disabled={isSaving}
          placeholder={placeholder}
          className={cn(
            "flex-1 bg-transparent border-b-2 border-blue-500 outline-none",
            "px-1 py-0.5 -mx-1",
            "text-inherit font-inherit",
            error && "border-red-500",
            inputClassName
          )}
          rows={multiline ? 3 : undefined}
        />
        <div className="flex items-center gap-1" data-editable-actions>
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                className="p-1 hover:bg-gray-800 rounded text-green-500 hover:text-green-400"
                title="Save (Enter)"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300"
                title="Cancel (Escape)"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {error && (
          <span className="text-xs text-red-500 ml-2">{error}</span>
        )}
      </div>
    );
  }

  return (
    <Component
      className={cn(
        "group inline-flex items-center gap-2 cursor-pointer",
        "hover:bg-gray-800/50 rounded px-1 -mx-1 transition-colors",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
      onClick={handleStartEdit}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleStartEdit();
        }
      }}
    >
      <span className={cn(!value && "text-gray-500 italic")}>
        {value || emptyText}
      </span>
      {showEditIcon && !disabled && (
        <Pencil className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Component>
  );
}
