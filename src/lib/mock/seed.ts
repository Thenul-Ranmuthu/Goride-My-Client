import type {
  AdminAction,
  AppNotification,
  Complaint,
  Driver,
  EmergencyContact,
  Payment,
  Place,
  SosAlert,
  Trip,
  User,
  VehicleType,
  VehicleTypeCode,
} from "@/types";
import { VEHICLE_IMAGES } from "@/lib/constants";
import { haversineKm, syntheticRoute } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Places (Greater Colombo)                                             */
/* ------------------------------------------------------------------ */

export const PLACES: Place[] = [
  { name: "Galle Face Green", address: "Galle Face Green, Colombo 03", lat: 6.9271, lng: 79.8448 },
  { name: "Colombo Fort Railway Station", address: "Olcott Mawatha, Colombo 11", lat: 6.9344, lng: 79.8501 },
  { name: "One Galle Face Mall", address: "1A Centre Rd, Colombo 02", lat: 6.9276, lng: 79.8457 },
  { name: "Independence Square", address: "Independence Ave, Colombo 07", lat: 6.9034, lng: 79.8683 },
  { name: "Viharamahadevi Park", address: "Ananda Coomaraswamy Mawatha, Colombo 07", lat: 6.9147, lng: 79.8614 },
  { name: "Colombo City Centre", address: "137 Sir James Pieris Mawatha, Colombo 02", lat: 6.9205, lng: 79.8518 },
  { name: "Majestic City", address: "Galle Rd, Bambalapitiya, Colombo 04", lat: 6.8942, lng: 79.8549 },
  { name: "Liberty Plaza", address: "R. A. De Mel Mawatha, Colombo 03", lat: 6.9115, lng: 79.8516 },
  { name: "Dutch Hospital Shopping Precinct", address: "Hospital St, Colombo 01", lat: 6.9331, lng: 79.8426 },
  { name: "Lotus Tower", address: "D. R. Wijewardena Mawatha, Colombo 10", lat: 6.9270, lng: 79.8573 },
  { name: "National Hospital of Sri Lanka", address: "Regent St, Colombo 08", lat: 6.9190, lng: 79.8680 },
  { name: "University of Colombo", address: "College House, Cumaratunga Munidasa Mawatha, Colombo 03", lat: 6.9020, lng: 79.8605 },
  { name: "Mount Lavinia Beach", address: "Hotel Rd, Mount Lavinia", lat: 6.8389, lng: 79.8620 },
  { name: "Dehiwala Zoo", address: "Anagarika Dharmapala Mawatha, Dehiwala", lat: 6.8565, lng: 79.8738 },
  { name: "Nugegoda Junction", address: "High Level Rd, Nugegoda", lat: 6.8649, lng: 79.8997 },
  { name: "Maharagama Bus Stand", address: "High Level Rd, Maharagama", lat: 6.8480, lng: 79.9265 },
  { name: "Rajagiriya", address: "Sri Jayawardenepura Kotte Rd, Rajagiriya", lat: 6.9095, lng: 79.8950 },
  { name: "Battaramulla", address: "Battaramulla Town", lat: 6.8993, lng: 79.9182 },
  { name: "SLIIT Malabe Campus", address: "New Kandy Rd, Malabe", lat: 6.9147, lng: 79.9729 },
  { name: "Kaduwela Town", address: "Kaduwela", lat: 6.9333, lng: 79.9833 },
  { name: "Kelaniya Temple", address: "Kelaniya Raja Maha Vihara, Kelaniya", lat: 6.9530, lng: 79.9220 },
  { name: "Wellawatte", address: "Galle Rd, Wellawatte, Colombo 06", lat: 6.8748, lng: 79.8600 },
  { name: "Bandaranaike International Airport", address: "Katunayake", lat: 7.1808, lng: 79.8841 },
  { name: "Kollupitiya Junction", address: "Galle Rd, Colombo 03", lat: 6.9108, lng: 79.8489 },
  { name: "Borella Junction", address: "Borella, Colombo 08", lat: 6.9147, lng: 79.8777 },
  { name: "Pettah Market", address: "Main St, Pettah, Colombo 11", lat: 6.9387, lng: 79.8543 },
  { name: "Havelock City", address: "Havelock Rd, Colombo 05", lat: 6.8870, lng: 79.8685 },
  { name: "Thalawathugoda", address: "Thalawathugoda", lat: 6.8776, lng: 79.9396 },
];

