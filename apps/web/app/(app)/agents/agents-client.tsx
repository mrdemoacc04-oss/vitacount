"use client";

import { useState } from "react";
import { Shield, ShieldAlert, Sparkles, Filter, CheckCircle2, AlertTriangle, Eye, RotateCcw, Play } from "lucide-react";
import { updateAgentAutonomyPolicyAction, triggerEmergencyKillSwitchAction } from "@/lib/actions/agent-control-plane-actions";

interface AgentsClientProps {
  initialLogs: any[];
  tenantSettings: any;
}

export function AgentsClient({ initialLogs, tenantSettings }: AgentsClientProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);

  const policies = tenantSettings?.agent_policies || {
    ap_bookkeeping_agent: 2,
    reconciliation_agent: 2,
    ar_collections_agent: 2,
  };

  const [policyState, setPolicyState] = useState<Record<string, number>>({
    ap_bookkeeping_agent: Number(policies.ap_bookkeeping_agent ?? 2),
    reconciliation_agent: Number(policies.reconciliation_agent ?? 2),
    ar_collections_agent: Number(policies.ar_collections_agent ?? 2),
  });

  const [loadingAgent, setLoadingAgent] = useState<string | null>(null);
  const [isKilling, setIsKilling] = useState(false);

  async function handlePolicyChange(agentName: string, level: number) {
    setLoadingAgent(agentName);
    try {
      await updateAgentAutonomyPolicyAction(agentName, level);
      setPolicyState((prev) => ({ ...prev, [agentName]: level }));
    } catch (err: any) {
      alert(err.message || "Failed to update autonomy level");
    } finally {
      setLoadingAgent(null);
    }
  }

  async function handleEmergencyKillSwitch() {
    if (!confirm("EMERGENCY KILL-SWITCH: Are you sure you want to disable ALL autonomous agents (L0 Off) for this workspace?")) return;
    setIsKilling(true);
    try {
      await triggerEmergencyKillSwitchAction();
      setPolicyState({
        ap_bookkeeping_agent: 0,
        reconciliation_agent: 0,
        ar_collections_agent: 0,
      });
    } catch (err: any) {
      alert(err.message || "Failed to trigger emergency kill-switch");
    } finally {
      setIsKilling(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchesAgent = agentFilter === "all" || log.agent_name === agentFilter;
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesAgent && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Kill-Switch */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Decide how much each agent may do on its own, pause them all at once, and review every action they take.
          </p>
        </div>

        <button
          onClick={handleEmergencyKillSwitch}
          disabled={isKilling}
          className="flex items-center gap-2 rounded-xl bg-destructive/15 px-4 py-2 text-xs font-bold text-destructive border border-destructive/30 shadow-xs transition-transform active:scale-95 hover:bg-destructive/25 disabled:opacity-50"
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Emergency Kill-Switch (All L0)</span>
        </button>
      </div>

      {/* Agent Roster & Policy Toggles */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* AP Bookkeeping Agent */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-positive" />
              <span className="font-semibold text-sm text-foreground">AP Bookkeeping Agent</span>
            </div>
            <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[10px] font-bold text-positive">
              L{policyState.ap_bookkeeping_agent} Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Itemized OCR extraction, vendor rules learning loop, and duplicate protection.
          </p>
          <div className="flex items-center gap-1.5 pt-2">
            {[
              { level: 0, label: "L0 Off" },
              { level: 1, label: "L1 Draft" },
              { level: 2, label: "L2 Auto" },
            ].map((btn) => (
              <button
                key={btn.level}
                onClick={() => handlePolicyChange("ap_bookkeeping_agent", btn.level)}
                disabled={loadingAgent === "ap_bookkeeping_agent"}
                className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  policyState.ap_bookkeeping_agent === btn.level
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reconciliation Agent */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Reconciliation Agent</span>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              L{policyState.reconciliation_agent} Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Multi-signal AI matcher ($\ge 95\%$ auto-match) with 1-click reversing GL entries.
          </p>
          <div className="flex items-center gap-1.5 pt-2">
            {[
              { level: 0, label: "L0 Off" },
              { level: 1, label: "L1 Review" },
              { level: 2, label: "L2 Auto" },
            ].map((btn) => (
              <button
                key={btn.level}
                onClick={() => handlePolicyChange("reconciliation_agent", btn.level)}
                disabled={loadingAgent === "reconciliation_agent"}
                className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  policyState.reconciliation_agent === btn.level
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* AR Collections Agent */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-warning" />
              <span className="font-semibold text-sm text-foreground">AR Collections Agent</span>
            </div>
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
              L{policyState.ar_collections_agent} Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Multi-step dunning reminders, customer risk delay scoring, and Stripe pay links.
          </p>
          <div className="flex items-center gap-1.5 pt-2">
            {[
              { level: 0, label: "L0 Off" },
              { level: 1, label: "L1 Draft" },
              { level: 2, label: "L2 Auto" },
            ].map((btn) => (
              <button
                key={btn.level}
                onClick={() => handlePolicyChange("ar_collections_agent", btn.level)}
                disabled={loadingAgent === "ar_collections_agent"}
                className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  policyState.ar_collections_agent === btn.level
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Unified Agent Actions Audit Log */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-foreground">Complete Agent Actions Audit Log</h2>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-hidden"
            >
              <option value="all">All Agents</option>
              <option value="ap_bookkeeping_agent">AP Bookkeeping Agent</option>
              <option value="reconciliation_agent">Reconciliation Agent</option>
              <option value="ar_collections_agent">AR Collections Agent</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="auto_executed">Auto-Executed (L2)</option>
              <option value="approved">Approved</option>
              <option value="proposed">Proposed (L1)</option>
              <option value="reversed">Reversed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No agent action logs match the filter criteria.</div>
        ) : (
          <div className="divide-y divide-border/40 text-xs">
            {filteredLogs.map((action) => (
              <div key={action.id} className="flex flex-col gap-2 px-6 py-3.5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      {action.agent_name?.replace(/_/g, " ").toUpperCase()} • <span className="capitalize">{action.trigger_event?.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Module: {action.module} • Autonomy: L{action.autonomy_level} • {action.created_at?.slice(0, 19).replace("T", " ")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                      action.status === "auto_executed" || action.status === "approved"
                        ? "bg-positive/10 text-positive"
                        : action.status === "reversed"
                        ? "bg-warning/10 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {action.status?.replace("_", " ")}
                  </span>

                  <button
                    onClick={() => setSelectedPayload(action)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Payload</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JSON Payload Inspection Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold text-foreground">Agent Action Payload Inspector</h3>
              <button onClick={() => setSelectedPayload(null)} className="text-xs text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
            <pre className="max-h-96 overflow-y-auto rounded-xl border border-border bg-black/40 p-4 font-mono text-xs text-positive">
              {JSON.stringify(selectedPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
