'use client'

import { useState } from 'react'
import { useAuth } from '@/app/providers'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { NotificationBell, NotificationPanel, useNotifications } from '@/components/notifications/notification-system'
import { 
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronDown,
  GitBranch,
  Home,
  Menu,
  Monitor,
  Server,
  Settings,
  Users,
  Container,
  Ship,
  Database,
  Network,
  Shield,
  FileText,
  HelpCircle,
  LogOut,
  User
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  children?: NavItem[]
}

const navigation: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: Home
  },
  {
    title: 'Infrastructure',
    href: '/infrastructure',
    icon: Server,
    children: [
      {
        title: 'Overview',
        href: '/infrastructure',
        icon: Monitor
      },
      {
        title: 'Cluster Management',
        href: '/infrastructure/cluster',
        icon: Server
      },
      {
        title: 'Network',
        href: '/infrastructure/network',
        icon: Network
      }
    ]
  },
  {
    title: 'Monitoring',
    href: '/monitoring',
    icon: Activity,
    children: [
      {
        title: 'Metrics',
        href: '/monitoring/metrics',
        icon: BarChart3
      },
      {
        title: 'Alerts',
        href: '/monitoring/alerts',
        icon: AlertTriangle,
        badge: '3'
      },
      {
        title: 'Logs',
        href: '/monitoring/logs',
        icon: FileText
      }
    ]
  },
  {
    title: 'Integrations',
    href: '/integrations',
    icon: GitBranch,
    children: [
      {
        title: 'Overview',
        href: '/integrations',
        icon: GitBranch
      },
      {
        title: 'Git (Gitea)',
        href: '/integrations/gitea',
        icon: GitBranch
      },
      {
        title: 'CI/CD (Drone)',
        href: '/integrations/drone',
        icon: Activity
      },
      {
        title: 'Registry (Harbor)',
        href: '/integrations/harbor',
        icon: Container
      },
      {
        title: 'Deployment (ArgoCD)',
        href: '/integrations/argocd',
        icon: Ship
      }
    ]
  },
  {
    title: 'Applications',
    href: '/applications',
    icon: Container
  },
  {
    title: 'Security',
    href: '/security',
    icon: Shield,
    children: [
      {
        title: 'Vulnerabilities',
        href: '/security/vulnerabilities',
        icon: Shield
      },
      {
        title: 'Access Control',
        href: '/security/access',
        icon: Users
      }
    ]
  }
]

function NavLink({ item, isCollapsed = false }: { item: NavItem; isCollapsed?: boolean }) {
  const pathname = usePathname()
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const [isOpen, setIsOpen] = useState(isActive)

  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-accent text-accent-foreground font-medium'
          )}
        >
          <div className="flex items-center space-x-3">
            <item.icon className="h-4 w-4" />
            {!isCollapsed && <span>{item.title}</span>}
          </div>
          {!isCollapsed && (
            <div className="flex items-center space-x-1">
              {item.badge && (
                <Badge variant="secondary" className="text-xs">
                  {item.badge}
                </Badge>
              )}
              <ChevronDown className={cn(
                'h-3 w-3 transition-transform',
                isOpen && 'rotate-180'
              )} />
            </div>
          )}
        </button>
        
        {!isCollapsed && isOpen && item.children && (
          <div className="ml-6 mt-1 space-y-1">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 text-sm rounded-md transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  pathname === child.href && 'bg-accent text-accent-foreground font-medium'
                )}
              >
                <child.icon className="h-3 w-3" />
                <span>{child.title}</span>
                {child.badge && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {child.badge}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center space-x-3 px-3 py-2 text-sm rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground font-medium'
      )}
    >
      <item.icon className="h-4 w-4" />
      {!isCollapsed && <span>{item.title}</span>}
      {!isCollapsed && item.badge && (
        <Badge variant="secondary" className="text-xs ml-auto">
          {item.badge}
        </Badge>
      )}
    </Link>
  )
}

function Sidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col h-full bg-background border-r',
      isCollapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center px-6 py-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Server className="h-4 w-4 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold">GMAC.IO</h1>
              <p className="text-xs text-muted-foreground">Control Panel</p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => (
          <NavLink key={item.href} item={item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      <Separator />

      {/* Bottom section */}
      <div className="p-3 space-y-1">
        <NavLink 
          item={{
            title: 'Settings',
            href: '/settings',
            icon: Settings
          }}
          isCollapsed={isCollapsed}
        />
        <NavLink 
          item={{
            title: 'Help',
            href: '/help',
            icon: HelpCircle
          }}
          isCollapsed={isCollapsed}
        />
      </div>
    </div>
  )
}

function Header() {
  const { authenticated, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 md:px-6">
        {/* Mobile menu trigger */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Mobile menu overlay */}
        {showMobileMenu && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setShowMobileMenu(false)}
          >
            <div 
              className="fixed left-0 top-0 h-full w-72 bg-white dark:bg-gray-900 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar />
            </div>
          </div>
        )}

        {/* Desktop: spacer, Mobile: logo */}
        <div className="flex-1 md:hidden">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
              <Server className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold">GMAC.IO</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-3">
          {/* System status indicator */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium">All Systems Operational</span>
          </div>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative"
            >
              <NotificationBell />
            </Button>
            <NotificationPanel 
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

          {/* User menu */}
          {authenticated ? (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon">
                <User className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => signOut()}
                className="hidden md:flex"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm">
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { authenticated } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex">
          <Sidebar isCollapsed={sidebarCollapsed} />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          <Header />
          
          <main className="flex-1">
            <div className="container mx-auto px-4 md:px-6 py-6 max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Sidebar collapse toggle for desktop */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-4 left-4 z-40 hidden md:flex bg-background border shadow-lg"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        <Menu className="h-4 w-4" />
      </Button>
    </div>
  )
}