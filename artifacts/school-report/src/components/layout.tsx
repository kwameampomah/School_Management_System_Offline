import { Link, useLocation } from "wouter";
import { useEffect, useState, useMemo, useRef } from "react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import {
  Loader2, LogOut, BookOpen, Users, GraduationCap, LayoutDashboard,
  Settings, FileText, CalendarDays, Menu, X, Sun, Moon, ArrowUpCircle,
  CalendarCheck, CreditCard,
} from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/theme";
import SyncStatusIndicator from "./sync-status-indicator";

const navItems = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/academic-years", label: "Academic Years", icon: CalendarDays },
    { href: "/admin/terms", label: "Terms", icon: CalendarDays },
    { href: "/admin/classes", label: "Classes", icon: GraduationCap },
    { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/teacher-assignments", label: "Teacher Assignments", icon: Users },
    { href: "/admin/students", label: "Students", icon: Users },
    { href: "/admin/attendance", label: "Attendance & Remarks", icon: CalendarCheck },
    { href: "/admin/fees", label: "Fees & Billing", icon: CreditCard },
    { href: "/admin/assessment-components", label: "Assessments", icon: FileText },
    { href: "/admin/grading-scales", label: "Grading Scales", icon: Settings },
    { href: "/admin/report-cards", label: "Report Cards", icon: FileText },
    { href: "/admin/promotions", label: "Class Promotions", icon: ArrowUpCircle },
  ],
  teacher: [
    { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
    { href: "/teacher/students", label: "Students", icon: Users },
    { href: "/teacher/attendance", label: "Attendance & Remarks", icon: CalendarCheck },
    { href: "/teacher/report-cards", label: "Report Cards", icon: FileText },
  ],
  parent: [
    { href: "/parent", label: "My Children", icon: Users },
  ],
};

function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`p-1.5 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground ${className}`}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function SidebarContent({
  role,
  location,
  user,
  onNavClick,
  onLogout,
}: {
  role: "admin" | "teacher" | "parent";
  location: string;
  user: { fullName?: string | null; email?: string | null };
  onNavClick?: () => void;
  onLogout: () => void;
}) {
  const items = navItems[role];
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 shrink-0">
        <div className="flex items-center gap-2.5 font-semibold text-lg tracking-tight text-foreground">
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain shrink-0" />
          Taifa Ebenezer
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            location === item.href ||
            (location.startsWith(item.href) &&
              item.href !== "/admin" &&
              item.href !== "/teacher" &&
              item.href !== "/parent");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border shrink-0 space-y-3">
        <SyncStatusIndicator />
        <div className="px-3 py-2 min-w-0">
          <div className="text-sm font-medium truncate max-w-[160px]">{user.fullName}</div>
          <div className="text-xs text-sidebar-foreground/60 truncate max-w-[160px]">{user.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="flex-1 justify-start text-muted-foreground hover:text-foreground"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export function AppLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "admin" | "teacher" | "parent";
}) {
  const { data: user, isLoading } = useGetMe();
  const logout = useLogout();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  const bottomItems = useMemo(() => {
    const items = navItems[role];
    if (role === "admin") {
      const mainLabels = ["Dashboard", "Classes", "Students", "Report Cards"];
      return items.filter(i => mainLabels.includes(i.label));
    }
    return items;
  }, [role]);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== role)) {
      setLocation("/login");
    }
  }, [user, isLoading, role, setLocation]);

  // Close mobile menu and scroll to top on route change
  useEffect(() => {
    setMobileOpen(false);
    
    const resetScroll = () => {
      // 1. Reset main layout scroll ref
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
      // 2. Reset global window scroll
      window.scrollTo(0, 0);
      // 3. Sweep and reset all scrollable overflow containers in the DOM
      const scrollables = document.querySelectorAll(".overflow-y-auto, .overflow-auto");
      scrollables.forEach(el => {
        el.scrollTop = 0;
      });
    };

    resetScroll();
    
    // Multiple timed iterations to catch and reset scrolls during async data load and layout shift transitions
    const timers = [
      setTimeout(resetScroll, 50),
      setTimeout(resetScroll, 150),
      setTimeout(resetScroll, 300),
      setTimeout(resetScroll, 600),
    ];
    
    return () => timers.forEach(clearTimeout);
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLocation("/login") });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col h-screen sticky top-0 shrink-0">
        <SidebarContent
          role={role}
          location={location}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground flex flex-col md:hidden transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4 shrink-0">
          <span className="text-xs text-sidebar-foreground/60 uppercase font-semibold tracking-wider">
            Navigation
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent
          role={role}
          location={location}
          user={user}
          onNavClick={() => setMobileOpen(false)}
          onLogout={handleLogout}
        />
      </aside>

      {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-14 border-b bg-card flex items-center px-3 sm:px-4 md:hidden shrink-0 justify-between">  
          <div className="font-bold text-primary text-xs sm:text-sm truncate mr-2">Taifa Ebenezer</div>
          <SyncStatusIndicator />
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 pb-20 sm:p-5 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border/85 h-16 md:hidden flex items-center justify-around px-2 pb-safe shadow-lg shadow-black/10">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (location.startsWith(item.href) &&
                item.href !== "/admin" &&
                item.href !== "/teacher" &&
                item.href !== "/parent");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] mt-1 truncate max-w-[75px]">{item.label}</span>
              </Link>
            );
          })}
          
          {/* If there are more items (like admin has 12), show a 'More' button to trigger the sidebar overlay */}
          {role === "admin" && (
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-1">More</span>
            </button>
          )}
        </nav>
      </main>
    </div>
  );
}
