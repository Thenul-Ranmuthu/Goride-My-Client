"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  Check,
  MapPin,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatTile } from "@/components/ui/primitives";
import {
  ROUTES,
  identityLoginUrl,
  normalizeRole,
  profileForRole,
} from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AdminDriverActivity,
  AdminAuditLog,
  getAdminActivity,
  getAdminAuditLogs,
  getInternalUser,
  getMe,
  InternalUser,
  MeResponse,
  updateAdminDriverStatus,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth/session";
import { DashboardHistoryGuard } from "@/components/auth/dashboard-history-guard";

const DRIVER_STATUS_LABELS = [
  "PendingVerification",
  "DocumentReview",
  "Rejected",
  "Suspended",
  "Deactivated",
  "Active",
  "Offline",
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    getMe()
      .then((me) => {
        if (!me) {
          window.location.replace(identityLoginUrl("/dashboard"));
          return;
        }
        if (me.roles.length === 0) {
          router.push("/onboarding/select-role");
          return;
        }
        setUser(me);
      })
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <p>Loading...</p>;
  if (!user) return null;

  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: MeResponse }) {
  const role = user.roles.map(normalizeRole).find(Boolean) ?? "Rider";

  const stats = [
    { label: "Trips taken", value: "—", sub: "Across all vehicle types" },
    { label: "Rating", value: "—", sub: "—" },
    { label: "Member since", value: "—", sub: "Thanks for riding" },
  ];

  return (
    <>
      <DashboardHistoryGuard />
      <AppShell
        user={{
          role,
          name: user.name,
          email: user.email,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="text-2xl font-bold tracking-tight">
            Hi, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-muted">
            You&apos;re signed in as a{" "}
            <span className="font-semibold text-ink">{role}</span>.
          </p>
        </motion.div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s, i) => (
            <StatTile
              key={s.label}
              label={s.label}
              value={s.value}
              sub={s.sub}
              tone={i === 0 ? "dark" : "light"}
            />
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {role === "Rider" && <RiderDashboardLink />}
          <ProfileDashboardLink role={role} />
        </div>
        {role === "Admin" && <AdminDriversTab />}
      </AppShell>
    </>
  );
}

function RiderDashboardLink() {
  return (
    <Link
      href={ROUTES.rider.home}
      className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-card transition hover:border-ink"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
        <MapPin size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Book a ride</span>
        <span className="block text-xs text-muted">
          Pick a start and destination — see vehicle types and the calculated
          fare.
        </span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-zinc-400" />
    </Link>
  );
}

function ProfileDashboardLink({
  role,
}: {
  role: ReturnType<typeof normalizeRole>;
}) {
  return (
    <Link
      href={profileForRole(role)}
      className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-card transition hover:border-ink"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-950 text-brand-300">
        <UserRound size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Your profile</span>
        <span className="block text-xs text-muted">
          View and manage your account details.
        </span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-zinc-400" />
    </Link>
  );
}

function AdminDriversTab() {
  const [activeTab, setActiveTab] = useState<"drivers" | "audit">("drivers");
  const [drivers, setDrivers] = useState<AdminDriverActivity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [selected, setSelected] = useState<AdminDriverActivity | null>(null);
  const [driverUser, setDriverUser] = useState<InternalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [auditPage, setAuditPage] = useState(1);

  useEffect(() => {
    getAdminActivity()
      .then((items) => setDrivers(items))
      .catch(() => setError("Unable to load drivers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "audit" || auditLoaded) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuditLoading(true);
    getAdminAuditLogs()
      .then((items) => {
        setAuditLogs(items);
        setAuditLoaded(true);
      })
      .catch(() => setError("Unable to load audit logs."))
      .finally(() => setAuditLoading(false));
  }, [activeTab, auditLoaded]);

  const selectDriver = (driver: AdminDriverActivity) => {
    setSelected(driver);
    setDriverUser(null);
    setDetailLoading(true);
    getInternalUser(driver.driverId)
      .then(setDriverUser)
      .catch(() => setError("Unable to load the selected driver details."))
      .finally(() => setDetailLoading(false));
  };

  const updateStatus = async (statusNum: number) => {
    if (!selected || statusNum === selected.status) return;

    setStatusUpdating(true);
    setError(null);
    try {
      await updateAdminDriverStatus(selected.driverId, statusNum);
      setDrivers((current) =>
        current.map((driver) =>
          driver.driverId === selected.driverId
            ? { ...driver, status: statusNum }
            : driver,
        ),
      );
      setSelected((current) =>
        current ? { ...current, status: statusNum } : current,
      );
    } catch {
      setError("Unable to update the driver status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-5 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          className={`border-b-2 px-1 pb-3 text-sm font-semibold ${activeTab === "drivers" ? "border-brand-500 text-ink" : "border-transparent text-muted"}`}
        >
          Drivers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`border-b-2 px-1 pb-3 text-sm font-semibold ${activeTab === "audit" ? "border-brand-500 text-ink" : "border-transparent text-muted"}`}
        >
          Audit logs
        </button>
      </div>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {activeTab === "audit" ? (
        <AdminAuditLogs
          logs={auditLogs}
          loading={auditLoading}
          page={auditPage}
          onPageChange={setAuditPage}
        />
      ) : loading ? (
        <p className="text-sm text-muted">Loading drivers...</p>
      ) : drivers.length === 0 ? (
        <p className="text-sm text-muted">No drivers found.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)]">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-card">
            {drivers.map((driver) => (
              <button
                key={driver.driverId}
                type="button"
                onClick={() => selectDriver(driver)}
                className={`flex w-full items-center gap-3 border-b border-zinc-100 p-4 text-left transition last:border-0 hover:bg-zinc-50 ${selected?.driverId === driver.driverId ? "bg-brand-50" : ""}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-950 text-brand-300">
                  <CarFront size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {driver.vehicleMake} {driver.vehicleModel}
                  </span>
                  <span className="block text-xs text-muted">
                    {driver.vehiclePlate} · {driver.vehicleTypeCode}
                  </span>
                </span>
                {selected?.driverId === driver.driverId && (
                  <Check size={17} className="text-brand-600" />
                )}
              </button>
            ))}
          </div>
          <DriverDetails
            driver={selected}
            user={driverUser}
            loading={detailLoading}
            statusUpdating={statusUpdating}
            onStatusChange={updateStatus}
          />
        </div>
      )}
    </section>
  );
}

function AdminAuditLogs({
  logs,
  loading,
  page,
  onPageChange,
}: {
  logs: AdminAuditLog[];
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(logs.length / pageSize));
  const visibleLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  if (loading)
    return <p className="text-sm text-muted">Loading audit logs...</p>;
  if (logs.length === 0)
    return <p className="text-sm text-muted">No audit logs found.</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Actor ID</th>
              <th className="px-4 py-3 font-semibold">Target ID</th>
              <th className="px-4 py-3 font-semibold">Timestamp (UTC)</th>
              <th className="px-4 py-3 font-semibold">Log ID</th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-zinc-100 last:border-0"
              >
                <td className="px-4 py-3 font-semibold text-ink">
                  {DRIVER_STATUS_LABELS[log.action] ?? "Unknown action"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {log.actorId}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {log.targetId}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {formatAuditTimestamp(log.timeStampUtc)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {log.id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
        <p className="text-xs text-muted">
          Page {page} of {pageCount} · {logs.length} total logs
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Previous audit log page"
            className="rounded-lg border border-zinc-200 p-2 text-muted transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === pageCount}
            aria-label="Next audit log page"
            className="rounded-lg border border-zinc-200 p-2 text-muted transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatAuditTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function DriverDetails({
  driver,
  user,
  loading,
  statusUpdating,
  onStatusChange,
}: {
  driver: AdminDriverActivity | null;
  user: InternalUser | null;
  loading: boolean;
  statusUpdating: boolean;
  onStatusChange: (statusNum: number) => void;
}) {
  if (!driver)
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-muted">
        Select a driver to view details.
      </div>
    );
  const details = [
    ["Username", user?.username ?? (loading ? "Loading..." : "Unavailable")],
    ["Email", user?.email ?? "—"],
    ["Phone", user?.phone ?? "—"],
    ["Driver ID", driver.driverId],
    ["Vehicle", `${driver.vehicleMake} ${driver.vehicleModel}`],
    ["Plate", driver.vehiclePlate],
    ["Vehicle type", driver.vehicleTypeCode],
    ["License number", driver.licenseNumber],
    ["License expiry", driver.licenseExpiry],
    ["Status", DRIVER_STATUS_LABELS[driver.status] ?? "Unknown"],
    ["Verified at", driver.verifiedAt ?? "Not verified"],
    ["Created at", driver.createdAt],
    ["Updated at", driver.updatedAt],
  ];
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card">
      <h2 className="text-base font-bold">Driver details</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {label}
            </dt>
            <dd className="mt-0.5 break-words text-sm text-ink">{value}</dd>
          </div>
        ))}
        <div>
          <label
            htmlFor="driver-status"
            className="text-[11px] font-semibold uppercase tracking-wide text-muted"
          >
            Change status
          </label>
          <select
            id="driver-status"
            value={driver.status}
            disabled={statusUpdating}
            onChange={(event) => onStatusChange(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-zinc-100"
          >
            {DRIVER_STATUS_LABELS.map((label, statusNum) => (
              <option key={label} value={statusNum}>
                {statusNum} - {label}
              </option>
            ))}
          </select>
          {statusUpdating && (
            <p className="mt-1 text-xs text-muted">Updating status...</p>
          )}
        </div>
      </dl>
    </div>
  );
}
