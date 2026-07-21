import { Link, useLocation } from "wouter";
import { useEffect, useState, useMemo, useRef } from "react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import {
  Loader2, LogOut, BookOpen, Users, GraduationCap, LayoutDashboard,
  Settings, FileText, CalendarDays, Menu, X, Sun, Moon, ArrowUpCircle,
  CalendarCheck, CreditCard, SlidersHorizontal, UserCheck, FolderKanban
} from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/theme";

interface NavGroup {
  groupName: string;
  items: { href: string; label: string; icon: any }[];
}

const categorizedNavItems: Record<string, NavGroup[]> = {
  admin: [
    {
      groupName: "OVERVIEW",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      ]
    },
    {
      groupName: "DAILY OPERATIONS",
      items: [
        { href: "/admin/report-cards", label: "Report Cards", icon: FileText },
        { href: "/admin/attendance", label: "Attendance & Remarks", icon: CalendarCheck },
        { href: "/admin/fees", label: "Fees & Billing", icon: CreditCard },
      ]
    },
    {
      groupName: "PEOPLE & ROSTER",
      items: [
        { href: "/admin/students", label: "Students", icon: Users },
        { href: "/admin/classes", label: "Classes", icon: GraduationCap },
        { href: "/admin/users", label: "Staff & Users", icon: UserCheck },
        { href: "/admin/teacher-assignments", label: "Teacher Assignments", icon: FolderKanban },
        { href: "/admin/promotions", label: "Class Promotions", icon: ArrowUpCircle },
      ]
    },
    {
      groupName: "ACADEMIC SETUP",
      items: [
        { href: "/admin/academic-years", label: "Academic Years", icon: CalendarDays },
        { href: "/admin/terms", label: "Terms", icon: CalendarDays },
        { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
        { href: "/admin/assessment-components", label: "Assessment Config", icon: SlidersHorizontal },
        { href: "/admin/grading-scales", label: "Grading Scales", icon: Settings },
      ]
    }
  ],
  teacher: [
    {
      groupName: "TEACHER DASHBOARD",
      items: [
        { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
        { href: "/teacher/students", label: "Students Roster", icon: Users },
        { href: "/teacher/attendance", label: "Attendance & Remarks", icon: CalendarCheck },
        { href: "/teacher/report-cards", label: "Report Cards", icon: FileText },
      ]
    }
  ],
  parent: [
    {
      groupName: "PARENT PORTAL",
      items: [
        { href: "/parent", label: "My Children", icon: Users },
      ]
    }
  ]
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
  const groups = categorizedNavItems[role];
  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header logo */}
      <div className="p-5 shrink-0 border-b border-sidebar-border/60">
        <div className="flex items-center gap-2.5 font-bold text-base tracking-tight text-foreground">
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain shrink-0" />
          <span>Taifa Ebenezer</span>
        </div>
      </div>

      {/* Categorized Nav Groups */}
      <nav className="flex-1 px-3 py-3 space-y-5 overflow-y-auto">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-3 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">
              {group.groupName}
            </div>
            {group.items.map((item) => {
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
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0 bg-muted/20">
        <div className="px-3 py-1.5 mb-1 min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{user.fullName || "User Account"}</div>
          <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-xs text-muted-foreground hover:text-foreground h-8"
            onClick={onLogout}
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const flatItems = useMemo(() => {
    return categorizedNavItems[role].flatMap(g => g.items);
  }, [role]);

  const bottomItems = useMemo(() => {
    if (role === "admin") {
      return flatItems.filter((i) =>
        ["/admin", "/admin/report-cards", "/admin/attendance", "/admin/fees"].includes(i.href)
      );
    }
    return flatItems;
  }, [role, flatItems]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/login");
      },
    });
  };

  useEffect(() => {
    setMobileOpen(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground text-sm">Please log in to access this page.</p>
          <Link href="/login">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-30 border-r border-sidebar-border bg-sidebar">
        <SidebarContent
          role={role}
          location={location}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-30">
        <div className="flex items-center gap-2 font-bold text-sm">
          <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
          <span>Taifa Ebenezer</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Slide-out Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-y-0 left-0 w-72 bg-sidebar border-r border-sidebar-border shadow-xl z-50">
            <SidebarContent
              role={role}
              location={location}
              user={user}
              onNavClick={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        <main ref={scrollRef} className="flex-1 p-4 sm:p-6 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto w-full">
          {children}
        </main>

        {/* Mobile Bottom Quick-Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-background border-t border-border flex items-center justify-around p-2">
          {bottomItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-md text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
