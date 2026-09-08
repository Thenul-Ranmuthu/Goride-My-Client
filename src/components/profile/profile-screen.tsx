"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mail,
  Phone,
  PhoneCall,
  Plus,
  Trash2,
  User as UserIcon,
  UserX,
} from "lucide-react";
import type { EmergencyContact, NotificationPreferences, User } from "@/types";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import { logout } from "@/lib/auth/actions";
import { useAuthStore } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  RatingInline,
  SectionTitle,
  Skeleton,
  TopBar,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Input, Toggle } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { updatePhoneNumber } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Edit profile — FR-AUTH-04 / FR-DRV-01                                */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+94|0)?\s?7?\d[\d ]{7,9}$/,
      "Enter a valid Sri Lankan phone number",
    ),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileScreen({
  user,
  tone = "rider",
  title = "Edit profile",
  allowDeactivate = true,
  phoneOnly = false,
  children,
}: {
  user: User;
  tone?: "rider" | "driver" | "admin";
  title?: string;
  allowDeactivate?: boolean;
  phoneOnly?: boolean;
  children?: React.ReactNode;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const [deactivate, setDeactivate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone ?? "" },
  });

  const onSubmit = async (v: ProfileValues) => {
    try {
      if (phoneOnly) {
        const updatedPhone = await updatePhoneNumber(v.phone);
        const updated = { ...user, phone: updatedPhone };
        setUser(updated);
        reset({ name: updated.name, phone: updated.phone ?? "" });
      } else {
        const updated = await identity.update(user.id, {
          name: v.name,
          phone: v.phone,
        });
        setUser(updated);
        reset({ name: updated.name, phone: updated.phone ?? "" });
      }
      toast.success("Profile updated", "Your details have been saved.");
    } catch (e) {
      toast.error("Update failed", errorMessage(e));
    }
  };

  const avatarTone =
    tone === "driver"
      ? "bg-driver-500 text-white"
      : tone === "admin"
        ? "bg-navy-900 text-white"
        : undefined;

  return (
    <div className="flex flex-col">
      <TopBar back={ROUTES.dashboard} title={title} className="rounded-t-xl" />
      <div className="mx-auto w-full max-w-[560px] px-4 pb-10">
        <div className="flex flex-col items-center py-4 text-center">
          <Avatar
            name={user.name}
            src={user.profilePhotoUrl}
            size="xl"
            tone={avatarTone}
          />
          <h2 className="mt-3 text-lg font-semibold">{user.name}</h2>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <RatingInline value={user.rating} count={user.ratingCount} />
            <Badge tone={user.emailVerified ? "success" : "warning"}>
              {user.emailVerified ? "Email verified" : "Email unverified"}
            </Badge>
            <Badge
              tone={
                tone === "driver"
                  ? "driver"
                  : tone === "admin"
                    ? "ink"
                    : "brand"
              }
            >
              {user.role}
            </Badge>
          </div>
          <p className="mt-2 inline-flex max-w-full items-center gap-1.5 text-xs text-muted">
            <Phone size={14} className="shrink-0" />
            <span className="truncate">
              {user.phone ?? "No phone number configured"}
            </span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <Input
            label="Email"
            type="email"
            value={user.email}
            disabled
            leftIcon={<Mail size={17} />}
            hint="Managed by GoRide ID — contact support to change it."
          />
          {!phoneOnly && (
            <Input
              label="Full name"
              leftIcon={<UserIcon size={17} />}
              error={errors.name?.message}
              {...register("name")}
            />
          )}
          <Input
            label="Mobile number"
            type="tel"
            placeholder="No phone number configured"
            leftIcon={<Phone size={17} />}
            error={errors.phone?.message}
            {...register("phone")}
          />
          <Button
            type="submit"
            className="mt-2"
            loading={isSubmitting}
            disabled={!isDirty}
          >
            Update profile
          </Button>
        </form>

        {children}

        {allowDeactivate && (
          <Card className="mt-6 border-red-100">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-danger">
                <UserX size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Deactivate account</p>
                <p className="text-xs text-muted">
                  Your account will be disabled and you&apos;ll be signed out.
                  Trip records are kept for audit.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  full={false}
                  className="mt-3 border-danger text-danger hover:bg-red-50"
                  onClick={() => setDeactivate(true)}
                >
                  Deactivate
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={deactivate}
        onClose={() => setDeactivate(false)}
        position="fixed"
        title="Deactivate your account?"
        description="You won't be able to sign in again unless an admin reactivates you."
        confirmLabel="Deactivate"
        destructive
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await identity.deactivate(user.id);
            logout();
            router.replace(ROUTES.home);
          } catch (e) {
            toast.error("Couldn't deactivate", errorMessage(e));
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Emergency contacts — FR-AUTH-05 (max 3)                              */
/* ------------------------------------------------------------------ */

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  relationship: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+94|0)?\s?7\d[\d ]{7,9}$/,
      "Enter a valid Sri Lankan mobile number",
    ),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
});
type ContactValues = z.infer<typeof contactSchema>;

