"use client";

import { useAuth } from "@/app/providers";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const { user, authenticated, signOut } = useAuth();
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/" },
    { name: "Applications", href: "/applications" },
    { name: "Deployments", href: "/deployments" },
    { name: "Health", href: "/health" },
    { name: "Infrastructure", href: "/infrastructure" },
    { name: "Cluster", href: "/cluster" },
    { name: "Services", href: "/services" },
    { name: "Integrations", href: "/integrations" },
    { name: "Secrets", href: "/secrets" },
    { name: "Costs", href: "/costs" },
    { name: "Alerts", href: "/alerts" },
    { name: "Registry", href: "/registry" },
    { name: "Webhooks", href: "/webhooks" },
    { name: "Starter", href: "/starter" },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-100">
                gmac.io
              </Link>
            </div>
            {authenticated && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      pathname === item.href
                        ? "border-blue-500 text-gray-100"
                        : "border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center">
            {authenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-300">
                  {user}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-400 hover:text-gray-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="text-sm text-gray-300 hover:text-gray-100"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