export function findPlace(name: string): Place {
  const p = PLACES.find((x) => x.name === name);
  if (!p) throw new Error(`Unknown seed place ${name}`);
  return p;
}

/* ------------------------------------------------------------------ */
/* Vehicle types (admin-editable rate table)                            */
/* ------------------------------------------------------------------ */

export const VEHICLE_TYPES: VehicleType[] = [
  { id: "vt_bike", code: "BIKE", name: "Bike", description: "Quick solo trips, beats traffic", capacity: 1, baseFare: 60, ratePerKm: 42, ratePerMin: 3, active: true, image: VEHICLE_IMAGES.BIKE },
  { id: "vt_tuk", code: "TUK", name: "Tuk", description: "Affordable three-wheeler rides", capacity: 3, baseFare: 80, ratePerKm: 62, ratePerMin: 4, active: true, image: VEHICLE_IMAGES.TUK },
  { id: "vt_car", code: "CAR", name: "Car", description: "Comfortable, air-conditioned", capacity: 4, baseFare: 150, ratePerKm: 98, ratePerMin: 6, active: true, image: VEHICLE_IMAGES.CAR },
  { id: "vt_xl", code: "XL", name: "XL Van", description: "Room for six plus luggage", capacity: 6, baseFare: 260, ratePerKm: 145, ratePerMin: 8, active: true, image: VEHICLE_IMAGES.XL },
];

/* ------------------------------------------------------------------ */
/* Users                                                                 */
/* ------------------------------------------------------------------ */

const now = Date.now();
const daysAgo = (d: number, h = 0, m = 0) => new Date(now - d * 86_400_000 - h * 3_600_000 - m * 60_000).toISOString();

export const DEMO_RIDER: User = {
  id: "usr_rider_01",
  name: "Nimali Perera",
  email: "rider@goride.lk",
  phone: "+94 77 123 4567",
  role: "Rider",
  profilePhotoUrl: null,
  emailVerified: true,
  phoneVerified: true,
  rating: 4.9,
  ratingCount: 37,
  paymentMethodToken: "tok_visa_4242",
  createdAt: daysAgo(120),
};

export const DEMO_ADMIN: User = {
  id: "usr_admin_01",
  name: "Shageeshan T",
  email: "admin@goride.lk",
  phone: "+94 71 555 0101",
  role: "Admin",
  emailVerified: true,
  phoneVerified: true,
  rating: 5,
  ratingCount: 0,
  createdAt: daysAgo(200),
};

interface DriverSeed {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating: number;
  ratingCount: number;
  vehicle: { make: string; model: string; plate: string; color: string; type: VehicleTypeCode };
  licence: string;
  status: Driver["profile"]["status"];
  online: boolean;
  at: Place;
  createdDaysAgo: number;
}