export function EmergencyContactsSection({ user }: { user: User }) {
  const [contacts, setContacts] = React.useState<EmergencyContact[] | null>(
    null,
  );
  const [open, setOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<EmergencyContact | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", relationship: "", phone: "", email: "" },
  });

  React.useEffect(() => {
    identity
      .listEmergencyContacts(user.id)
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [user.id]);

  const add = async (v: ContactValues) => {
    try {
      const c = await identity.addEmergencyContact(user.id, {
        name: v.name,
        relationship: v.relationship || undefined,
        phone: v.phone,
        email: v.email || undefined,
      });
      setContacts((prev) => [...(prev ?? []), c]);
      setOpen(false);
      reset();
      toast.success(
        "Contact added",
        `${c.name} will be alerted if you trigger SOS.`,
      );
    } catch (e) {
      toast.error("Couldn't add contact", errorMessage(e));
    }
  };

  const full = (contacts?.length ?? 0) >= 3;

  return (
    <section className="mt-8">
      <SectionTitle>Emergency contacts</SectionTitle>
      <div className="rounded-xl bg-red-50 p-3 text-xs text-red-900">
        <p className="font-semibold">
          When you hold the SOS button during a trip
        </p>
        <p className="mt-0.5 font-normal">
          These contacts and our safety team receive your live location, driver
          and vehicle details immediately.
        </p>
      </div>

      {!contacts ? (
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={<PhoneCall size={22} />}
          title="No emergency contacts yet"
          description="Add someone you trust so they're notified automatically in an emergency."
          compact
        />
      ) : (
        <ul className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {contacts.map((c) => (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="flex items-center gap-3 py-3">
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {c.name}{" "}
                      {c.relationship && (
                        <span className="font-normal text-muted">
                          · {c.relationship}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${c.name}`}
                    onClick={() => setRemoving(c)}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </Card>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {open ? (
        <Card className="mt-3">
          <form
            onSubmit={handleSubmit(add)}
            className="flex flex-col gap-3"
            noValidate
          >
            <p className="text-sm font-semibold">Add emergency contact</p>
            <Input
              label="Name"
              placeholder="Sunil Perera"
              error={errors.name?.message}
              {...register("name")}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Relationship"
                placeholder="Father"
                error={errors.relationship?.message}
                {...register("relationship")}
              />
              <Input
                label="Mobile"
                type="tel"
                placeholder="07X XXX XXXX"
                error={errors.phone?.message}
                {...register("phone")}
              />
            </div>
            <Input
              label="Email (optional)"
              type="email"
              placeholder="name@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Save contact
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button
          className="mt-3"
          variant={full ? "secondary" : "primary"}
          disabled={full}
          leftIcon={<Plus size={18} />}
          onClick={() => setOpen(true)}
        >
          {full ? "Maximum of 3 contacts reached" : "Add contact"}
        </Button>
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        position="fixed"
        title={`Remove ${removing?.name}?`}
        description="They will no longer be alerted when you trigger SOS."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          await identity.removeEmergencyContact(user.id, removing.id);
          setContacts(
            (prev) => prev?.filter((c) => c.id !== removing.id) ?? prev,
          );
          setRemoving(null);
        }}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Notification preferences — FR-AUTH-07                                */
/* ------------------------------------------------------------------ */

export function NotificationPrefsSection({ user }: { user: User }) {
  const [prefs, setPrefs] = React.useState<NotificationPreferences | null>(
    null,
  );

  React.useEffect(() => {
    identity
      .getNotificationPreferences(user.id)
      .then(setPrefs)
      .catch(() => {});
  }, [user.id]);

  const update = async (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      setPrefs(await identity.updateNotificationPreferences(user.id, patch));
    } catch (e) {
      setPrefs(previous);
      toast.error("Couldn't save", errorMessage(e));
    }
  };

  return (
    <section className="mt-8">
      <SectionTitle>Notifications</SectionTitle>
      {!prefs ? (
        <Skeleton className="h-40" />
      ) : (
        <Card className="divide-y divide-zinc-100 p-0">
          <div className="p-4">
            <Toggle
              checked={prefs.pushEnabled}
              onChange={(v) => update({ pushEnabled: v })}
              label="Push notifications"
              description="Driver accepted, arrived, trip completed, payment received"
            />
          </div>
          <div className="p-4">
            <Toggle
              checked={prefs.emailEnabled}
              onChange={(v) => update({ emailEnabled: v })}
              label="Email"
              description="Receipts and account security messages"
            />
          </div>
          <div className="p-4">
            <Toggle
              checked={prefs.smsEnabled}
              onChange={(v) => update({ smsEnabled: v })}
              label="SMS"
              description="Critical alerts only (carrier charges may apply)"
            />
          </div>
        </Card>
      )}
      <p className="mt-3 text-[11px] text-muted">
        SOS alerts to admin and your emergency contacts are always delivered
        regardless of these settings.
      </p>
    </section>
  );
}
