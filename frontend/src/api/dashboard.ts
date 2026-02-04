import axios from 'axios';
import type { DashboardResponse, OwnerDashboardResponse } from '@/types/api';

export const dashboardApi = {
  getOwnerDashboard: async (): Promise<OwnerDashboardResponse> => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const token = localStorage.getItem('sw2_token');
      
      // Get data from V2 endpoints
      const [weeksRes, creditsRes] = await Promise.all([
        axios.get(`${baseURL}/api/owner/weeks?year=${new Date().getFullYear()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${baseURL}/api/v2/credits/balance`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const weeks = weeksRes.data.data || [];
      const creditBalance = creditsRes.data.data || { balance: 0 };

      // Calculate stats
      const assignedWeeks = weeks.filter((w: any) => w.status === 'ASSIGNED');
      const upcomingWeeks = weeks.filter((w: any) => {
        const startDate = new Date(w.start_date);
        return startDate > new Date() && ['ASSIGNED', 'RESERVED'].includes(w.status);
      });

      // Format dashboard data according to OwnerDashboardResponse type
      const dashboardData: OwnerDashboardResponse = {
        stats: {
          totalWeeks: weeks.length,
          availableWeeks: assignedWeeks.length,
          activeSwaps: 0, // TODO: get from swap requests
          upcomingBookings: upcomingWeeks.length
        },
        credits: {
          total: creditBalance.balance || 0,
          available: creditBalance.balance || 0,
          expiringSoon: 0 // TODO: calculate from expiration dates
        },
        recentActivity: {
          weeks: upcomingWeeks.slice(0, 5),
          swaps: [] // TODO: get recent swaps
        }
      };

      return dashboardData;
    } catch (error) {
      console.error('Failed to fetch owner dashboard:', error);
      // Return empty dashboard data on error
      return {
        stats: {
          totalWeeks: 0,
          availableWeeks: 0,
          activeSwaps: 0,
          upcomingBookings: 0
        },
        credits: {
          total: 0,
          available: 0,
          expiringSoon: 0
        },
        recentActivity: {
          weeks: [],
          swaps: []
        }
      };
    }
  }
};
