'use client';

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBagIcon, MagnifyingGlassIcon, CubeIcon, EyeIcon, CalendarIcon, CommandLineIcon, TrophyIcon, DocumentTextIcon, UserIcon, UsersIcon } from "@heroicons/react/24/solid";

// Firebase
import { signOut, type Auth } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/app/providers";

const auth: Auth = firebaseAuth as Auth;

const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <>
      <header className={`sticky top-0 z-50 bg-gray-950 ${isMenuOpen ? "md:block hidden" : "block"}`}>
        <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center">
            <div className="coinContainer">
              <div className="coinInner">
                <Image
                  src="https://i.imgur.com/mlPQazY.png"
                  alt="Cypher Logo"
                  width={48}
                  height={48}
                  className="coinFace"
                />
              </div>
            </div>
            <span className="ml-2 text-xs font-bold text-blue-400 bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-0.5 flex items-center relative top-[1px]">
              v1 BETA
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
            <IconLink href="/whale-watcher" label="Whale Watchers" IconComponent={UsersIcon} />
            <IconLink href="/token-scanner" label="Token Screener" IconComponent={EyeIcon} />
            <IconLink href="/honeypot-scanner" label="Smart Contract Audit" IconComponent={MagnifyingGlassIcon} />
            <IconLink href="/calendar" label="Community Calendar" IconComponent={CalendarIcon} />
            <IconLink href="/explorer/latest/block" label="Cypherscan" IconComponent={CommandLineIcon} />
            <IconLink href="/marketplace" label="Marketplace" IconComponent={ShoppingBagIcon} />
            <IconLink href="/explorer" label="Blockchain Explorer" IconComponent={CubeIcon} />
            <IconLink href="/TradingCompetition" label="Tournaments" IconComponent={TrophyIcon} />
            {!loading && (
              <div className="relative group">
                <Link href={user ? "/account" : "/login"} className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <span className="sr-only">{user ? "Account" : "Sign in"}</span>
                </Link>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-gray-200 bg-gray-900 rounded pointer-events-none whitespace-nowrap hidden group-hover:block">
                  {user ? "Account" : "Sign in"}
                </span>
              </div>
            )}
          </nav>

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-gray-200 p-2" aria-label="Toggle Menu">
            {isMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeWidth={2} />
                <line x1="6" y1="18" x2="18" y2="6" strokeLinecap="round" strokeWidth={2} />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <line x1="4" y1="8" x2="20" y2="8" strokeLinecap="round" strokeWidth={2} />
                <line x1="4" y1="14" x2="16" y2="14" strokeLinecap="round" strokeWidth={2} />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div
        className={`md:hidden fixed inset-0 left-0 right-0 z-40 bg-gray-950 overscroll-none overflow-x-hidden ${isMenuOpen ? "block" : "hidden"}`}
        style={{ overscrollBehavior: "none" }}
      >
        <nav className="pt-10 pb-10 px-6 h-full overflow-y-auto overflow-x-hidden flex flex-col relative">
          <button onClick={() => setIsMenuOpen(false)} className="absolute top-4 right-4 text-gray-200 p-2" aria-label="Close Menu">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeWidth={2} />
              <line x1="6" y1="18" x2="18" y2="6" strokeLinecap="round" strokeWidth={2} />
            </svg>
          </button>

          <ul className="space-y-3">
            <li>
              <Link
                href="/token-scanner"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <EyeIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Token Screener</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>
            <li>
              <Link
                href="/whale-watcher"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <UsersIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Whale Watchers</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>
            <li>
              <Link
                href="/launch-calendar"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <CalendarIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Launch Calendar</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>
            <li>
              <Link
                href="/terminal"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <CommandLineIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">News Terminal</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>
            <li>
              <Link
                href="/honeypot-scanner"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Honeypot Scanner</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>
            <li>
              <Link
                href="/latest/block"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <CommandLineIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Homescan</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>
            <li>
              <Link
                href="/marketplace"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <ShoppingBagIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Marketplace</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>
            <li>
              <Link
                href="/explorer"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <CubeIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Blockchain Explorer</span>
              </Link>
            </li>
          </ul>

          <div className="border-t border-blue-500/20 my-4 mx-[-1.5rem]"></div>

          <ul className="space-y-3">
            <li>
              <Link
                href="/TradingCompetition"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <TrophyIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Tournaments</span>
              </Link>
            </li>
            <li>
              <Link
                href="/docs"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <DocumentTextIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Docs</span>
              </Link>
            </li>
            <li>
              {!loading && (
                user ? (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md w-full text-left"
                  >
                    <UserIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                    <span className="text-base leading-none">Sign out</span>
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-1 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
                  >
                    <UserIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                    <span className="text-base leading-none">Sign in</span>
                  </Link>
                )
              )}
            </li>
          </ul>
        </nav>
      </div>

      <style jsx>{`
        :root {
          --coinbase-blue: #3B82F6; /* Updated to match MarketplacePage blue */
        }
        .coinContainer {
          position: relative;
          width: 48px;
          height: 48px;
        }
        .coinInner {
          width: 100%;
          height: 100%;
          animation: spinWheel 4s linear infinite;
        }
        .coinFace {
          width: 48px;
          height: 48px;
          backface-visibility: hidden;
        }
        @keyframes spinWheel {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};

export default Header;

function IconLink({
  href,
  label,
  IconComponent,
}: {
  href: string;
  label: string;
  IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <div className="relative group">
      <Link href={href} className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <IconComponent className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
        </div>
        <span className="sr-only">{label}</span>
      </Link>
      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-gray-200 bg-gray-900 rounded pointer-events-none whitespace-nowrap hidden group-hover:block">
        {label}
      </span>
    </div>
  );
}