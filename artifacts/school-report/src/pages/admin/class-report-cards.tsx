import React, { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetClassReportCards, useGetClass, useGetTerm } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Printer, MessageSquare, Mail, Settings2, Download } from "lucide-react";
import StudentReportCardView from "@/components/StudentReportCardView";

export default function ClassReportCardsPage() {
  const [, params] = useRoute("/admin/report-cards/:classId/:termId");
  const classId = parseInt(params?.classId || "0");
  const termId = parseInt(params?.termId || "0");

  const { data: cls } = useGetClass(classId, { query: { enabled: !!classId, queryKey: ['class', classId] }});
  const { data: term } = useGetTerm(termId, { query: { enabled: !!termId, queryKey: ['term', termId] }});
  
  const { data: reportCards, isLoading } = useGetClassReportCards(classId, termId, {
    query: { enabled: !!classId && !!termId, queryKey: ['class-reports', classId, termId] }
  });

  const [editingMetadata, setEditingMetadata] = useState<any>(null);
  const [isSending, setIsSending] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSendNotification = async (studentId: number, name: string, channel: "whatsapp" | "email") => {
    setIsSending(`${studentId}-${channel}`);
    try {
      const response = await fetch("/api/notifications/send-report-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, termId, channel }),
      });

      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();

      toast({
        title: channel === "whatsapp" ? "WhatsApp Sent" : "Email Sent",
        description: `Successfully dispatched report card link for ${name} to ${result.target}. Check logs.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Notification failed", description: e.message });
    } finally {
      setIsSending(null);
    }
  };

  if (isLoading) return <div><Loader2 className="w-6 h-6 animate-spin mx-auto mt-10" /></div>;
  if (!reportCards || reportCards.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/admin/report-cards" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Workflow
        </Link>
        <Card className="p-12 text-center text-muted-foreground">
          No report cards found for this class and term. Ensure scores are entered.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden gap-3">
        <div>
          <Link href="/admin/report-cards" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Workflow
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Report Cards: {cls?.name}</h1>
          <p className="text-muted-foreground text-sm">{term?.name} ({term?.academicYearLabel})</p>
        </div>
        <Button onClick={() => window.print()} size="sm">
          <Printer className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Print All</span>
        </Button>
      </div>

      <div className="space-y-12">
        {reportCards.map((rc, idx) => (
          <div key={rc.studentId} className={`space-y-4 ${idx < reportCards.length - 1 ? "print:break-after-page" : ""}`}>
            {/* Control Panel (Hidden on print) */}
            <Card className="bg-muted/30 border border-border/80 print:hidden">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm font-semibold">
                  Reviewing: <span className="text-primary font-bold">{rc.studentName}</span>
                </div>
                <div className="flex flex-col w-full gap-2 sm:flex-row sm:w-auto sm:items-center">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full sm:w-auto shrink-0"
                    onClick={() => setEditingMetadata({ 
                      studentId: rc.studentId, 
                      studentName: rc.studentName,
                      daysOpened: rc.metadata?.daysOpened || 0,
                      daysPresent: rc.metadata?.daysPresent || 0,
                      conduct: rc.metadata?.conduct || "",
                      attitude: rc.metadata?.attitude || "",
                      interest: rc.metadata?.interest || "",
                      teacherRemarks: rc.metadata?.teacherRemarks || "",
                      headmasterRemarks: rc.metadata?.headmasterRemarks || ""
                    })}
                  >
                    <Settings2 className="w-4 h-4 mr-1.5" /> Attendance & Traits
                  </Button>
                  <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:w-auto">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-emerald-700 dark:text-emerald-400 w-full"
                      disabled={isSending !== null}
                      onClick={() => handleSendNotification(rc.studentId, rc.studentName, "whatsapp")}
                    >
                      {isSending === `${rc.studentId}-whatsapp` ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4 mr-1.5" />
                      )}
                      <span className="hidden xs:inline">WhatsApp</span>
                      <span className="xs:hidden">WA</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full"
                      disabled={isSending !== null}
                      onClick={() => handleSendNotification(rc.studentId, rc.studentName, "email")}
                    >
                      {isSending === `${rc.studentId}-email` ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4 mr-1.5" />
                      )}
                      Email
                    </Button>
                    <a href={`/api/report-cards/${rc.studentId}/${termId}/export`} download className="w-full">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        PDF
                      </Button>
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Printout Report View */}
            <StudentReportCardView reportCard={rc} />
          </div>
        ))}
      </div>

      <MetadataDialog 
        open={!!editingMetadata} 
        onOpenChange={(v) => !v && setEditingMetadata(null)} 
        metadata={editingMetadata}
        termId={termId}
        onSaveSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['class-reports', classId, termId] });
        }}
      />
    </div>
  );
}

interface MetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: any;
  termId: number;
  onSaveSuccess: () => void;
}

function MetadataDialog({ open, onOpenChange, metadata, termId, onSaveSuccess }: MetadataDialogProps) {
  const [daysOpened, setDaysOpened] = useState("");
  const [daysPresent, setDaysPresent] = useState("");
  const [conduct, setConduct] = useState("");
  const [attitude, setAttitude] = useState("");
  const [interest, setInterest] = useState("");
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [headmasterRemarks, setHeadmasterRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

  React.useEffect(() => {
    if (open && metadata) {
      setDaysOpened(metadata.daysOpened?.toString() || "");
      setDaysPresent(metadata.daysPresent?.toString() || "");
      setConduct(metadata.conduct || "");
      setAttitude(metadata.attitude || "");
      setInterest(metadata.interest || "");
      setTeacherRemarks(metadata.teacherRemarks || "");
      setHeadmasterRemarks(metadata.headmasterRemarks || "");
    }
  }, [open, metadata]);

  const handleSave = async () => {
    if (!daysOpened || !daysPresent) {
      return toast({ variant: "destructive", title: "Attendance details are required" });
    }
    if (parseInt(daysPresent) > parseInt(daysOpened)) {
      return toast({ variant: "destructive", title: "Days Present cannot exceed Days Opened" });
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/student-term-metadata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: metadata.studentId,
          termId,
          daysOpened: parseInt(daysOpened),
          daysPresent: parseInt(daysPresent),
          conduct,
          attitude,
          interest,
          teacherRemarks,
          headmasterRemarks,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      toast({ title: "Term details saved successfully" });
      onSaveSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to save details", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg mx-auto overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Terminal Details: {metadata?.studentName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Days School Opened</Label>
              <Input type="number" value={daysOpened} onChange={e => setDaysOpened(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Days Student Present</Label>
              <Input type="number" value={daysPresent} onChange={e => setDaysPresent(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conduct / Behavior</Label>
            <Input placeholder="e.g. Excellent, Respectful" value={conduct} onChange={e => setConduct(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Attitude to Work</Label>
            <Input placeholder="e.g. Hardworking, Attentive" value={attitude} onChange={e => setAttitude(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Special Interest</Label>
            <Input placeholder="e.g. Sports, Art, Reading" value={interest} onChange={e => setInterest(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Class Teacher's Remarks</Label>
            <Textarea placeholder="Overall review of student performance..." value={teacherRemarks} onChange={e => setTeacherRemarks(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Headmaster's Remarks</Label>
            <Textarea placeholder="Final summary and promotion recommendations..." value={headmasterRemarks} onChange={e => setHeadmasterRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
