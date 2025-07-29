"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/" },
    { name: "Services", href: "/services" },
    { name: "Integrations", href: "/integrations" },
    { name: "Deployments", href: "/deployments" },
    { name: "Secrets", href: "/secrets" },
    { name: "Starter App", href: "/starter" },
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
            {session && (
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
            {session?.user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-300">
                  {(session.user as any).name || (session.user as any).login}
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
