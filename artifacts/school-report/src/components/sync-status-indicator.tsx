import { useEffect, useState, useCallback } from "react";
import { 
  queueGet, 
  queueRemove, 
  queueCount, 
  initDb 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";

export default function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Update queue count from IndexedDB
  const updateQueueCount = useCallback(async () => {
    try {
      await initDb();
      const count = await queueCount();
      setPendingCount(count);
    } catch (err) {
      console.error("Failed to read sync queue count:", err);
    }
  }, []);

  // 2. Check server connectivity
  const checkServerPing = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { method: "GET", cache: "no-store" });
      setIsServerReachable(response.ok);
      return response.ok;
    } catch {
      setIsServerReachable(false);
      return false;
    }
  }, []);

  // 3. Sequential Sync Loop
  const performSync = useCallback(async () => {
    if (syncStatus === "syncing") return;
    
    const reachable = await checkServerPing();
    if (!reachable) {
      console.warn("[Sync Engine] Cannot sync: local server port is unreachable.");
      return;
    }

    const items = await queueGet();
    if (items.length === 0) return;

    setSyncStatus("syncing");
    console.log(`[Sync Engine] Starting background flush of ${items.length} changes...`);

    let errorOccurred = false;

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: {
            ...item.headers,
            "Content-Type": "application/json"
          },
          body: item.body
        });

        if (response.ok) {
          await queueRemove(item.id!);
          console.log(`[Sync Engine] Item ${item.id} synced successfully: ${item.method} ${item.url}`);
        } else {
          console.error(`[Sync Engine] Server rejected request ${item.id}:`, response.status);
          errorOccurred = true;
          break; // Stop loop to preserve strict FIFO ordering
        }
      } catch (networkErr) {
        console.error(`[Sync Engine] Network error during item ${item.id} sync:`, networkErr);
        errorOccurred = true;
        break; // Stop sync loop if connection fails
      }
    }

    await updateQueueCount();
    setSyncStatus(errorOccurred ? "error" : "idle");

    if (!errorOccurred) {
      toast({
        title: "Database Synced",
        description: "All offline changes have been uploaded successfully.",
      });
      // Invalidate queries so that React Query fetches fresh database values
      queryClient.invalidateQueries();
    } else {
      toast({
        variant: "destructive",
        title: "Sync Paused",
        description: "Some changes could not be synced. Check connection to school server.",
      });
    }
  }, [syncStatus, checkServerPing, updateQueueCount, queryClient, toast]);

  // Set up listeners and timers
  useEffect(() => {
    // A. Listen for network events
    const handleOnline = () => {
      setIsOnline(true);
      performSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsServerReachable(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // B. Listen for custom events dispatched by customFetch
    const handleQueueUpdated = () => {
      updateQueueCount();
    };

    const handleItemQueued = (e: Event) => {
      updateQueueCount();
      const customEvent = e as CustomEvent;
      toast({
        title: "Offline Mode Active",
        description: "Your edits are saved locally on this device. They will sync automatically when you connect to the school server.",
      });
    };

    window.addEventListener("offline-sync-queue-updated", handleQueueUpdated);
    window.addEventListener("offline-sync-item-queued", handleItemQueued);

    // Initialize counts
    updateQueueCount();
    checkServerPing().then((ok) => {
      if (ok && navigator.onLine) {
        performSync();
      }
    });

    // C. Setup periodic status checkers & auto-sync intervals
    const pingInterval = setInterval(async () => {
      const ok = await checkServerPing();
      if (ok && pendingCount > 0 && syncStatus !== "syncing") {
        performSync();
      }
    }, 15000); // check connectivity every 15s

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-sync-queue-updated", handleQueueUpdated);
      window.removeEventListener("offline-sync-item-queued", handleItemQueued);
      clearInterval(pingInterval);
    };
  }, [performSync, checkServerPing, updateQueueCount, pendingCount, syncStatus, toast]);

  const activeOnline = isOnline && isServerReachable;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all shadow-sm duration-300">
      {activeOnline ? (
        syncStatus === "syncing" ? (
          <div className="flex items-center gap-2 text-blue-500 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30 px-2 py-1 rounded">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Syncing changes ({pendingCount} left)...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30 px-2 py-1 rounded">
            <Wifi className="h-4 w-4" />
            <span>Connected to School Server</span>
          </div>
        )
      ) : (
        <div className="flex items-center gap-3 bg-amber-50/80 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/30 px-2.5 py-1 rounded shadow-sm">
          <WifiOff className="h-4 w-4 animate-pulse text-amber-500" />
          <div className="flex flex-col">
            <span className="font-semibold text-xs leading-none">Standalone Offline Mode</span>
            {pendingCount > 0 && (
              <span className="text-[10px] opacity-90 mt-0.5">{pendingCount} local updates waiting to sync</span>
            )}
          </div>
          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={syncStatus === "syncing"}
              onClick={() => {
                checkServerPing().then((ok) => {
                  if (ok) {
                    performSync();
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Cannot Connect",
                      description: "The local school server is still unreachable on this network.",
                    });
                  }
                });
              }}
              className="h-6 text-[10px] px-2 py-1 font-semibold border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-white/70 dark:bg-black/40 hover:bg-amber-100/50"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Sync Now
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
