"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCommandPalette } from "../command-palette/CommandPaletteProvider";

interface Shortcut {
  key: string;
  label: string;
  description: string;
  action: () => void;
  category: 'navigation' | 'actions' | 'views';
}

interface KeyboardShortcutsContextType {
  shortcuts: Shortcut[];
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  pendingPrefix: string | null;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error("useKeyboardShortcuts must be used within a KeyboardShortcutsProvider");
  }
  return context;
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const { setOpen: openCommandPalette } = useCommandPalette();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);
  const [prefixTimeout, setPrefixTimeout] = useState<NodeJS.Timeout | null>(null);

  const shortcuts: Shortcut[] = useMemo(() => [
    { key: 'g h', label: 'Home', description: 'Go to dashboard home', action: () => router.push('/'), category: 'navigation' },
    { key: 'g a', label: 'Applications', description: 'Go to applications', action: () => router.push('/applications'), category: 'navigation' },
    { key: 'g s', label: 'Services', description: 'Go to services', action: () => router.push('/services'), category: 'navigation' },
    { key: 'g c', label: 'Cluster', description: 'Go to cluster management', action: () => router.push('/cluster'), category: 'navigation' },
    { key: 'g d', label: 'Deployments', description: 'Go to deployments', action: () => router.push('/deployments'), category: 'navigation' },
    { key: 'g r', label: 'Registry', description: 'Go to container registry', action: () => router.push('/registry'), category: 'navigation' },
    { key: 'g m', label: 'Monitoring', description: 'Go to monitoring', action: () => router.push('/monitoring'), category: 'navigation' },
    { key: 'g i', label: 'Integrations', description: 'Go to integrations', action: () => router.push('/integrations'), category: 'navigation' },
    { key: 'g $', label: 'Costs', description: 'Go to cost management', action: () => router.push('/costs'), category: 'navigation' },
    { key: 'g p', label: 'Pipeline', description: 'Go to CI/CD pipeline', action: () => router.push('/pipeline'), category: 'navigation' },
    { key: 'g t', label: 'Timeline', description: 'Go to deployment timeline', action: () => router.push('/deployments/timeline'), category: 'navigation' },
    { key: 'n a', label: 'New App', description: 'Create new application', action: () => router.push('/applications?action=create'), category: 'actions' },
    { key: 'n d', label: 'New Deploy', description: 'Start new deployment', action: () => router.push('/deployments/advanced?action=new'), category: 'actions' },
    { key: 'n s', label: 'New Secret', description: 'Create new secret', action: () => router.push('/secrets?action=create'), category: 'actions' },
    { key: 'c p', label: 'Command Palette', description: 'Open command palette', action: () => openCommandPalette(true), category: 'actions' },
    { key: '1', label: 'Overview Tab', description: 'Switch to overview tab', action: () => {}, category: 'views' },
    { key: '2', label: 'Infrastructure Tab', description: 'Switch to infrastructure tab', action: () => {}, category: 'views' },
    { key: '3', label: 'Monitoring Tab', description: 'Switch to monitoring tab', action: () => {}, category: 'views' },
    { key: '4', label: 'Cluster Tab', description: 'Switch to cluster tab', action: () => {}, category: 'views' },
    { key: '5', label: 'Integrations Tab', description: 'Switch to integrations tab', action: () => {}, category: 'views' },
  ], [router, openCommandPalette]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if in input/textarea
    const target = e.target as HTMLElement;
    const isInput = target.tagName === "INPUT" || 
                    target.tagName === "TEXTAREA" || 
                    target.isContentEditable;
    
    if (isInput) return;

    // Ignore if modifier keys (handled by command palette)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Show help with "?"
    if (e.key === "?" && e.shiftKey) {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    // Escape clears pending prefix and closes help
    if (e.key === "Escape") {
      setPendingPrefix(null);
      setShowHelp(false);
      if (prefixTimeout) {
        clearTimeout(prefixTimeout);
        setPrefixTimeout(null);
      }
      return;
    }

    const key = e.key.toLowerCase();

    // If we have a pending prefix, try to match a two-key shortcut
    if (pendingPrefix) {
      const fullKey = `${pendingPrefix} ${key}`;
      const shortcut = shortcuts.find(s => s.key === fullKey);
      
      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
      
      // Clear prefix after any key press
      setPendingPrefix(null);
      if (prefixTimeout) {
        clearTimeout(prefixTimeout);
        setPrefixTimeout(null);
      }
      return;
    }

    // Check for prefix keys (g, n)
    if (key === 'g' || key === 'n') {
      e.preventDefault();
      setPendingPrefix(key);
      
      // Clear prefix after 1.5 seconds
      const timeout = setTimeout(() => {
        setPendingPrefix(null);
      }, 1500);
      setPrefixTimeout(timeout);
      return;
    }

    // Check for single-key shortcuts (number keys for tabs)
    const singleShortcut = shortcuts.find(s => s.key === key && !s.key.includes(' '));
    if (singleShortcut) {
      e.preventDefault();
      singleShortcut.action();
    }
  }, [pendingPrefix, prefixTimeout, shortcuts]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (prefixTimeout) {
        clearTimeout(prefixTimeout);
      }
    };
  }, [handleKeyDown, prefixTimeout]);

  return (
    <KeyboardShortcutsContext.Provider value={{ shortcuts, showHelp, setShowHelp, pendingPrefix }}>
      {children}
      
      {/* Pending prefix indicator */}
      {pendingPrefix && (
        <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg px-4 py-2 shadow-lg">
          <span className="text-muted-foreground">Waiting for key: </span>
          <kbd className="ml-1 px-2 py-1 bg-muted rounded text-sm font-mono">{pendingPrefix}</kbd>
        </div>
      )}
      
      {/* Help modal */}
      {showHelp && (
        <KeyboardShortcutsHelp shortcuts={shortcuts} onClose={() => setShowHelp(false)} />
      )}
    </KeyboardShortcutsContext.Provider>
  );
}

interface KeyboardShortcutsHelpProps {
  shortcuts: Shortcut[];
  onClose: () => void;
}

function KeyboardShortcutsHelp({ shortcuts, onClose }: KeyboardShortcutsHelpProps) {
  const categories = {
    navigation: 'Navigation',
    actions: 'Quick Actions',
    views: 'View Toggles',
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {/* Global shortcuts */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Global</h3>
            <div className="space-y-2">
              <ShortcutRow keys={['Cmd', 'K']} description="Open command palette" />
              <ShortcutRow keys={['/']} description="Quick search" />
              <ShortcutRow keys={['?']} description="Toggle this help" />
              <ShortcutRow keys={['Esc']} description="Close modal / Cancel" />
            </div>
          </div>

          {/* Grouped shortcuts */}
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {categories[category as keyof typeof categories]}
              </h3>
              <div className="space-y-2">
                {items.map(shortcut => (
                  <ShortcutRow 
                    key={shortcut.key} 
                    keys={shortcut.key.split(' ')} 
                    description={shortcut.description} 
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> to toggle this help
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono min-w-[24px] text-center">
              {key}
            </kbd>
            {i < keys.length - 1 && <span className="text-muted-foreground text-xs">then</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export default KeyboardShortcutsProvider;
