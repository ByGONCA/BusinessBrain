"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Sparkles,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  Mail,
  Link2,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { completeOnboardingAction } from "@/lib/onboarding/actions";
import {
  getMyPendingInvitationsAction,
  getInvitationPreviewByTokenAction,
  acceptInvitationAction,
  acceptMyPendingInvitationAction,
} from "@/lib/invitations/actions";
import { PendingUserInvitation, InvitationPreview } from "@/lib/invitations/types";

export default function OnboardingPage() {
  const router = useRouter();

  // Mode: "create" (primary) vs "join" (secondary discrete alternative)
  const [mode, setMode] = React.useState<"create" | "join">("create");

  // Create Mode Form State
  const [companyName, setCompanyName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");

  // Create Mode Provisioning State
  const [isProvisioning, setIsProvisioning] = React.useState(false);
  const [provisioningPhase, setProvisioningPhase] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  // Join Mode State
  const [pendingInvites, setPendingInvites] = React.useState<PendingUserInvitation[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = React.useState(false);
  const [inviteInput, setInviteInput] = React.useState("");
  const [isCheckingToken, setIsCheckingToken] = React.useState(false);
  const [invitePreview, setInvitePreview] = React.useState<InvitationPreview | null>(null);
  const [isAccepting, setIsAccepting] = React.useState(false);

  // Auto-fetch pending invitations when switching to join mode
  React.useEffect(() => {
    if (mode === "join") {
      setIsLoadingInvites(true);
      getMyPendingInvitationsAction()
        .then((res) => {
          if (res.success) {
            setPendingInvites(res.invitations);
          }
        })
        .finally(() => {
          setIsLoadingInvites(false);
        });
    }
  }, [mode]);

  // Slug generator for creation
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCompanyName(val);
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(generated);
  };

  // Start Provisioning for Workspace Creation
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !slug.trim()) return;

    setIsProvisioning(true);
    setError(null);
    setProvisioningPhase(1);

    await new Promise((r) => setTimeout(r, 600));
    setProvisioningPhase(2);

    try {
      const res = await completeOnboardingAction({
        name: companyName.trim(),
        slug: slug.trim(),
        websiteUrl: websiteUrl.trim(),
        objectives: ["knowledge", "decisions"],
        acquisitionChannel: "direct",
      });

      if (!res.success) {
        setError(res.error || "Falha ao criar o workspace.");
        setIsProvisioning(false);
        return;
      }

      setProvisioningPhase(3);
      await new Promise((r) => setTimeout(r, 600));
      setProvisioningPhase(4);

      // Navigate to Stripe pricing / trial selection for new company owner
      await new Promise((r) => setTimeout(r, 700));
      window.location.href = "/pricing?reason=subscription_required";
    } catch (err: unknown) {
      console.error("Onboarding error:", err);
      setError("Ocorreu um erro inesperado ao criar o workspace. Tenta novamente.");
      setIsProvisioning(false);
    }
  };

  // Check manual invite code or URL link
  const handleCheckInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;

    setIsCheckingToken(true);
    setError(null);
    setInvitePreview(null);

    try {
      const res = await getInvitationPreviewByTokenAction(inviteInput);
      if (!res.success || !res.invitation) {
        setError(res.error || "Convite não encontrado ou link inválido.");
      } else {
        setInvitePreview(res.invitation);
      }
    } catch {
      setError("Falha ao verificar convite.");
    } finally {
      setIsCheckingToken(false);
    }
  };

  // Accept pending invitation by ID (auto-detected)
  const handleAcceptPendingInvite = async (inviteId: string) => {
    setIsAccepting(true);
    setError(null);
    try {
      const res = await acceptMyPendingInvitationAction(inviteId);
      if (res.success && res.organizationId) {
        // Direct entry to dashboard (inherited entitlement, no Stripe checkout)
        window.location.href = "/dashboard";
      } else {
        setError(res.error || "Falha ao aceitar convite.");
        setIsAccepting(false);
      }
    } catch {
      setError("Ocorreu um erro inesperado ao aceitar o convite.");
      setIsAccepting(false);
    }
  };

  // Accept invitation via verified preview token
  const handleAcceptPreviewInvite = async () => {
    if (!invitePreview?.rawToken) return;
    setIsAccepting(true);
    setError(null);
    try {
      const res = await acceptInvitationAction(invitePreview.rawToken);
      if (res.success && res.organizationId) {
        // Direct entry to dashboard (inherited entitlement, no Stripe checkout)
        window.location.href = "/dashboard";
      } else {
        setError(res.error || "Falha ao aceitar convite.");
        setIsAccepting(false);
      }
    } catch {
      setError("Ocorreu um erro inesperado ao aceitar o convite.");
      setIsAccepting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0B0C] px-4 py-10 text-[#F5F5F5]">
      <div className="w-full max-w-xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#19191C] border border-[#29292D] text-[#F5F5F5] shadow-sm">
            <Sparkles className="h-5 w-5 text-blue-400" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#F5F5F5]">
            Welcome to Company Brain
          </h1>
          <p className="mt-1 text-xs text-[#A1A1AA]">
            {mode === "create"
              ? "Configura o teu workspace e a camada de inteligência da tua empresa"
              : "Junta-te a uma empresa ou workspace existente através de convite"}
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* PROVISIONING VIEW                                        */}
        {/* ======================================================== */}
        {isProvisioning ? (
          <div className="mt-6 rounded-xl border border-[#29292D] bg-[#141416] p-8 shadow-xl text-center space-y-6 animate-in fade-in duration-300">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-lg">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#F5F5F5]">
                A criar o teu workspace...
              </h2>
              <p className="text-xs text-[#71717A] mt-1">
                A configurar isolamento multi-tenant e memória institucional para {companyName || "a tua equipa"}
              </p>
            </div>

            <div className="space-y-3 text-left max-w-sm mx-auto pt-2">
              <div className="flex items-center gap-3 text-xs">
                {provisioningPhase >= 1 ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Check className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-[#27272A] bg-[#18181B]" />
                )}
                <span className={provisioningPhase >= 1 ? "text-[#F5F5F5]" : "text-[#71717A]"}>
                  A configurar privacidade e segurança do espaço de trabalho
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {provisioningPhase >= 2 ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Check className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-[#27272A] bg-[#18181B]" />
                )}
                <span className={provisioningPhase >= 2 ? "text-[#F5F5F5]" : "text-[#71717A]"}>
                  A inicializar o grafo e memória empresarial
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {provisioningPhase >= 3 ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Check className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-[#27272A] bg-[#18181B]" />
                )}
                <span className={provisioningPhase >= 3 ? "text-[#F5F5F5]" : "text-[#71717A]"}>
                  A atribuir permissões de proprietário e sessão ativa
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {provisioningPhase >= 4 ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Check className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-[#27272A] bg-[#18181B]" />
                )}
                <span className={provisioningPhase >= 4 ? "text-[#F5F5F5]" : "text-[#71717A]"}>
                  Concluído! A redirecionar para seleção de plano...
                </span>
              </div>
            </div>
          </div>
        ) : mode === "create" ? (
          /* ======================================================== */
          /* CREATE COMPANY WORKSPACE VIEW (PRIMARY)                  */
          /* ======================================================== */
          <div className="mt-6 rounded-xl border border-[#29292D] bg-[#141416] p-6 shadow-xl space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-base font-semibold text-[#F5F5F5]">
                Workspace details
              </h2>
              <p className="text-xs text-[#71717A] mt-0.5">
                Todos os documentos, reuniões e decisões ficarão isolados neste workspace.
              </p>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <Input
                label="Nome da empresa ou workspace"
                placeholder="Acme Corp"
                value={companyName}
                onChange={handleNameChange}
                required
                autoFocus
              />

              <div>
                <Input
                  label="URL slug do workspace"
                  placeholder="acme-corp"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required
                />
                <p className="mt-1 text-[11px] text-[#71717A]">
                  companybrain.com/<span className="text-[#A1A1AA]">{slug || "acme-corp"}</span>
                </p>
              </div>

              <Input
                label="Website da empresa (opcional)"
                placeholder="https://wareva.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                type="url"
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={!companyName.trim() || !slug.trim()}
                  className="w-full gap-2 font-semibold"
                >
                  <span>Criar empresa</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {/* Discrete Secondary Alternative: Join Existing Workspace */}
            <div className="pt-4 border-t border-[#27272A] text-center space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMode("join");
                  setError(null);
                }}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Já fazes parte de uma empresa? Junta-te a uma empresa existente
              </button>
              <p className="text-[11px] text-[#71717A]">
                Aceita um convite para entrar num workspace existente.
              </p>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* JOIN EXISTING WORKSPACE VIEW (SECONDARY)                 */
          /* ======================================================== */
          <div className="mt-6 rounded-xl border border-[#29292D] bg-[#141416] p-6 shadow-xl space-y-6 animate-in fade-in duration-200">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                <h2 className="text-base font-semibold text-[#F5F5F5]">
                  Juntar a uma empresa existente
                </h2>
              </div>
              <p className="text-xs text-[#71717A] mt-1">
                Aceita um convite emitido para a tua conta para começar a colaborar.
              </p>
            </div>

            {/* 1. Pending Invitations Auto-Detected for User */}
            {isLoadingInvites ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs text-[#A1A1AA]">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                <span>A procurar convites pendentes para a tua conta...</span>
              </div>
            ) : pendingInvites.length > 0 ? (
              <div className="space-y-3">
                <span className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wider">
                  Convites disponíveis para a tua conta
                </span>
                <div className="space-y-2.5">
                  {pendingInvites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-xl border border-[#27272A] bg-[#09090B] p-4 transition-all hover:border-[#3F3F46]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#F5F5F5]">
                            {inv.organizationName}
                          </span>
                          <Badge variant="outline" className="text-[10px] capitalize border-blue-500/30 text-blue-400 bg-blue-500/10">
                            {inv.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#71717A]">
                          <Clock className="h-3 w-3" />
                          <span>Expira a {new Date(inv.expiresAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={isAccepting}
                        onClick={() => handleAcceptPendingInvite(inv.id)}
                        className="gap-1.5"
                      >
                        {isAccepting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Aceitar e entrar</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 2. Manual Invite Code or Link Input */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wider">
                {pendingInvites.length > 0 ? "Ou introduz outro código ou link" : "Introduzir código ou link de convite"}
              </span>

              <form onSubmit={handleCheckInvite} className="flex gap-2">
                <Input
                  placeholder="https://companybrain.com/invite/... ou código"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!inviteInput.trim() || isCheckingToken}
                  className="gap-1.5 shrink-0"
                >
                  {isCheckingToken ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  <span>Verificar</span>
                </Button>
              </form>
            </div>

            {/* Preview Card */}
            {invitePreview && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F5F5]">
                      {invitePreview.organizationName}
                    </h3>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">
                      Convidado como <span className="text-zinc-200 capitalize font-medium">{invitePreview.role}</span>
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      invitePreview.isExpired || invitePreview.status !== "pending"
                        ? "border-red-500/30 text-red-400 bg-red-500/10"
                        : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    }
                  >
                    {invitePreview.isExpired ? "Expirado" : invitePreview.status}
                  </Badge>
                </div>

                {!invitePreview.emailMatchesUser ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1">
                    <p className="font-semibold">Email de destino não coincide</p>
                    <p className="text-amber-200/80 leading-relaxed">
                      Este convite foi emitido para <strong>{invitePreview.invitedEmail}</strong>, mas tens sessão iniciada com{" "}
                      <strong>{invitePreview.currentUserEmail || "outra conta"}</strong>. Para aceitar, inicia sessão com o email do convite.
                    </p>
                  </div>
                ) : invitePreview.isExpired || invitePreview.status !== "pending" ? (
                  <p className="text-xs text-red-400">
                    Este convite já não é válido ou já foi utilizado. Solicita um novo convite ao administrador.
                  </p>
                ) : (
                  <Button
                    type="button"
                    disabled={isAccepting}
                    onClick={handleAcceptPreviewInvite}
                    className="w-full gap-2 font-semibold"
                  >
                    {isAccepting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Aceitar e entrar no workspace</span>
                  </Button>
                )}
              </div>
            )}

            {/* Return to Create Company */}
            <div className="pt-4 border-t border-[#27272A] text-center">
              <button
                type="button"
                onClick={() => {
                  setMode("create");
                  setError(null);
                }}
                className="text-xs text-[#A1A1AA] hover:text-[#F5F5F5] transition-colors"
              >
                ← Voltar para criar nova empresa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
