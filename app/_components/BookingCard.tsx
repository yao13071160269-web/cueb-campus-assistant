"use client";

interface BookingInfo {
  success: boolean;
  seatNumber: string;
  zone: string;
  floor: number;
  time: string;
  validUntil: string;
  bookingId: string;
}

export default function BookingCard({ booking }: { booking: BookingInfo }) {
  if (!booking.success) return null;

  return (
    <div className="pulse-ring my-3 rounded-xl border-2 border-cueb-red bg-gradient-to-br from-white to-red-50 p-4 shadow-lg animate-fade-up max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-cueb-red flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            <path d="M6.5 12.5l-4-4 1.5-1.5 2.5 2.5 5.5-5.5 1.5 1.5z" />
          </svg>
        </div>
        <h3 className="font-bold text-cueb-red text-lg">CUEB 虚拟选座成功凭证</h3>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">座位号</span>
          <span className="font-mono font-bold text-lg text-cueb-red-dark">{booking.seatNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">区域</span>
          <span className="font-medium">{booking.zone}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">楼层</span>
          <span className="font-medium">{booking.floor}F</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">预约时间</span>
          <span className="font-medium">{booking.time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">有效至</span>
          <span className="font-medium text-orange-600">{booking.validUntil}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-dashed border-gray-300 flex justify-between items-center">
          <span className="text-xs text-gray-400">凭证编号</span>
          <span className="font-mono text-xs text-gray-500">{booking.bookingId}</span>
        </div>
      </div>
      <div className="mt-3 text-center">
        <span className="text-xs text-gray-400 italic">* 此为沙箱环境模拟预约凭证</span>
      </div>
    </div>
  );
}