const DRIVER_SEEDS: DriverSeed[] = [
  { id: "usr_driver_01", name: "Kasun Fernando", email: "driver@goride.lk", phone: "+94 76 234 5678", rating: 4.8, ratingCount: 412, vehicle: { make: "Toyota", model: "Aqua", plate: "CAB-4521", color: "White", type: "CAR" }, licence: "B1234567", status: "Active", online: false, at: findPlace("Kollupitiya Junction"), createdDaysAgo: 90 },
  { id: "usr_driver_02", name: "Ruwan Jayasuriya", email: "ruwan.j@goride.lk", phone: "+94 77 345 6789", rating: 4.6, ratingCount: 188, vehicle: { make: "Bajaj", model: "RE", plate: "ABC-7788", color: "Green", type: "TUK" }, licence: "B2234567", status: "Active", online: true, at: findPlace("Liberty Plaza"), createdDaysAgo: 75 },
  { id: "usr_driver_03", name: "Dilshan Silva", email: "dilshan.s@goride.lk", phone: "+94 71 456 7890", rating: 4.9, ratingCount: 640, vehicle: { make: "Honda", model: "Dio", plate: "BDE-1123", color: "Red", type: "BIKE" }, licence: "B3234567", status: "Active", online: true, at: findPlace("Colombo City Centre"), createdDaysAgo: 150 },
  { id: "usr_driver_04", name: "Tharindu Bandara", email: "tharindu.b@goride.lk", phone: "+94 70 567 8901", rating: 4.7, ratingCount: 96, vehicle: { make: "Suzuki", model: "Wagon R", plate: "CAR-9087", color: "Silver", type: "CAR" }, licence: "B4234567", status: "Active", online: true, at: findPlace("Borella Junction"), createdDaysAgo: 40 },
  { id: "usr_driver_05", name: "Chamara Wickramasinghe", email: "chamara.w@goride.lk", phone: "+94 75 678 9012", rating: 4.5, ratingCount: 54, vehicle: { make: "Toyota", model: "KDH", plate: "PV-3321", color: "White", type: "XL" }, licence: "B5234567", status: "Active", online: true, at: findPlace("Rajagiriya"), createdDaysAgo: 30 },
  { id: "usr_driver_06", name: "Sanduni Rathnayake", email: "sanduni.r@goride.lk", phone: "+94 76 789 0123", rating: 5, ratingCount: 12, vehicle: { make: "Nissan", model: "Leaf", plate: "CBB-2210", color: "Blue", type: "CAR" }, licence: "B6234567", status: "DocumentReview", online: false, at: findPlace("Nugegoda Junction"), createdDaysAgo: 3 },
  { id: "usr_driver_07", name: "Nuwan Karunaratne", email: "nuwan.k@goride.lk", phone: "+94 77 890 1234", rating: 5, ratingCount: 0, vehicle: { make: "TVS", model: "King", plate: "ABD-5561", color: "Yellow", type: "TUK" }, licence: "B7234567", status: "PendingVerification", online: false, at: findPlace("Maharagama Bus Stand"), createdDaysAgo: 1 },
  { id: "usr_driver_08", name: "Pradeep Gunasekara", email: "pradeep.g@goride.lk", phone: "+94 71 901 2345", rating: 3.9, ratingCount: 210, vehicle: { make: "Toyota", model: "Prius", plate: "CAA-6630", color: "Black", type: "CAR" }, licence: "B8234567", status: "Suspended", online: false, at: findPlace("Dehiwala Zoo"), createdDaysAgo: 110 },
  { id: "usr_driver_09", name: "Ishara Madushani", email: "ishara.m@goride.lk", phone: "+94 70 012 3456", rating: 4.8, ratingCount: 330, vehicle: { make: "Yamaha", model: "FZ", plate: "BCE-3342", color: "Black", type: "BIKE" }, licence: "B9234567", status: "Active", online: true, at: findPlace("Wellawatte"), createdDaysAgo: 60 },
  { id: "usr_driver_10", name: "Lahiru Dissanayake", email: "lahiru.d@goride.lk", phone: "+94 76 123 4560", rating: 4.4, ratingCount: 77, vehicle: { make: "Honda", model: "Fit", plate: "CAD-1180", color: "Grey", type: "CAR" }, licence: "B0234567", status: "Active", online: true, at: findPlace("Battaramulla"), createdDaysAgo: 22 },
  { id: "usr_driver_11", name: "Roshan Peiris", email: "roshan.p@goride.lk", phone: "+94 77 222 3344", rating: 4.2, ratingCount: 150, vehicle: { make: "Bajaj", model: "RE", plate: "ABF-8821", color: "Red", type: "TUK" }, licence: "B1134567", status: "Rejected", online: false, at: findPlace("Pettah Market"), createdDaysAgo: 14 },
  { id: "usr_driver_12", name: "Harsha Weerasinghe", email: "harsha.w@goride.lk", phone: "+94 71 333 4455", rating: 4.7, ratingCount: 58, vehicle: { make: "Suzuki", model: "Alto", plate: "CAE-7710", color: "Maroon", type: "CAR" }, licence: "B1234568", status: "Deactivated", online: false, at: findPlace("Kelaniya Temple"), createdDaysAgo: 180 },
];

