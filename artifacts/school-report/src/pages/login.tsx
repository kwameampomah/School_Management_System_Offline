import { useState } from "react";
import { useLogin, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Shield, GraduationCap } from "lucide-react";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refetch } = useGetMe();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ data: { email, password } }, {
      onSuccess: async (user) => {
        toast({ title: "Welcome back", description: "Logged in successfully." });
        await refetch();
        if (user.role === "admin") setLocation("/admin");
        else if (user.role === "teacher") setLocation("/teacher");
        else setLocation("/parent");
      },
      onError: (err: any) => {
        const message = err.message || err.error || "Invalid credentials or server connection issue.";
        toast({ variant: "destructive", title: "Login Failed", description: message });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Taifa Ebenezer School Logo" className="w-16 h-16 mb-4 object-contain" />
          <h1 className="text-xl font-bold tracking-tight">Taifa Ebenezer School</h1>
          <p className="text-muted-foreground text-sm mt-1">School Report Management System</p>
        </div>
        
        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold">Sign in</CardTitle>
            <CardDescription>Enter your credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@school.gh" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground text-[10px] tracking-wider font-semibold">Quick Access (Demo)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@school.gh");
                  setPassword("admin123");
                }}
                className="group flex flex-col items-center justify-center p-3 rounded-xl border bg-card hover:bg-accent/40 hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all duration-300 text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Shield className="w-5 h-5 text-indigo-500 mb-1 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-xs font-semibold text-foreground">Admin Portal</span>
                <span className="text-[10px] text-muted-foreground/80 mt-0.5">admin@school.gh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("teacher@school.gh");
                  setPassword("teacher123");
                }}
                className="group flex flex-col items-center justify-center p-3 rounded-xl border bg-card hover:bg-accent/40 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all duration-300 text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <GraduationCap className="w-5 h-5 text-emerald-500 mb-1 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-xs font-semibold text-foreground">Teacher Portal</span>
                <span className="text-[10px] text-muted-foreground/80 mt-0.5">teacher@school.gh</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
