import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import type { ApiResponse } from '@/types/models';

export interface BookingDetails {
  id: number;
  property_id: number;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  room_type: string;
  status: string;
  total_amount: number;
  guest_token: string;
  pms_booking_id?: string;
  pms_provider?: string;
  created_at: string;
  updated_at: string;
  Property: {
    id: number;
    name: string;
    location: string;
    city: string;
    country: string;
    stars: number;
    amenities?: string[];
  };
  Services?: Array<{
    id: number;
    service_type: string;
    status: string;
    price: number;
    quantity: number;
    notes?: string;
  }>;
}

export function useBooking(bookingId: string | number) {
  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async (): Promise<BookingDetails> => {
      try {
        const { data } = await apiClient.get<ApiResponse<BookingDetails>>(
          `/timeshare/bookings/${bookingId}`
        );
        return data.data!;
      } catch (err: any) {
        console.error('Failed to fetch booking details:', err);
        throw err;
      }
    },
    enabled: !!bookingId,
    retry: 1
  });

  return { booking, isLoading, error };
}