const DOC_KINDS = ["DrivingLicence", "VehicleRegistration", "Insurance", "NIC"] as const;

export function buildDriver(seed: DriverSeed): Driver {
  const verified = seed.status === "Active" || seed.status === "Suspended" || seed.status === "Deactivated";
  const docStatus = verified ? "Approved" : seed.status === "DocumentReview" ? "Uploaded" : seed.status === "Rejected" ? "Rejected" : "Missing";
  return {
    id: seed.id,
    name: seed.name,
    email: seed.email,
    phone: seed.phone,
    role: "Driver",
    profilePhotoUrl: null,
    emailVerified: true,
    phoneVerified: verified,
    rating: seed.rating,
    ratingCount: seed.ratingCount,
    createdAt: daysAgo(seed.createdDaysAgo),
    profile: {
      driverId: seed.id,
      vehicleMake: seed.vehicle.make,
      vehicleModel: seed.vehicle.model,
      vehiclePlate: seed.vehicle.plate,
      vehicleColor: seed.vehicle.color,
      vehicleTypeCode: seed.vehicle.type,
      licenseNumber: seed.licence,
      licenseExpiry: new Date(now + 400 * 86_400_000).toISOString().slice(0, 10),
      status: seed.status,
      verifiedAt: verified ? daysAgo(seed.createdDaysAgo - 2) : null,
      online: seed.online && seed.status === "Active",
      documents: DOC_KINDS.map((kind, i) => ({
        id: `${seed.id}_doc_${i}`,
        kind,
        fileName: docStatus === "Missing" && i > 0 ? undefined : `${kind.toLowerCase()}.pdf`,
        uploadedAt: docStatus === "Missing" && i > 0 ? undefined : daysAgo(seed.createdDaysAgo, 2),
        status: docStatus === "Missing" && i === 0 ? "Uploaded" : docStatus,
        note: docStatus === "Rejected" ? "Document unreadable — please re-upload a clear scan." : undefined,
      })),
    },
  };
}

export const DRIVERS: Driver[] = DRIVER_SEEDS.map(buildDriver);
export const DRIVER_START_LOCATIONS: Record<string, Place> = Object.fromEntries(DRIVER_SEEDS.map((d) => [d.id, d.at]));

export const OTHER_RIDERS: User[] = [
  { id: "usr_rider_02", name: "Amal Jayawardena", email: "amal.j@example.com", phone: "+94 77 999 1111", role: "Rider", emailVerified: true, phoneVerified: true, rating: 4.7, ratingCount: 20, createdAt: daysAgo(80) },
  { id: "usr_rider_03", name: "Dinithi Samaraweera", email: "dinithi.s@example.com", phone: "+94 71 888 2222", role: "Rider", emailVerified: true, phoneVerified: false, rating: 4.9, ratingCount: 64, createdAt: daysAgo(60) },
  { id: "usr_rider_04", name: "Mohamed Rizwan", email: "rizwan.m@example.com", phone: "+94 76 777 3333", role: "Rider", emailVerified: true, phoneVerified: true, rating: 4.3, ratingCount: 9, createdAt: daysAgo(12) },
];

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { id: "ec_1", userId: DEMO_RIDER.id, name: "Sunil Perera", relationship: "Father", phone: "+94 77 100 2000", email: "sunil.p@example.com" },
  { id: "ec_2", userId: DEMO_RIDER.id, name: "Kavindi Perera", relationship: "Sister", phone: "+94 71 300 4000" },
  { id: "ec_3", userId: "usr_driver_01", name: "Malini Fernando", relationship: "Spouse", phone: "+94 76 500 6000" },
];

/* ------------------------------------------------------------------ */
/* Trips, payments, complaints, SOS, audit                              */
/* ------------------------------------------------------------------ */

export function estimateFor(vt: VehicleType, distanceKm: number, durationMin: number, stops = 0) {
  const base = vt.baseFare;
  const distance = Math.round(distanceKm * vt.ratePerKm);
  const time = Math.round(durationMin * vt.ratePerMin);
  const stopCharge = stops * 50;
  const total = Math.round((base + distance + time + stopCharge) / 10) * 10;
  return { base, distance, time, stops: stopCharge, waiting: 0, total };
}

