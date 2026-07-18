import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/theme';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LoginPage = React.lazy(() => import('@/pages/login'));
const AdminDashboard = React.lazy(() => import('@/pages/admin/dashboard'));
const AcademicYearsPage = React.lazy(() => import('@/pages/admin/academic-years'));
const TermsPage = React.lazy(() => import('@/pages/admin/terms'));
const ClassesPage = React.lazy(() => import('@/pages/admin/classes'));
const SubjectsPage = React.lazy(() => import('@/pages/admin/subjects'));
const ClassSubjectsPage = React.lazy(() => import('@/pages/admin/class-subjects'));
const UsersPage = React.lazy(() => import('@/pages/admin/users'));
const TeacherAssignmentsPage = React.lazy(() => import('@/pages/admin/teacher-assignments'));
const StudentsPage = React.lazy(() => import('@/pages/admin/students'));
const AssessmentComponentsPage = React.lazy(() => import('@/pages/admin/assessment-components'));
const GradingScalesPage = React.lazy(() => import('@/pages/admin/grading-scales'));
const ReportCardsPage = React.lazy(() => import('@/pages/admin/report-cards'));
const ClassReportCardsPage = React.lazy(() => import('@/pages/admin/class-report-cards'));
const PromotionsPage = React.lazy(() => import('@/pages/admin/promotions'));
const TeacherDashboard = React.lazy(() => import('@/pages/teacher/dashboard'));
const ScoreEntryPage = React.lazy(() => import('@/pages/teacher/score-entry'));
const ParentDashboard = React.lazy(() => import('@/pages/parent/dashboard'));
const SingleReportCardPage = React.lazy(() => import('@/pages/parent/report-card'));
import { AppLayout } from '@/components/layout';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      
      {/* Admin Routes */}
      <Route path="/admin">
        <AppLayout role="admin"><AdminDashboard /></AppLayout>
      </Route>
      <Route path="/admin/academic-years">
        <AppLayout role="admin"><AcademicYearsPage /></AppLayout>
      </Route>
      <Route path="/admin/terms">
        <AppLayout role="admin"><TermsPage /></AppLayout>
      </Route>
      <Route path="/admin/classes">
        <AppLayout role="admin"><ClassesPage /></AppLayout>
      </Route>
      <Route path="/admin/subjects">
        <AppLayout role="admin"><SubjectsPage /></AppLayout>
      </Route>
      <Route path="/admin/classes/:classId/subjects">
        <AppLayout role="admin"><ClassSubjectsPage /></AppLayout>
      </Route>
      <Route path="/admin/users">
        <AppLayout role="admin"><UsersPage /></AppLayout>
      </Route>
      <Route path="/admin/teacher-assignments">
        <AppLayout role="admin"><TeacherAssignmentsPage /></AppLayout>
      </Route>
      <Route path="/admin/students">
        <AppLayout role="admin"><StudentsPage /></AppLayout>
      </Route>
      <Route path="/admin/assessment-components">
        <AppLayout role="admin"><AssessmentComponentsPage /></AppLayout>
      </Route>
      <Route path="/admin/grading-scales">
        <AppLayout role="admin"><GradingScalesPage /></AppLayout>
      </Route>
      <Route path="/admin/report-cards">
        <AppLayout role="admin"><ReportCardsPage /></AppLayout>
      </Route>
      <Route path="/admin/report-cards/:classId/:termId">
        <AppLayout role="admin"><ClassReportCardsPage /></AppLayout>
      </Route>
      <Route path="/admin/promotions">
        <AppLayout role="admin"><PromotionsPage /></AppLayout>
      </Route>

      {/* Teacher Routes */}
      <Route path="/teacher">
        <AppLayout role="teacher"><TeacherDashboard /></AppLayout>
      </Route>
      <Route path="/teacher/scores/:classId/:subjectName/:termId">
        <AppLayout role="teacher"><ScoreEntryPage /></AppLayout>
      </Route>
      <Route path="/teacher/students">
        <AppLayout role="teacher"><StudentsPage /></AppLayout>
      </Route>
      <Route path="/teacher/report-cards">
        <AppLayout role="teacher"><ReportCardsPage /></AppLayout>
      </Route>
      <Route path="/teacher/report-cards/:classId/:termId">
        <AppLayout role="teacher"><ClassReportCardsPage /></AppLayout>
      </Route>

      {/* Parent Routes */}
      <Route path="/parent">
        <AppLayout role="parent"><ParentDashboard /></AppLayout>
      </Route>
      <Route path="/parent/report-cards/:studentId/:termId">
        <AppLayout role="parent"><SingleReportCardPage /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            }>
              <Router />
            </Suspense>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
