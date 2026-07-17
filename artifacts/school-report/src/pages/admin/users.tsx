import React, { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListUsersQueryKey, UserInputRole, UserUpdateRole } from "@workspace/api-client-react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState<string>("");
  const { data: users, isLoading } = useListUsers(roleFilter ? { role: roleFilter as any } : undefined);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    deleteUser.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted successfully" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === "admin") return "destructive";
    if (role === "teacher") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">System Users</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Manage access for administrators, teachers, and parents.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="flex-1 sm:w-36 sm:flex-none">
            <option value="">All Roles</option>
            <option value="admin">Admins</option>
            <option value="teacher">Teachers</option>
            <option value="parent">Parents</option>
          </Select>
          <Button onClick={() => setIsCreateOpen(true)} size="sm" className="shrink-0"><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Add User</span><span className="sm:hidden">Add</span></Button>
        </div>
      </div>

      {/* Desktop Layout: Table */}
      <Card className="hidden sm:block">
        <div className="overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No users found.</TableCell></TableRow>
              )}
              {users?.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.fullName}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">{user.email}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">{user.role}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingUser(user)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile Layout: Compact Card Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:hidden">
        {users?.length === 0 && (
          <div className="text-center text-muted-foreground py-10 border border-dashed rounded-xl bg-card/20">
            No users found.
          </div>
        )}
        {users?.map(user => (
          <div key={user.id} className="border border-border/50 bg-card/30 px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground truncate">{user.fullName}</h3>
                <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px] px-1.5 py-0 leading-none shrink-0 capitalize">{user.role}</Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <span className="truncate">{user.email}</span>
                <span>•</span>
                <span>{formatDate(user.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full" 
                onClick={() => setEditingUser(user)}
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 rounded-full text-destructive hover:bg-destructive/5 hover:text-destructive" 
                onClick={() => handleDelete(user.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <UserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <UserDialog open={!!editingUser} onOpenChange={(v) => !v && setEditingUser(null)} user={editingUser} />
    </div>
  );
}

function UserDialog({ open, onOpenChange, user }: { open: boolean, onOpenChange: (v: boolean) => void, user?: any }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserInputRole>(UserInputRole.teacher);
  const [staffId, setStaffId] = useState("");
  const [phone, setPhone] = useState("");

  const create = useCreateUser();
  const update = useUpdateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      setFullName(user?.fullName || "");
      setEmail(user?.email || "");
      setRole(user?.role || UserInputRole.teacher);
      setPassword("");
      setStaffId("");
      setPhone("");
    }
  }, [open, user]);

  const isEditing = !!user;

  const handleSave = () => {
    if (!fullName || !email || (!isEditing && !password)) {
      return toast({ variant: "destructive", title: "Fill all required fields" });
    }
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: isEditing ? "User Updated" : "User Created" });
      onOpenChange(false);
    };
    if (isEditing) {
      const payload: any = { fullName, email, role: role as UserUpdateRole };
      if (password) payload.password = password;
      update.mutate({ id: user.id, data: payload }, { onSuccess });
    } else {
      const payload: any = { fullName, email, password, role };
      if (role === UserInputRole.teacher) {
        if (staffId) payload.staffId = staffId;
        if (phone) payload.phone = phone;
      }
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit User" : "Create User"}</DialogTitle>
          {!isEditing && <DialogDescription>If role is teacher, a teacher record will be created automatically.</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={role} onChange={e => setRole(e.target.value as UserInputRole)}>
                <option value={UserInputRole.admin}>Admin</option>
                <option value={UserInputRole.teacher}>Teacher</option>
                <option value={UserInputRole.parent}>Parent</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isEditing ? "New Password" : "Password *"}</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEditing ? "(leave blank to keep)" : ""} />
            </div>
          </div>

          {!isEditing && role === UserInputRole.teacher && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/50">
              <div className="col-span-full">
                <p className="text-sm font-semibold">Teacher Details</p>
              </div>
              <div className="space-y-2">
                <Label>Staff ID</Label>
                <Input value={staffId} onChange={e => setStaffId(e.target.value)} placeholder="e.g. GES/24/001" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
