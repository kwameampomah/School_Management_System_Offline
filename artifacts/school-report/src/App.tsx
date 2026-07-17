import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/theme';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import LoginPage from '@/pages/login';
import AdminDashboard from '@/pages/admin/dashboard';
import AcademicYearsPage from '@/pages/admin/academic-years';
import TermsPage from '@/pages/admin/terms';
import ClassesPage from '@/pages/admin/classes';
import SubjectsPage from '@/pages/admin/subjects';
import ClassSubjectsPage from '@/pages/admin/class-subjects';
import UsersPage from '@/pages/admin/users';
import TeacherAssignmentsPage from '@/pages/admin/teacher-assignments';
import StudentsPage from '@/pages/admin/students';
import AssessmentComponentsPage from '@/pages/admin/assessment-components';
import GradingScalesPage from '@/pages/admin/grading-scales';
import ReportCardsPage from '@/pages/admin/report-cards';
import ClassReportCardsPage from '@/pages/admin/class-report-cards';
import PromotionsPage from '@/pages/admin/promotions';
import TeacherDashboard from '@/pages/teacher/dashboard';
import ScoreEntryPage from '@/pages/teacher/score-entry';
import ParentDashboard from '@/pages/parent/dashboard';
import SingleReportCardPage from '@/pages/parent/report-card';
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
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