export function estimateDurationMin(distanceKm: number) {
  // Colombo average ~22 km/h incl. stops
  return Math.max(4, Math.round((distanceKm / 22) * 60));
}

function driverSummary(d: Driver) {
  return {
    id: d.id,
    name: d.name,
    phone: d.phone ?? undefined,
    photoUrl: d.profilePhotoUrl,
    rating: d.rating,
    ratingCount: d.ratingCount,
    vehicleMake: d.profile.vehicleMake,
    vehicleModel: d.profile.vehicleModel,
    vehicleColor: d.profile.vehicleColor,
    vehiclePlate: d.profile.vehiclePlate,
    vehicleTypeCode: d.profile.vehicleTypeCode,
  };
}

function riderSummary(u: User) {
  return { id: u.id, name: u.name, phone: u.phone ?? undefined, photoUrl: u.profilePhotoUrl, rating: u.rating };
}

interface HistorySeed {
  id: string;
  rider: User;
  driver: Driver;
  from: string;
  to: string;
  daysAgo: number;
  hour: number;
  status: Trip["status"];
  method: Payment["method"];
  rating?: number;
  cancelledBy?: Trip["cancelledBy"];
}

const HISTORY: HistorySeed[] = [
  { id: "trp_1001", rider: DEMO_RIDER, driver: DRIVERS[0], from: "Kollupitiya Junction", to: "SLIIT Malabe Campus", daysAgo: 0, hour: 8, status: "PAID", method: "Card", rating: 5 },
  { id: "trp_1002", rider: DEMO_RIDER, driver: DRIVERS[2], from: "Galle Face Green", to: "Majestic City", daysAgo: 1, hour: 19, status: "PAID", method: "Cash", rating: 4 },
  { id: "trp_1003", rider: DEMO_RIDER, driver: DRIVERS[1], from: "Liberty Plaza", to: "Independence Square", daysAgo: 1, hour: 12, status: "CANCELLED", method: null, cancelledBy: "Rider" },
  { id: "trp_1004", rider: DEMO_RIDER, driver: DRIVERS[3], from: "Colombo Fort Railway Station", to: "Nugegoda Junction", daysAgo: 3, hour: 17, status: "PAID", method: "Card", rating: 5 },
  { id: "trp_1005", rider: DEMO_RIDER, driver: DRIVERS[0], from: "Havelock City", to: "Lotus Tower", daysAgo: 5, hour: 10, status: "PAID", method: "Cash", rating: 5 },
  { id: "trp_1006", rider: DEMO_RIDER, driver: DRIVERS[4], from: "Bandaranaike International Airport", to: "Galle Face Green", daysAgo: 9, hour: 22, status: "PAID", method: "Card", rating: 4 },
  { id: "trp_1007", rider: DEMO_RIDER, driver: DRIVERS[8], from: "Wellawatte", to: "University of Colombo", daysAgo: 12, hour: 7, status: "PAID", method: "Cash", rating: 5 },
  { id: "trp_1008", rider: DEMO_RIDER, driver: DRIVERS[0], from: "Mount Lavinia Beach", to: "Dutch Hospital Shopping Precinct", daysAgo: 15, hour: 18, status: "PAID", method: "Card", rating: 5 },
  // Driver 01's other trips (different riders)
  { id: "trp_2001", rider: OTHER_RIDERS[0], driver: DRIVERS[0], from: "Borella Junction", to: "Rajagiriya", daysAgo: 0, hour: 10, status: "PAID", method: "Cash", rating: 5 },
  { id: "trp_2002", rider: OTHER_RIDERS[1], driver: DRIVERS[0], from: "Pettah Market", to: "Dehiwala Zoo", daysAgo: 0, hour: 13, status: "PAID", method: "Card", rating: 4 },
  { id: "trp_2003", rider: OTHER_RIDERS[2], driver: DRIVERS[0], from: "One Galle Face Mall", to: "Thalawathugoda", daysAgo: 1, hour: 9, status: "PAID", method: "Card", rating: 5 },
  { id: "trp_2004", rider: OTHER_RIDERS[0], driver: DRIVERS[0], from: "National Hospital of Sri Lanka", to: "Maharagama Bus Stand", daysAgo: 1, hour: 15, status: "CANCELLED", method: null, cancelledBy: "Driver" },
  { id: "trp_2005", rider: OTHER_RIDERS[1], driver: DRIVERS[0], from: "Viharamahadevi Park", to: "Kaduwela Town", daysAgo: 2, hour: 8, status: "PAID", method: "Cash", rating: 5 },
  { id: "trp_2006", rider: OTHER_RIDERS[2], driver: DRIVERS[0], from: "Colombo City Centre", to: "Battaramulla", daysAgo: 2, hour: 18, status: "PAID", method: "Card", rating: 4 },
  { id: "trp_2007", rider: OTHER_RIDERS[0], driver: DRIVERS[0], from: "Kelaniya Temple", to: "Galle Face Green", daysAgo: 4, hour: 11, status: "PAID", method: "Cash", rating: 5 },
  { id: "trp_2008", rider: OTHER_RIDERS[1], driver: DRIVERS[0], from: "Nugegoda Junction", to: "Liberty Plaza", daysAgo: 6, hour: 20, status: "PAID", method: "Card", rating: 5 },
  // Other drivers (admin views)
  { id: "trp_3001", rider: OTHER_RIDERS[0], driver: DRIVERS[7], from: "Dehiwala Zoo", to: "Mount Lavinia Beach", daysAgo: 2, hour: 21, status: "PAID", method: "Cash", rating: 2 },
  { id: "trp_3002", rider: OTHER_RIDERS[2], driver: DRIVERS[3], from: "Rajagiriya", to: "Colombo Fort Railway Station", daysAgo: 0, hour: 7, status: "PAID", method: "Card", rating: 5 },
  { id: "trp_3003", rider: OTHER_RIDERS[1], driver: DRIVERS[9], from: "Battaramulla", to: "Pettah Market", daysAgo: 0, hour: 9, status: "CANCELLED", method: null, cancelledBy: "Rider" },
];

