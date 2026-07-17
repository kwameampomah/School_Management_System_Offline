import { useGetAdminDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, GraduationCap, BookOpen, FileText } from "lucide-react";

const STAT_THEMES = [
  { // Violet/Indigo (Students)
    hoverBorder: "hover:border-violet-500/30",
    iconBg: "bg-violet-500/10 border-violet-500/20",
    iconColor: "text-violet-600 dark:text-violet-400"
  },
  { // Emerald/Teal (Teachers)
    hoverBorder: "hover:border-emerald-500/30",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400"
  },
  { // Amber/Orange (Classes)
    hoverBorder: "hover:border-amber-500/30",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400"
  },
  { // Rose/Pink (Subjects)
    hoverBorder: "hover:border-rose-500/30",
    iconBg: "bg-rose-500/10 border-rose-500/20",
    iconColor: "text-rose-600 dark:text-rose-400"
  }
];

export default function AdminDashboard() {
  const { data: summary, isLoading } = useGetAdminDashboardSummary();

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!summary) return null;

  const statCards = [
    { title: "Total Students", value: summary.totalStudents, icon: Users },
    { title: "Total Teachers", value: summary.totalTeachers, icon: GraduationCap },
    { title: "Total Classes", value: summary.totalClasses, icon: BookOpen },
    { title: "Total Subjects", value: summary.totalSubjects, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of the academic structure.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          const theme = STAT_THEMES[i];
          return (
            <Card key={i} className={`bg-card text-card-foreground border border-border/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${theme.hoverBorder}`}>
              <CardContent className="p-3.5 sm:p-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0">
                <div>
                  <p className="text-muted-foreground text-[11px] sm:text-sm font-medium leading-tight mb-0.5 sm:mb-1">{stat.title}</p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stat.value}</div>
                </div>
                <div className={`w-8 h-8 sm:w-11 sm:h-11 border rounded-full flex items-center justify-center shrink-0 self-end sm:self-auto ${theme.iconBg}`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${theme.iconColor}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Academic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Academic Year</span>
              <span className="font-semibold">{summary.currentAcademicYear || "Not Set"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Current Term</span>
              <span className="font-semibold">{summary.currentTerm || "Not Set"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report Card Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Drafts</span>
              <span className="font-semibold text-muted-foreground">{summary.reportCardStatusCounts.draft}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-semibold text-secondary-foreground">{summary.reportCardStatusCounts.submitted}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Approved</span>
              <span className="font-semibold text-primary">{summary.reportCardStatusCounts.approved}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Published</span>
              <span className="font-semibold text-green-600">{summary.reportCardStatusCounts.published}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
