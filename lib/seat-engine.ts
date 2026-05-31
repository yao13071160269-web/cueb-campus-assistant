import seatsData from "@/data/seats.json";

export interface SeatStatus {
  zoneId: string;
  zoneName: string;
  floor: number;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  occupancyRate: number;
  description: string;
  heatLevel: "high" | "medium" | "low";
}

export interface BookingResult {
  success: boolean;
  seatNumber: string;
  zone: string;
  floor: number;
  time: string;
  validUntil: string;
  bookingId: string;
}

const seatReservations = new Map<string, Set<string>>();

function getOccupancyRate(hour: number, minute: number, isWeekend: boolean): number {
  const timeDecimal = hour + minute / 60;

  if (isWeekend) {
    if (timeDecimal < 9) return 0.15;
    if (timeDecimal < 11.5) return 0.55;
    if (timeDecimal < 13.5) return 0.35;
    if (timeDecimal < 17) return 0.6;
    if (timeDecimal < 21) return 0.45;
    return 0.1;
  }

  // 08:30-11:30 高峰期
  if (timeDecimal >= 8.5 && timeDecimal < 11.5) return 0.88 + Math.random() * 0.08;
  // 12:00-13:30 低谷期
  if (timeDecimal >= 12 && timeDecimal < 13.5) return 0.3 + Math.random() * 0.1;
  // 13:30-17:00 中高峰
  if (timeDecimal >= 13.5 && timeDecimal < 17) return 0.7 + Math.random() * 0.1;
  // 17:00-18:30 晚餐低谷
  if (timeDecimal >= 17 && timeDecimal < 18.5) return 0.4 + Math.random() * 0.1;
  // 18:30-21:30 晚间高峰（期末周更高）
  if (timeDecimal >= 18.5 && timeDecimal < 21.5) return 0.75 + Math.random() * 0.15;
  // 其他时间
  return 0.2 + Math.random() * 0.1;
}

function getHeatLevel(rate: number): "high" | "medium" | "low" {
  if (rate >= 0.8) return "high";
  if (rate >= 0.5) return "medium";
  return "low";
}

export function getLibraryStatus(): SeatStatus[] {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const statuses: SeatStatus[] = [];

  for (const floor of seatsData.library.floors) {
    for (const zone of floor.zones) {
      const baseRate = getOccupancyRate(hour, minute, isWeekend);
      const zoneModifier =
        zone.zoneId.startsWith("IC") ? 0.05 :
        zone.zoneId.includes("A") ? -0.05 : 0;
      const rate = Math.min(0.98, Math.max(0.05, baseRate + zoneModifier + (Math.random() * 0.06 - 0.03)));
      const occupied = Math.round(zone.totalSeats * rate);

      statuses.push({
        zoneId: zone.zoneId,
        zoneName: zone.name,
        floor: floor.floor,
        totalSeats: zone.totalSeats,
        occupiedSeats: occupied,
        availableSeats: zone.totalSeats - occupied,
        occupancyRate: Math.round(rate * 100),
        description: zone.description,
        heatLevel: getHeatLevel(rate),
      });
    }
  }

  return statuses;
}

export function bookSeat(zoneId: string, studentId: string): BookingResult {
  const statuses = getLibraryStatus();
  const zone = statuses.find((s) => s.zoneId === zoneId);

  if (!zone || zone.availableSeats <= 0) {
    return {
      success: false,
      seatNumber: "",
      zone: zone?.zoneName || "未知",
      floor: zone?.floor || 0,
      time: "",
      validUntil: "",
      bookingId: "",
    };
  }

  const seatNum = Math.floor(Math.random() * zone.totalSeats) + 1;
  const now = new Date();
  const validUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const bookingId = `CUEB${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

  if (!seatReservations.has(studentId)) {
    seatReservations.set(studentId, new Set());
  }
  seatReservations.get(studentId)!.add(bookingId);

  return {
    success: true,
    seatNumber: `${zoneId}-${String(seatNum).padStart(3, "0")}`,
    zone: zone.zoneName,
    floor: zone.floor,
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    validUntil: `${String(validUntil.getHours()).padStart(2, "0")}:${String(validUntil.getMinutes()).padStart(2, "0")}`,
    bookingId,
  };
}
