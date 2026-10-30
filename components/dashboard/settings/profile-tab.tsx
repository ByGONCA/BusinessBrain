"use client";

import * as React from "react";
import {
  User,
  Mail,
  Calendar,
  Globe,
  Clock,
  Check,
  X,
  Loader2,
  Camera,
  Pencil,
  Trash2,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import { updateUserProfileInfoAction, getUserProfileAction } from "@/lib/settings/actions";
import { useLanguage, SUPPORTED_LOCALES, Locale } from "@/lib/i18n";
import { optimizeAvatarImage } from "@/lib/utils/avatar-optimizer";

interface ProfileTabProps {
  user: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
      avatar_url?: string;
      [key: string]: unknown;
    };
  };
  onProfileUpdated?: (updated: { fullName?: string; avatarUrl?: string }) => void;
}

const POPULAR_TIMEZONES = [
  { value: "Europe/Lisbon", label: "Europe/Lisbon (WET / WEST) - Default" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "Europe/London", label: "Europe/London (GMT / BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET / CEST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET / CEST)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CET / CEST)" },
  { value: "America/New_York", label: "America/New York (Eastern Time)" },
  { value: "America/Chicago", label: "America/Chicago (Central Time)" },
  { value: "America/Denver", label: "America/Denver (Mountain Time)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (Pacific Time)" },
  { value: "America/Sao_Paulo", label: "America/São Paulo (BRT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST / AEDT)" },
];