export function buildHistoryTrip(h: HistorySeed): Trip {
  const pickup = findPlace(h.from);
  const destination = findPlace(h.to);
  const vt = VEHICLE_TYPES.find((v) => v.code === h.driver.profile.vehicleTypeCode)!;
  const distanceKm = Math.round(haversineKm(pickup, destination) * 1.3 * 10) / 10;
  const durationMin = estimateDurationMin(distanceKm);
  const est = estimateFor(vt, distanceKm, durationMin);
  const finalTotal = h.status === "PAID" ? Math.round((est.total * (1 + (Math.random() * 0.08 - 0.02))) / 10) * 10 : est.total;
  const created = new Date(now - h.daysAgo * 86_400_000);
  created.setHours(h.hour, Math.floor(Math.random() * 50), 0, 0);
  // never seed a trip "in the future" (e.g. when the app is first opened early in the day)
  if (created.getTime() + (durationMin + 20) * 60_000 > now) created.setTime(now - (h.hour * 9 + 25) * 60_000);
  const t0 = created.getTime();
  const payment: Payment | null =
    h.status === "PAID"
      ? {
          id: `pay_${h.id}`,
          tripId: h.id,
          riderId: h.rider.id,
          driverId: h.driver.id,
          estimatedFare: est.total,
          finalFare: finalTotal,
          breakdown: { ...est, total: finalTotal, distance: est.distance + (finalTotal - est.total) },
          method: h.method,
          cardAttemptCount: h.method === "Card" ? 1 : 0,
          cardDisabled: false,
          status: "Paid",
          receiptNo: `GR-${String(t0).slice(-8)}`,
          createdAt: new Date(t0 + durationMin * 60_000 + 8 * 60_000).toISOString(),
          processedAt: new Date(t0 + durationMin * 60_000 + 9 * 60_000).toISOString(),
        }
      : null;
  return {
    id: h.id,
    riderId: h.rider.id,
    driverId: h.driver.id,
    vehicleTypeId: vt.id,
    vehicleTypeCode: vt.code,
    pickup,
    destination,
    stops: [],
    status: h.status,
    estimatedFare: est.total,
    finalFare: h.status === "PAID" ? finalTotal : null,
    distanceKm,
    durationMin,
    tripPin: null,
    cancellationReason: h.status === "CANCELLED" ? (h.cancelledBy === "Driver" ? "Rider not at pickup" : "Changed my plans") : null,
    cancellationFee: h.status === "CANCELLED" && h.cancelledBy === "Rider" ? 0 : null,
    cancelledBy: h.cancelledBy ?? null,
    matchRoundReached: 1,
    version: 3,
    requestedAt: new Date(t0).toISOString(),
    matchedAt: new Date(t0 + 40_000).toISOString(),
    arrivedAt: h.status === "PAID" ? new Date(t0 + 6 * 60_000).toISOString() : null,
    startedAt: h.status === "PAID" ? new Date(t0 + 8 * 60_000).toISOString() : null,
    completedAt: h.status === "PAID" ? new Date(t0 + (8 + durationMin) * 60_000).toISOString() : null,
    createdAt: new Date(t0).toISOString(),
    driver: driverSummary(h.driver),
    rider: riderSummary(h.rider),
    payment,
    myRating: h.rating ?? null,
    routeGeometry: syntheticRoute(pickup, destination, 16),
  };
}

