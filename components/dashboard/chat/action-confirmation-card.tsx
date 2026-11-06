"use client";

import * as React from "react";
import { Mail, Calendar, Check, X, ShieldAlert, Edit2, AlertCircle, Loader2 } from "lucide-react";
import { ActionApprovalTicket } from "@/lib/integrations/guardrails";

export interface EmailActionPayload {
  draftId: string;
  to: string | string[];
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
  subject: string;
  body: string;
}

export interface CalendarActionPayload {
  eventId?: string;
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: string[];
}

export interface ActionConfirmationCardProps {
  ticket: ActionApprovalTicket;
  actionType: "email.send" | "calendar.create" | "calendar.update" | "calendar.delete";
  provider?: "google" | "microsoft";
  initialEmailPayload?: EmailActionPayload;
  initialCalendarPayload?: CalendarActionPayload;
  onConfirm: (payload: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ActionConfirmationCard({
  ticket,
  actionType,
  provider = "google",
  initialEmailPayload,
  initialCalendarPayload,
  onConfirm,
  onCancel,
  isLoading = false,
}: ActionConfirmationCardProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [emailData, setEmailData] = React.useState<EmailActionPayload | undefined>(initialEmailPayload);
  const [calendarData, setCalendarData] = React.useState<CalendarActionPayload | undefined>(initialCalendarPayload);
  const [status, setStatus] = React.useState<"idle" | "success" | "cancelled" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const isEmail = actionType === "email.send";

  const handleConfirm = async () => {
    setStatus("idle");
    setErrorMessage(null);
    try {
      if (isEmail && emailData) {
        await onConfirm(emailData);
      } else if (!isEmail && calendarData) {
        await onConfirm({ provider, ...calendarData });
      }
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Falha na confirmação da operação.");
    }
  };

  const handleCancel = () => {
    setStatus("cancelled");
    onCancel();
  };

  if (status === "success") {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 my-3 text-left space-y-2 animate-in fade-in duration-200">
        <div className="flex items-center gap-2.5 text-emerald-400">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Check className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            {isEmail ? "Email enviado com sucesso após confirmação" : "Operação de calendário concluída com sucesso"}
          </span>
        </div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-3.5 my-3 text-left space-y-1 text-muted-foreground animate-in fade-in duration-200">
        <div className="flex items-center gap-2 text-xs">
          <X className="h-3.5 w-3.5 text-zinc-400" />
          <span>Operação cancelada pelo utilizador. Nenhum dado foi enviado ou alterado.</span>
        </div>
      </div>
    );
  }

  const actionTitle = isEmail
    ? "Confirmação de Envio de Email"
    : actionType === "calendar.create"
    ? `Criar Reunião (${provider === "google" ? "Google Calendar" : "Microsoft Outlook"})`
    : actionType === "calendar.update"
    ? `Atualizar Reunião (${provider === "google" ? "Google Calendar" : "Microsoft Outlook"})`
    : `Cancelar Reunião (${provider === "google" ? "Google Calendar" : "Microsoft Outlook"})`;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.03] p-4 my-3 text-left space-y-3.5 backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
            {isEmail ? <Mail className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">{actionTitle}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                Confirmação Humana
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A AI preparou a operação abaixo. Confirme os dados antes da execução.
            </p>
          </div>
        </div>

        {isEmail && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border bg-card hover:bg-hover text-foreground transition-colors cursor-pointer"
          >
            <Edit2 className="h-3 w-3 text-zinc-400" />
            <span>Editar</span>
          </button>
        )}
      </div>

      {/* Content Display / Edit Form */}
      {isEmail && emailData && (
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-xs space-y-2">
          {isEditing ? (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                  Destinatário (Para):
                </label>
                <input
                  type="text"
                  value={Array.isArray(emailData.to) ? emailData.to.join(", ") : emailData.to}
                  onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Assunto:</label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">Mensagem:</label>
                <textarea
                  rows={4}
                  value={emailData.body}
                  onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-[11px] px-2.5 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium"
              >
                Concluir Edição
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-semibold text-foreground">Para:</span>
                <span>{Array.isArray(emailData.to) ? emailData.to.join(", ") : emailData.to}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="font-semibold text-foreground">Assunto:</span>
                <span className="font-medium text-foreground">{emailData.subject}</span>
              </div>
              <div className="pt-1 border-t border-border/40 text-muted-foreground whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto">
                {emailData.body}
              </div>
            </>
          )}
        </div>
      )}

      {!isEmail && calendarData && (
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">Título:</span>
            <span className="font-medium text-foreground">{calendarData.summary}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-semibold text-foreground">Data/Hora:</span>
            <span>{calendarData.start.dateTime}</span>
          </div>
          {calendarData.location && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="font-semibold text-foreground">Local:</span>
              <span>{calendarData.location}</span>
            </div>
          )}
          {calendarData.attendees && calendarData.attendees.length > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="font-semibold text-foreground">Participantes:</span>
              <span>{calendarData.attendees.join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {status === "error" && errorMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Guardrail Safety Disclaimer */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <ShieldAlert className="h-3 w-3 text-amber-400 shrink-0" />
        <span>
          Protegido por confirmação imutável. Qualquer alteração invalida a aprovação anterior.
        </span>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={handleCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          <span>Cancelar</span>
        </button>

        <button
          type="button"
          disabled={isLoading || isEditing}
          onClick={handleConfirm}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/30 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          <span>{isEmail ? "Confirmar e Enviar" : "Confirmar Operação"}</span>
        </button>
      </div>
    </div>
  );
}
