"use client";

import * as React from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DriverProfile, User } from "@/types";
import { AppShell } from "@/components/layout/app-shell";
import {
  EmergencyContactsSection,
  ProfileScreen,
} from "@/components/profile/profile-screen";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import {
  identityLoginUrl,
  normalizeRole,
  ROUTES,
  VEHICLE_IMAGES,
  VEHICLE_TYPES,
} from "@/lib/constants";
import {
  Badge,
  Card,
  SectionTitle,
  Skeleton,
  type Tone,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Input, Toggle } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";
import {
  addDriverProfile,
  getDriverProfile,
  getMe,
  updateDriverProfile,
  type DriverVehiclePayload,
} from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/session";

/** Driver profile — FR-AUTH-04 / FR-DRV-01. */
export default function DriverProfilePage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<User | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    const sessionUser = useAuthStore.getState().session?.user;

    if (!sessionUser) {
      window.location.replace(identityLoginUrl(ROUTES.driver.profile));
      return;
    }

    getMe()
      .then((me) => {
        const currentUser =
          me ??
          (sessionUser
            ? {
                userId: sessionUser.id,
                name: sessionUser.name,
                email: sessionUser.email,
                phone: sessionUser.phone ?? null,
                roles: [sessionUser.role],
              }
            : null);

        const normalizedRoles = (currentUser?.roles ?? []).map((value) =>
          normalizeRole(value),
        );
        if (!currentUser || !normalizedRoles.includes("Driver")) {
          router.replace(ROUTES.dashboard);
          return;
        }

        setDriverId(currentUser.userId);
        setUser({
          id: currentUser.userId,
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone ?? null,
          role: "Driver",
          emailVerified: true,
          phoneVerified: false,
          rating: 5,
          ratingCount: 0,
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => setError("Unable to load your driver profile."))
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!user) return null;

  if (!driverId) return null;

  return <DriverProfilePageInner user={user} driverId={driverId} />;
}

function DriverProfilePageInner({
  user,
  driverId,
}: {
  user: User;
  driverId: string;
}) {
  return (
    <AppShell
      user={{
        role: "Driver",
        name: user.name,
        email: user.email,
      }}
      className="max-w-3xl px-0 sm:px-4"
    >
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-card">
        <ProfileScreen
          user={user}
          tone="driver"
          title="Driver profile"
          phoneOnly
        >
          <VehicleSection driverId={driverId} />
          <EmergencyContactsSection user={user} />
        </ProfileScreen>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Vehicle, licence & verification                                      */
/* ------------------------------------------------------------------ */

const vehicleSchema = z.object({
  vehicleMake: z.string().trim().min(2, "Required"),
  vehicleModel: z.string().trim().min(1, "Required"),
  vehiclePlate: z
    .string()
    .trim()
    .min(4, "Enter the registration number")
    .max(12),
  vehicleColor: z.string().optional(),
  vehicleTypeCode: z.enum(["BIKE", "TUK", "CAR", "XL"]),
  licenseNumber: z.string().trim().min(6, "Enter your licence number"),
  licenseExpiry: z
    .string()
    .refine(
      (v) => !!v && new Date(v) > new Date(),
      "Licence must be valid (future date)",
    ),
});
type VehicleValues = z.infer<typeof vehicleSchema>;

const STATUS_TONE: Record<DriverProfile["status"], Tone> = {
  PendingVerification: "warning",
  DocumentReview: "info",
  Active: "success",
  Rejected: "danger",
  Suspended: "danger",
  Deactivated: "neutral",
  Offline: "neutral",
};

function VehicleSection({ driverId }: { driverId: string }) {
  const [profile, setProfile] = React.useState<
    DriverProfile | null | undefined
  >(undefined);

  React.useEffect(() => {
    getDriverProfile(driverId)
      .then((p) => {
        setProfile(p);
      })
      .catch(() => setProfile(null));
  }, [driverId]);

  const toggleOnline = async (online: boolean) => {
    if (!profile) return;
    const previous = profile;
    setProfile({ ...profile, online });
    try {
      setProfile(await identity.updateDriverProfile(driverId, { online }));
    } catch (e) {
      setProfile(previous);
      toast.error("Couldn't change availability", errorMessage(e));
    }
  };

  if (profile === undefined) return <Skeleton className="mt-8 h-64" />;

  if (profile === null)
    return (
      <section className="mt-8">
        <SectionTitle>Vehicle & licence</SectionTitle>
        <VehicleForm
          submitLabel="Register vehicle"
          onSave={async (values) => {
            const saved = await addDriverProfile(values);
            setProfile({ ...saved, driverId });
            return saved;
          }}
        />
      </section>
    );

  return (
    <>
      <section className="mt-8">
        <SectionTitle>Verification</SectionTitle>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Account status</p>
              <p className="text-xs text-muted">
                {profile.verifiedAt
                  ? `Documents approved on ${formatDate(profile.verifiedAt)}`
                  : "An admin reviews your documents before you can go online."}
              </p>
            </div>
            <Badge
              tone={STATUS_TONE[profile.status ?? "PendingVerification"]}
              dot
            >
              {String(profile.status ?? "PendingVerification")
                .replace(/([A-Z])/g, " $1")
                .trim()}
            </Badge>
          </div>
          <div className="border-t border-zinc-100 pt-3">
            <Toggle
              checked={profile.online}
              onChange={toggleOnline}
              disabled={profile.status !== "Active"}
              tone="driver"
              label="Available for trips"
              description={
                profile.status === "Active"
                  ? "Riders can be matched to you while this is on"
                  : "You can go online once your documents are approved"
              }
            />
          </div>
        </Card>
      </section>

      <section className="mt-8">
        <SectionTitle>Vehicle & licence</SectionTitle>
        <VehicleForm
          profile={profile}
          submitLabel="Save vehicle details"
          onSave={async (values) => {
            const saved = await updateDriverProfile(driverId, values);
            setProfile({ ...saved, driverId });
            return saved;
          }}
        />
      </section>
    </>
  );
}

function VehicleForm({
  profile,
  submitLabel,
  onSave,
}: {
  profile?: DriverProfile;
  submitLabel: string;
  onSave: (values: DriverVehiclePayload) => Promise<DriverProfile>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<VehicleValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: profile
      ? {
          vehicleMake: profile.vehicleMake,
          vehicleModel: profile.vehicleModel,
          vehiclePlate: profile.vehiclePlate,
          vehicleColor: profile.vehicleColor ?? "",
          vehicleTypeCode: profile.vehicleTypeCode,
          licenseNumber: profile.licenseNumber,
          licenseExpiry: profile.licenseExpiry,
        }
      : { vehicleTypeCode: "CAR" },
  });

  const onSubmit = async (values: VehicleValues) => {
    try {
      const vehiclePayload: DriverVehiclePayload = {
        vehicleMake: values.vehicleMake,
        vehicleModel: values.vehicleModel,
        vehiclePlate: values.vehiclePlate.toUpperCase(),
        vehicleTypeCode: values.vehicleTypeCode,
        licenseNumber: values.licenseNumber,
        licenseExpiry: values.licenseExpiry,
      };
      const saved = await onSave(vehiclePayload);
      reset({ ...values, vehiclePlate: saved.vehiclePlate });
      toast.success(
        profile ? "Vehicle updated" : "Vehicle registered",
        "Your vehicle and licence details have been saved.",
      );
    } catch (error) {
      toast.error("Update failed", errorMessage(error));
    }
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const selected = watch("vehicleTypeCode");

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <p className="mb-2 text-[13px] font-semibold">Vehicle type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VEHICLE_TYPES.map((vehicleType) => (
            <button
              key={vehicleType.code}
              type="button"
              onClick={() =>
                setValue("vehicleTypeCode", vehicleType.code, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border-2 bg-surface-2 p-2 transition",
                selected === vehicleType.code
                  ? "border-ink bg-white"
                  : "border-transparent hover:border-zinc-300",
              )}
            >
              <Image
                src={VEHICLE_IMAGES[vehicleType.code]}
                alt={vehicleType.name}
                width={64}
                height={40}
                className="h-9 w-auto object-contain mix-blend-multiply"
              />
              <span className="text-[11px] font-semibold">
                {vehicleType.name}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Make"
          error={errors.vehicleMake?.message}
          {...register("vehicleMake")}
        />
        <Input
          label="Model"
          error={errors.vehicleModel?.message}
          {...register("vehicleModel")}
        />
      </div>
      <Input
        label="Registration no."
        className="uppercase"
        error={errors.vehiclePlate?.message}
        {...register("vehiclePlate")}
      />
      <Input
        label="Driving licence no."
        error={errors.licenseNumber?.message}
        {...register("licenseNumber")}
      />
      <Input
        label="Licence expiry"
        type="date"
        error={errors.licenseExpiry?.message}
        {...register("licenseExpiry")}
      />
      <Button
        type="submit"
        variant="driver"
        loading={isSubmitting}
        disabled={profile ? !isDirty : false}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