export function ProfileTab({ user, onProfileUpdated }: ProfileTabProps) {
  const { locale, setLocale } = useLanguage();

  // Core Identity State
  const initialName =
    user.user_metadata?.full_name || user.user_metadata?.name || "";
  const initialAvatar = user.user_metadata?.avatar_url || "";

  const [fullName, setFullName] = React.useState(initialName);
  const [avatarUrl, setAvatarUrl] = React.useState(initialAvatar);
  const [dateFormat, setDateFormat] = React.useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = React.useState("24h");
  const [timezone, setTimezone] = React.useState("Europe/Lisbon");
  const [firstDayOfWeek, setFirstDayOfWeek] = React.useState<"monday" | "sunday">("monday");

  // Inline Editing & Card Interaction States
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editingNameValue, setEditingNameValue] = React.useState(initialName);
  const [isHoveringAvatar, setIsHoveringAvatar] = React.useState(false);
  const [isDraggingOverAvatar, setIsDraggingOverAvatar] = React.useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = React.useState(false);
  const [isSavingCard, setIsSavingCard] = React.useState(false);
  const [cardFeedback, setCardFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [showUrlFallback, setShowUrlFallback] = React.useState(false);
  const [customUrlInput, setCustomUrlInput] = React.useState("");

  // Regional Form State
  const [isSavingRegional, setIsSavingRegional] = React.useState(false);
  const [regionalStatusMessage, setRegionalStatusMessage] = React.useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);

  // Sync editing name input when fullName changes
  React.useEffect(() => {
    setEditingNameValue(fullName);
  }, [fullName]);

  // Focus name input when edit mode starts
  React.useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Load existing profile details from database
  React.useEffect(() => {
    let mounted = true;
    getUserProfileAction().then((res) => {
      if (!mounted) return;
      if (res.success && res.profile) {
        const p = res.profile;
        if (p.full_name) {
          setFullName(p.full_name as string);
          setEditingNameValue(p.full_name as string);
        }
        if (p.avatar_url) {
          setAvatarUrl(p.avatar_url as string);
        }
        if (p.date_format) setDateFormat(p.date_format as string);
        if (p.time_format) setTimeFormat(p.time_format as string);
        if (p.timezone) setTimezone(p.timezone as string);
        if (p.first_day_of_week) setFirstDayOfWeek(p.first_day_of_week as "monday" | "sunday");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Quick feedback timer helper
  const flashCardFeedback = (type: "success" | "error", message: string) => {
    setCardFeedback({ type, message });
    setTimeout(() => {
      setCardFeedback((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // 1. Direct Avatar Upload & Client-Side Compression Handler
  const handleAvatarFileSelected = async (file: File) => {
    if (!file) return;
    setIsProcessingAvatar(true);
    setIsSavingCard(true);

    try {
      // Compress and optimize image to square 256x256 WebP (~10-25 KB)
      const compressedDataUrl = await optimizeAvatarImage(file, 256, 0.82);

      // Optimistic preview update
      setAvatarUrl(compressedDataUrl);

      // Persist to database & Supabase Auth metadata
      const res = await updateUserProfileInfoAction({
        avatarUrl: compressedDataUrl,
      });

      if (res.success) {
        flashCardFeedback("success", "Foto de perfil atualizada");
        onProfileUpdated?.({ avatarUrl: compressedDataUrl });
      } else {
        setAvatarUrl(initialAvatar);
        flashCardFeedback("error", res.error || "Erro ao salvar nova foto");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar imagem";
      flashCardFeedback("error", msg);
    } finally {
      setIsProcessingAvatar(false);
      setIsSavingCard(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 2. Remove / Reset Profile Photo
  const handleRemoveAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSavingCard) return;

    setIsSavingCard(true);
    const previousAvatar = avatarUrl;
    setAvatarUrl("");

    try {
      const res = await updateUserProfileInfoAction({
        avatarUrl: "",
      });

      if (res.success) {
        flashCardFeedback("success", "Foto removida com sucesso");
        onProfileUpdated?.({ avatarUrl: "" });
      } else {
        setAvatarUrl(previousAvatar);
        flashCardFeedback("error", res.error || "Erro ao remover foto");
      }
    } catch {
      setAvatarUrl(previousAvatar);
      flashCardFeedback("error", "Erro ao remover foto");
    } finally {
      setIsSavingCard(false);
    }
  };

  // 3. Save Custom Image URL (optional secondary fallback)
  const handleApplyCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customUrlInput.trim();
    if (!trimmed) return;

    setIsSavingCard(true);
    const previousAvatar = avatarUrl;
    setAvatarUrl(trimmed);

    try {
      const res = await updateUserProfileInfoAction({
        avatarUrl: trimmed,
      });

      if (res.success) {
        flashCardFeedback("success", "Foto atualizada");
        onProfileUpdated?.({ avatarUrl: trimmed });
        setShowUrlFallback(false);
        setCustomUrlInput("");
      } else {
        setAvatarUrl(previousAvatar);
        flashCardFeedback("error", res.error || "Erro ao atualizar URL");
      }
    } catch {
      setAvatarUrl(previousAvatar);
      flashCardFeedback("error", "Erro ao atualizar URL");
    } finally {
      setIsSavingCard(false);
    }
  };

  // 4. Save Full Name Inline
  const handleSaveNameInline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = editingNameValue.trim();

    if (!trimmed) {
      setEditingNameValue(fullName);
      setIsEditingName(false);
      return;
    }

    if (trimmed === fullName) {
      setIsEditingName(false);
      return;
    }

    setIsSavingCard(true);
    const previousName = fullName;
    setFullName(trimmed);
    setIsEditingName(false);

    try {
      const res = await updateUserProfileInfoAction({
        fullName: trimmed,
      });

      if (res.success) {
        flashCardFeedback("success", "Nome atualizado com sucesso");
        onProfileUpdated?.({ fullName: trimmed });
      } else {
        setFullName(previousName);
        setEditingNameValue(previousName);
        flashCardFeedback("error", res.error || "Erro ao atualizar nome");
      }
    } catch {
      setFullName(previousName);
      setEditingNameValue(previousName);
      flashCardFeedback("error", "Erro ao atualizar nome");
    } finally {
      setIsSavingCard(false);
    }
  };

  // 5. Save Regional & Contact Preferences
  const handleSaveRegional = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRegional(true);
    setRegionalStatusMessage(null);
    try {
      const res = await updateUserProfileInfoAction({
        dateFormat,
        timeFormat,
        timezone,
        firstDayOfWeek,
        language: locale,
      });

      if (res.success) {
        setRegionalStatusMessage({
          success: true,
          message: "Preferências salvas com sucesso.",
        });
        try {
          localStorage.setItem("cb_timezone", timezone);
          localStorage.setItem("cb_first_day_of_week", firstDayOfWeek);
        } catch {}
        setTimeout(() => setRegionalStatusMessage(null), 3500);
      } else {
        setRegionalStatusMessage({
          success: false,
          message: res.error || "Falha ao atualizar preferências.",
        });
      }
    } finally {
      setIsSavingRegional(false);
    }
  };

  const accountCreated = user.created_at
    ? new Date(user.created_at).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  const userInitial = (fullName || user.email || "U").charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
          {locale === "pt" ? "Perfil de Conta" : "Account Profile"}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {locale === "pt"
            ? "Clica diretamente no nome ou na foto para editar o teu perfil instantaneamente."
            : "Click directly on your name or photo to update your profile instantly."}
        </p>
      </div>

      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAvatarFileSelected(file);
        }}
      />

      {/* HERO PROFILE CARD (Directly Editable & Interactive) */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 via-white to-zinc-100/60 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950/80 p-5 shadow-xs transition-all">
        {/* Ambient glow accent */}
        <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-2xl pointer-events-none" />

        {/* Live Status Feedback in Card */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
          {isSavingCard && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 px-2.5 py-0.5 rounded-md animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{isProcessingAvatar ? (locale === "pt" ? "A otimizar imagem..." : "Optimizing...") : (locale === "pt" ? "A guardar..." : "Saving...")}</span>
            </span>
          )}

          {!isSavingCard && cardFeedback && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-md transition-all ${
                cardFeedback.type === "success"
                  ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60"
                  : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60"
              }`}
            >
              {cardFeedback.type === "success" ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              <span>{cardFeedback.message}</span>
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
          {/* INTERACTIVE AVATAR */}
          <div
            className="relative group shrink-0 select-none cursor-pointer"
            onClick={() => !isProcessingAvatar && fileInputRef.current?.click()}
            onMouseEnter={() => setIsHoveringAvatar(true)}
            onMouseLeave={() => setIsHoveringAvatar(false)}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOverAvatar(true);
            }}
            onDragLeave={() => setIsDraggingOverAvatar(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOverAvatar(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleAvatarFileSelected(file);
            }}
            title={locale === "pt" ? "Clica para alterar a foto de perfil" : "Click to change profile photo"}
          >
            {/* Avatar Frame */}
            <div
              className={`relative h-20 w-20 rounded-2xl overflow-hidden border-2 transition-all duration-200 shadow-sm ${
                isDraggingOverAvatar
                  ? "border-blue-500 scale-105 ring-4 ring-blue-500/20"
                  : isHoveringAvatar
                  ? "border-blue-500/80 ring-2 ring-blue-500/10"
                  : "border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || "User"}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 text-2xl font-bold text-white tracking-wider">
                  {userInitial}
                </div>
              )}

              {/* Hover / Drag Overlay */}
              <div
                className={`absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-white transition-opacity duration-200 ${
                  isHoveringAvatar || isDraggingOverAvatar || isProcessingAvatar
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              >
                {isProcessingAvatar ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <>
                    <Camera className="h-5 w-5 mb-0.5" />
                    <span className="text-[10px] font-semibold tracking-tight">
                      {locale === "pt" ? "Alterar" : "Change"}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Action Badge (Camera / Edit indicator) */}
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm ring-2 ring-white dark:ring-zinc-900 group-hover:bg-blue-500 group-hover:scale-110 transition-transform">
              <Camera className="h-3 w-3" />
            </div>
          </div>

          {/* IDENTITY DETAILS & INLINE NAME EDIT */}
          <div className="flex-1 min-w-0 space-y-1.5 w-full">
            {/* Inline Name Editing Row */}
            {isEditingName ? (
              <form onSubmit={handleSaveNameInline} className="flex items-center gap-1.5 max-w-sm">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editingNameValue}
                  onChange={(e) => setEditingNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsEditingName(false);
                      setEditingNameValue(fullName);
                    }
                  }}
                  onBlur={() => {
                    if (editingNameValue.trim() && editingNameValue.trim() !== fullName) {
                      handleSaveNameInline();
                    } else {
                      setIsEditingName(false);
                      setEditingNameValue(fullName);
                    }
                  }}
                  maxLength={100}
                  placeholder={locale === "pt" ? "O teu nome completo..." : "Your full name..."}
                  className="w-full rounded-lg border border-blue-500 bg-white dark:bg-zinc-950 px-2.5 py-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 shadow-xs transition-colors"
                />
                <button
                  type="submit"
                  className="shrink-0 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer"
                  title={locale === "pt" ? "Guardar nome (Enter)" : "Save name (Enter)"}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setEditingNameValue(fullName);
                  }}
                  className="shrink-0 p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
                  title={locale === "pt" ? "Cancelar (Esc)" : "Cancel (Esc)"}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="group inline-flex items-center gap-2 text-left rounded-lg py-0.5 px-1.5 -ml-1.5 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  title={locale === "pt" ? "Clica para editar o nome" : "Click to edit full name"}
                >
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate max-w-[280px]">
                    {fullName || (locale === "pt" ? "Definir Nome" : "Set Name")}
                  </h3>
                  <Pencil className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors opacity-75 group-hover:opacity-100 shrink-0" />
                </button>
              </div>
            )}

            {/* Email Address */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[280px]">
                {user.email || "—"}
              </span>
            </div>

            {/* Meta Row (Member since & Photo actions) */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 pt-0.5">
              <span className="inline-flex items-center gap-1 text-zinc-400 font-mono">
                <Calendar className="h-3 w-3" />
                <span>
                  {locale === "pt" ? "Membro desde" : "Member since"} {accountCreated}
                </span>
              </span>

              {/* Photo Management Secondary Links */}
              {avatarUrl && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{locale === "pt" ? "Remover foto" : "Remove photo"}</span>
                  </button>
                </>
              )}

              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <button
                type="button"
                onClick={() => setShowUrlFallback(!showUrlFallback)}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <LinkIcon className="h-3 w-3" />
                <span>{locale === "pt" ? "Colar link" : "Paste link"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Direct Image URL Fallback */}
        {showUrlFallback && (
          <form
            onSubmit={handleApplyCustomUrl}
            className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center gap-2"
          >
            <input
              type="url"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isSavingCard || !customUrlInput.trim()}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {locale === "pt" ? "Aplicar" : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUrlFallback(false);
                setCustomUrlInput("");
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>

      {/* FORM: CONTACT & REGIONAL DEFAULTS */}
      <form onSubmit={handleSaveRegional} className="space-y-5">
        {/* Email Address */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {locale === "pt" ? "Endereço de Email da Conta" : "Account Email Address"}
            </label>
            <span className="text-[10px] text-zinc-400">
              {locale === "pt" ? "Alterar na aba Segurança" : "Change in Security tab"}
            </span>
          </div>
          <input
            type="email"
            value={user.email || ""}
            disabled
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 px-3 py-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 cursor-not-allowed select-none"
          />
        </div>

        {/* Regional & Localization Defaults */}
        <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {locale === "pt" ? "Preferências Regionais" : "Regional Defaults"}
          </span>

          {/* Language */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "pt" ? "Idioma da Interface" : "Display Language"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "pt" ? "Localização da plataforma" : "Application interface localization"}
              </p>
            </div>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.nativeLabel} ({loc.code.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Time Zone */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "pt" ? "Fuso Horário" : "Time Zone"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "pt"
                  ? "Utilizado para reuniões, calendário e prazos"
                  : "Used for meeting times, calendar, and task scheduling"}
              </p>
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs max-w-[220px]"
            >
              {POPULAR_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Format */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "pt" ? "Formato de Data" : "Date Format"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "pt"
                  ? "Formato de exibição de datas na workspace"
                  : "Display format for dates across the workspace"}
              </p>
            </div>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (Default)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            </select>
          </div>

          {/* Time Format */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "pt" ? "Formato de Hora" : "Time Format"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "pt" ? "Relógio de 12 horas ou 24 horas" : "12-hour or 24-hour clock"}
              </p>
            </div>
            <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 p-0.5 bg-zinc-100 dark:bg-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setTimeFormat("24h")}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  timeFormat === "24h"
                    ? "bg-white dark:bg-[#1a1a1d] text-zinc-900 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                24-Hour (14:30)
              </button>
              <button
                type="button"
                onClick={() => setTimeFormat("12h")}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  timeFormat === "12h"
                    ? "bg-white dark:bg-[#1a1a1d] text-zinc-900 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                12-Hour (2:30 PM)
              </button>
            </div>
          </div>

          {/* First Day of Week */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "pt" ? "Primeiro Dia da Semana" : "First Day of Week"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {locale === "pt"
                  ? "Coluna inicial em calendários e seletores de data"
                  : "Start column in calendars and datepickers"}
              </p>
            </div>
            <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 p-0.5 bg-zinc-100 dark:bg-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setFirstDayOfWeek("monday")}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  firstDayOfWeek === "monday"
                    ? "bg-white dark:bg-[#1a1a1d] text-zinc-900 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                {locale === "pt" ? "Segunda-feira" : "Monday (Default)"}
              </button>
              <button
                type="button"
                onClick={() => setFirstDayOfWeek("sunday")}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  firstDayOfWeek === "sunday"
                    ? "bg-white dark:bg-[#1a1a1d] text-zinc-900 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                {locale === "pt" ? "Domingo" : "Sunday"}
              </button>
            </div>
          </div>
        </div>

        {/* Submit Regional Settings Button */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            {regionalStatusMessage && (
              <span
                className={`flex items-center gap-1 font-medium ${
                  regionalStatusMessage.success
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500"
                }`}
              >
                {regionalStatusMessage.success && <Check className="h-3.5 w-3.5" />}
                {regionalStatusMessage.message}
              </span>
            )}
          </span>
          <button
            type="submit"
            disabled={isSavingRegional}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isSavingRegional ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{locale === "pt" ? "A guardar..." : "Saving..."}</span>
              </>
            ) : (
              <span>{locale === "pt" ? "Guardar Preferências" : "Save Preferences"}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
