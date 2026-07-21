import React, { useState, useEffect, useCallback } from "react";
import { useListClasses, useListTerms, useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, CreditCard, DollarSign, CheckCircle2, AlertCircle, Calendar } from "lucide-react";

interface FeeType {
  id: number;
  name: string;
  amount: string;
  description: string | null;
}

interface StudentFeeItem {
  id: number;
  feeTypeId: number;
  feeTypeName: string;
  amountDue: string;
  amountPaid: string;
  isPaid: boolean;
  dueDate: string | null;
}

export default function FeesPage() {
  const { data: classes } = useListClasses();
  const { data: terms } = useListTerms();
  const { toast } = useToast();

  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [isLoadingFeeTypes, setIsLoadingFeeTypes] = useState(false);

  // New Fee Category Dialog State
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeAmount, setTypeAmount] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [isCreatingType, setIsCreatingType] = useState(false);

  // Bulk Billing Form State
  const [billClassId, setBillClassId] = useState("");
  const [billTermId, setBillTermId] = useState("");
  const [billFeeTypeId, setBillFeeTypeId] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDueDate, setBillDueDate] = useState("");
  const [isAssigningBulk, setIsAssigningBulk] = useState(false);

  // Student Payment Tracking State
  const [searchClassId, setSearchClassId] = useState("");
  const [searchTermId, setSearchTermId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const { data: students } = useListStudents(
    searchClassId ? { classId: parseInt(searchClassId, 10) } : undefined
  );

  const [studentFees, setStudentFees] = useState<StudentFeeItem[]>([]);
  const [isLoadingStudentFees, setIsLoadingStudentFees] = useState(false);

  // Record Payment Dialog State
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentFeeItem, setPaymentFeeItem] = useState<StudentFeeItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "momo">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Reset student selection when class changes
  useEffect(() => {
    setSelectedStudentId("");
    setStudentFees([]);
  }, [searchClassId]);

  // Auto select first student when roster loads
  useEffect(() => {
    if (students && students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id.toString());
    }
  }, [students, selectedStudentId]);

  // Load Fee Categories
  const fetchFeeTypes = useCallback(async () => {
    setIsLoadingFeeTypes(true);
    try {
      const res = await fetch("/api/fees/types");
      if (res.ok) {
        const data = await res.json();
        setFeeTypes(data);
      }
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed to load fee types" });
    } finally {
      setIsLoadingFeeTypes(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFeeTypes();
  }, [fetchFeeTypes]);

  // Set default term selection
  useEffect(() => {
    if (terms && terms.length > 0) {
      const activeTerm = terms.find(t => t.isCurrent) || terms[0];
      if (activeTerm) {
        if (!billTermId) setBillTermId(activeTerm.id.toString());
        if (!searchTermId) setSearchTermId(activeTerm.id.toString());
      }
    }
  }, [terms, billTermId, searchTermId]);

  // Load Student Fees when student & term are selected
  const fetchStudentFees = useCallback(async () => {
    if (!selectedStudentId || !searchTermId) return;

    setIsLoadingStudentFees(true);
    try {
      const res = await fetch(`/api/fees/student/${selectedStudentId}/${searchTermId}`);
      if (res.ok) {
        const data = await res.json();
        setStudentFees(data);
      }
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed to load student fee records" });
    } finally {
      setIsLoadingStudentFees(false);
    }
  }, [selectedStudentId, searchTermId, toast]);

  useEffect(() => {
    fetchStudentFees();
  }, [fetchStudentFees]);

  // Create Fee Type Handler
  const handleCreateType = async () => {
    if (!typeName || !typeAmount) {
      return toast({ variant: "destructive", title: "Name and Amount are required" });
    }

    setIsCreatingType(true);
    try {
      const res = await fetch("/api/fees/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typeName,
          amount: parseFloat(typeAmount),
          description: typeDescription || undefined,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      toast({ title: "Fee Category Created", description: `Added category "${typeName}".` });
      setIsTypeDialogOpen(false);
      setTypeName("");
      setTypeAmount("");
      setTypeDescription("");
      fetchFeeTypes();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to create fee category";
      toast({ variant: "destructive", title: "Creation Failed", description: errMsg });
    } finally {
      setIsCreatingType(false);
    }
  };

  // Bulk Billing Handler
  const handleAssignBulk = async () => {
    if (!billClassId || !billTermId || !billFeeTypeId || !billAmount) {
      return toast({ variant: "destructive", title: "Fill all required billing fields" });
    }

    setIsAssigningBulk(true);
    try {
      const res = await fetch("/api/fees/assign-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: parseInt(billClassId, 10),
          termId: parseInt(billTermId, 10),
          feeTypeId: parseInt(billFeeTypeId, 10),
          amount: parseFloat(billAmount),
          dueDate: billDueDate || undefined,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const result = await res.json();
      toast({
        title: "Class Billed Successfully",
        description: `Billed ${result.assignedCount} students GH₵ ${parseFloat(billAmount).toFixed(2)}.`,
      });

      setBillAmount("");
      setBillDueDate("");
      if (selectedStudentId) fetchStudentFees();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to bill class";
      toast({ variant: "destructive", title: "Billing Failed", description: errMsg });
    } finally {
      setIsAssigningBulk(false);
    }
  };

  // Record Payment Handler
  const handleRecordPayment = async () => {
    if (!paymentFeeItem || !paymentAmount || !paymentDate) {
      return toast({ variant: "destructive", title: "Fill required payment fields" });
    }

    setIsRecordingPayment(true);
    try {
      const res = await fetch("/api/fees/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentFeeId: paymentFeeItem.id,
          amountPaid: parseFloat(paymentAmount),
          paymentDate,
          paymentMethod,
          reference: paymentReference || undefined,
          notes: paymentNotes || undefined,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      toast({
        title: "Payment Recorded",
        description: `Successfully recorded payment of GH₵ ${parseFloat(paymentAmount).toFixed(2)}.`,
      });

      setIsPaymentDialogOpen(false);
      setPaymentFeeItem(null);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      fetchStudentFees();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to record payment";
      toast({ variant: "destructive", title: "Payment Error", description: errMsg });
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Calculate Total Billed, Paid, and Arrears for selected student
  const totalBilled = studentFees.reduce((acc, f) => acc + parseFloat(f.amountDue), 0);
  const totalPaid = studentFees.reduce((acc, f) => acc + parseFloat(f.amountPaid), 0);
  const totalArrears = totalBilled - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Fees & Financial Billing Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage fee categories, assign class bills, and record student payment receipts.
          </p>
        </div>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid grid-cols-3 w-full sm:w-[500px]">
          <TabsTrigger value="payments">Student Payments</TabsTrigger>
          <TabsTrigger value="billing">Class Billing</TabsTrigger>
          <TabsTrigger value="categories">Fee Categories</TabsTrigger>
        </TabsList>

        {/* Tab 1: Student Fee Payments */}
        <TabsContent value="payments" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Student & Term</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={searchClassId} onChange={e => { setSearchClassId(e.target.value); setSelectedStudentId(""); }}>
                    <option value="">Select Class...</option>
                    {classes?.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} disabled={!searchClassId}>
                    <option value="">Select Student...</option>
                    {students?.map(s => <option key={s.id} value={s.id.toString()}>{s.fullName} ({s.studentIdNumber})</option>)}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Term</Label>
                  <Select value={searchTermId} onChange={e => setSearchTermId(e.target.value)}>
                    <option value="">Select Term...</option>
                    {terms?.map(t => <option key={t.id} value={t.id.toString()}>{t.name} {t.isCurrent ? "(Current)" : ""}</option>)}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedStudentId && (
            <>
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground font-medium">Total Billed</div>
                    <div className="text-2xl font-bold mt-1 text-foreground">GH₵ {totalBilled.toFixed(2)}</div>
                  </CardContent>
                </Card>

                <Card className="bg-emerald-500/5 border-emerald-500/20">
                  <CardContent className="pt-6">
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Total Paid</div>
                    <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">GH₵ {totalPaid.toFixed(2)}</div>
                  </CardContent>
                </Card>

                <Card className={totalArrears > 0 ? "bg-destructive/5 border-destructive/20" : "bg-muted/30"}>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground font-medium">Outstanding Balance</div>
                    <div className={`text-2xl font-bold mt-1 ${totalArrears > 0 ? "text-destructive" : "text-foreground"}`}>
                      GH₵ {totalArrears.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Fee Breakdown Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fee Line Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingStudentFees ? (
                    <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
                  ) : studentFees.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">No fees billed for this student in this term.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fee Type</TableHead>
                          <TableHead>Amount Due</TableHead>
                          <TableHead>Amount Paid</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentFees.map(fee => {
                          const due = parseFloat(fee.amountDue);
                          const paid = parseFloat(fee.amountPaid);
                          const bal = due - paid;

                          return (
                            <TableRow key={fee.id}>
                              <TableCell className="font-medium">{fee.feeTypeName}</TableCell>
                              <TableCell>GH₵ {due.toFixed(2)}</TableCell>
                              <TableCell>GH₵ {paid.toFixed(2)}</TableCell>
                              <TableCell className={bal > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
                                GH₵ {bal.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {fee.isPaid ? (
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Fully Paid</Badge>
                                ) : paid > 0 ? (
                                  <Badge variant="secondary">Partial</Badge>
                                ) : (
                                  <Badge variant="destructive">Unpaid</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  disabled={fee.isPaid}
                                  onClick={() => {
                                    setPaymentFeeItem(fee);
                                    setPaymentAmount(bal.toString());
                                    setIsPaymentDialogOpen(true);
                                  }}
                                >
                                  <DollarSign className="w-4 h-4 mr-1" /> Record Payment
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Class Billing */}
        <TabsContent value="billing" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Assign Fee Bill to Class</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Class *</Label>
                  <Select value={billClassId} onChange={e => setBillClassId(e.target.value)}>
                    <option value="">Select Class...</option>
                    {classes?.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Term *</Label>
                  <Select value={billTermId} onChange={e => setBillTermId(e.target.value)}>
                    <option value="">Select Term...</option>
                    {terms?.map(t => <option key={t.id} value={t.id.toString()}>{t.name} {t.isCurrent ? "(Current)" : ""}</option>)}
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fee Category *</Label>
                <Select
                  value={billFeeTypeId}
                  onChange={e => {
                    setBillFeeTypeId(e.target.value);
                    const selectedCategory = feeTypes.find(ft => ft.id === parseInt(e.target.value, 10));
                    if (selectedCategory) setBillAmount(selectedCategory.amount);
                  }}
                >
                  <option value="">Select Category...</option>
                  {feeTypes.map(ft => <option key={ft.id} value={ft.id.toString()}>{ft.name} (Std: GH₵ {parseFloat(ft.amount).toFixed(2)})</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount to Bill (GH₵) *</Label>
                  <Input type="number" step="0.01" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="0.00" />
                </div>

                <div className="space-y-2">
                  <Label>Due Date (Optional)</Label>
                  <Input type="date" value={billDueDate} onChange={e => setBillDueDate(e.target.value)} />
                </div>
              </div>

              <Button onClick={handleAssignBulk} disabled={isAssigningBulk} className="w-full mt-4">
                {isAssigningBulk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Bill All Class Enrolled Students
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Fee Categories */}
        <TabsContent value="categories" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Configured Fee Types</h2>
            <Button onClick={() => setIsTypeDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add Category
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoadingFeeTypes ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
              ) : feeTypes.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No fee categories configured yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category Name</TableHead>
                      <TableHead>Standard Amount</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeTypes.map(ft => (
                      <TableRow key={ft.id}>
                        <TableCell className="font-medium">{ft.name}</TableCell>
                        <TableCell>GH₵ {parseFloat(ft.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{ft.description || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal 1: Create Fee Category */}
      <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Add Fee Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input value={typeName} onChange={e => setTypeName(e.target.value)} placeholder="e.g. Tuition Fees, Feeding, Books" />
            </div>

            <div className="space-y-2">
              <Label>Standard Amount (GH₵) *</Label>
              <Input type="number" step="0.01" value={typeAmount} onChange={e => setTypeAmount(e.target.value)} placeholder="500.00" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={typeDescription} onChange={e => setTypeDescription(e.target.value)} placeholder="Optional description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTypeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateType} disabled={isCreatingType}>Save Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Record Payment */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Record Fee Payment</DialogTitle>
          </DialogHeader>
          {paymentFeeItem && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/40 p-3 rounded-lg text-sm">
                <div className="font-semibold">{paymentFeeItem.feeTypeName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Remaining Balance: GH₵ {(parseFloat(paymentFeeItem.amountDue) - parseFloat(paymentFeeItem.amountPaid)).toFixed(2)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount Paid (GH₵) *</Label>
                <Input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Payment Date *</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="momo">Mobile Money (MoMo)</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transaction Reference</Label>
                <Input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="e.g. Receipt # or MoMo TxID" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={isRecordingPayment}>Submit Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