export const TRIPS: Trip[] = HISTORY.map(buildHistoryTrip);

export const COMPLAINTS: Complaint[] = [
  { id: "cmp_1", tripId: "trp_3001", complainantId: OTHER_RIDERS[0].id, complainantName: OTHER_RIDERS[0].name, complainantRole: "Rider", category: "Driver behaviour", details: "Driver was on the phone throughout the trip and took a longer route via Galle Road despite my request.", status: "Open", createdAt: daysAgo(2, 1) },
  { id: "cmp_2", tripId: "trp_2004", complainantId: DRIVERS[0].id, complainantName: DRIVERS[0].name, complainantRole: "Driver", category: "Rider behaviour", details: "Rider did not show up at the pickup after 7 minutes of waiting and did not answer calls.", status: "UnderReview", createdAt: daysAgo(1, 3) },
  { id: "cmp_3", tripId: "trp_1003", complainantId: DEMO_RIDER.id, complainantName: DEMO_RIDER.name, complainantRole: "Rider", category: "Fare / payment", details: "Was charged a cancellation fee although the driver had not moved for 10 minutes.", status: "Resolved", resolution: "Fee waived and refunded to the rider.", createdAt: daysAgo(1, 5), resolvedAt: daysAgo(0, 20) },
];

export const SOS_ALERTS: SosAlert[] = [
  {
    id: "sos_1",
    tripId: "trp_3001",
    triggeredByUserId: OTHER_RIDERS[0].id,
    triggeredByName: OTHER_RIDERS[0].name,
    role: "Rider",
    lat: 6.8470,
    lng: 79.8680,
    status: "Open",
    notes: [],
    triggeredAt: daysAgo(0, 0, 14),
    trip: TRIPS.find((t) => t.id === "trp_3001")!,
    history: [{ from: null, to: "Open", by: "System", at: daysAgo(0, 0, 14) }],
  },
  {
    id: "sos_2",
    tripId: "trp_2006",
    triggeredByUserId: DRIVERS[0].id,
    triggeredByName: DRIVERS[0].name,
    role: "Driver",
    lat: 6.9030,
    lng: 79.9050,
    status: "Investigating",
    notes: ["Called driver — rider became aggressive over fare; driver safe, trip ended early."],
    triggeredAt: daysAgo(2, 4),
    trip: TRIPS.find((t) => t.id === "trp_2006")!,
    history: [
      { from: null, to: "Open", by: "System", at: daysAgo(2, 4) },
      { from: "Open", to: "Investigating", by: DEMO_ADMIN.name, at: daysAgo(2, 3, 50) },
    ],
  },
  {
    id: "sos_3",
    tripId: "trp_1006",
    triggeredByUserId: DEMO_RIDER.id,
    triggeredByName: DEMO_RIDER.name,
    role: "Rider",
    lat: 7.05,
    lng: 79.88,
    status: "FalseAlarm",
    notes: ["Rider confirmed accidental trigger."],
    triggeredAt: daysAgo(9, 1),
    resolvedAt: daysAgo(9, 0, 40),
    trip: TRIPS.find((t) => t.id === "trp_1006")!,
    history: [
      { from: null, to: "Open", by: "System", at: daysAgo(9, 1) },
      { from: "Open", to: "Investigating", by: DEMO_ADMIN.name, at: daysAgo(9, 0, 55) },
      { from: "Investigating", to: "FalseAlarm", by: DEMO_ADMIN.name, at: daysAgo(9, 0, 40) },
    ],
  },
];

export const AUDIT_LOG: AdminAction[] = [
  { id: "aud_1", adminId: DEMO_ADMIN.id, adminName: DEMO_ADMIN.name, targetType: "Driver", targetId: DRIVERS[7].id, targetName: DRIVERS[7].name, action: "Suspend", reason: "Two verified complaints for route deviation within 30 days.", createdAt: daysAgo(1, 6) },
  { id: "aud_2", adminId: DEMO_ADMIN.id, adminName: DEMO_ADMIN.name, targetType: "Driver", targetId: DRIVERS[10].id, targetName: DRIVERS[10].name, action: "Reject", reason: "Licence document unreadable; expiry could not be verified.", createdAt: daysAgo(3, 2) },
  { id: "aud_3", adminId: DEMO_ADMIN.id, adminName: DEMO_ADMIN.name, targetType: "Driver", targetId: DRIVERS[11].id, targetName: DRIVERS[11].name, action: "Deactivate", reason: "Driver requested permanent account closure.", createdAt: daysAgo(10, 4) },
  { id: "aud_4", adminId: DEMO_ADMIN.id, adminName: DEMO_ADMIN.name, targetType: "Driver", targetId: DRIVERS[9].id, targetName: DRIVERS[9].name, action: "Approve", reason: "All documents verified.", createdAt: daysAgo(20, 1) },
  { id: "aud_5", adminId: DEMO_ADMIN.id, adminName: DEMO_ADMIN.name, targetType: "Rider", targetId: DEMO_RIDER.id, targetName: DEMO_RIDER.name, action: "ResolveComplaint", reason: "Cancellation fee waived (cmp_3).", createdAt: daysAgo(0, 20) },
];

export const NOTIFICATIONS: AppNotification[] = [
  { id: "ntf_1", userId: DEMO_RIDER.id, tripId: "trp_1001", channel: "Push", template: "payment.processed", title: "Payment received", message: "Rs 2,230 paid by card for your trip to SLIIT Malabe Campus.", status: "Sent", read: false, sentAt: daysAgo(0, 3) },
  { id: "ntf_2", userId: DEMO_RIDER.id, tripId: "trp_1001", channel: "Push", template: "trip.completed", title: "Trip completed", message: "Hope you enjoyed your ride with Kasun. Rate your trip.", status: "Sent", read: true, sentAt: daysAgo(0, 3, 2) },
  { id: "ntf_3", userId: DEMO_RIDER.id, tripId: "trp_1002", channel: "Email", template: "payment.receipt", title: "Receipt GR-00213", message: "Your receipt for yesterday's trip is ready.", status: "Sent", read: true, sentAt: daysAgo(1, 2) },
  { id: "ntf_4", userId: "usr_driver_01", tripId: "trp_2002", channel: "Push", template: "payment.processed", title: "Card payment received", message: "Rs 1,180 from Dinithi's trip has been credited.", status: "Sent", read: false, sentAt: daysAgo(0, 5) },
  { id: "ntf_5", userId: "usr_driver_01", channel: "Push", template: "admin.message", title: "Weekly summary", message: "You completed 23 trips this week. Keep it up!", status: "Sent", read: true, sentAt: daysAgo(1) },
];

export const ALL_USERS: User[] = [DEMO_RIDER, DEMO_ADMIN, ...OTHER_RIDERS, ...DRIVERS];
