import axios from 'axios';
import { API_URL } from '../utils/constants';

interface CreditConfig {
  base_seasons: Record<string, number>;
  base_nightly: Record<string, number>;
  tier_multipliers: Record<string, number>;
  room_multipliers: Record<string, number>;
  other: Record<string, number>;
}

interface AutoConfigureResult {
  preview: Array<{
    unit_id: number;
    category: string;
    current_multiplier: number | null;
    detected_room_type: string;
    new_multiplier: number;
    action: 'SET' | 'SKIP' | 'OVERWRITE';
  }>;
  summary: {
    total_units: number;
    will_configure?: number;
    configured?: number;
    will_skip?: number;
    skipped?: number;
    errors: number;
  };
}

export const creditConfigAPI = {
  /**
   * Get current credit system configuration
   */
  async getConfiguration(): Promise<CreditConfig> {
    const token = localStorage.getItem('sw2_token');
    const { data } = await axios.get(`${API_URL}/api/admin/credits/config`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  },

  /**
   * Update credit configuration values
   */
  async updateConfiguration(updates: Record<string, number>): Promise<{
    updated: string[];
    errors: string[];
  }> {
    const token = localStorage.getItem('sw2_token');
    const { data } = await axios.patch(
      `${API_URL}/api/admin/credits/config`,
      updates,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data.data;
  },

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    const token = localStorage.getItem('sw2_token');
    await axios.post(
      `${API_URL}/api/admin/credits/config/reset`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  },

  /**
   * Auto-configure unit multipliers
   */
  async autoConfigureUnits(options: {
    property_id?: number;
    dry_run?: boolean;
    overwrite_manual?: boolean;
  }): Promise<AutoConfigureResult> {
    const token = localStorage.getItem('sw2_token');
    const { data } = await axios.post(
      `${API_URL}/api/admin/credits/auto-configure-units`,
      options,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data.data;
  },

  /**
   * Get unit configuration preview
   */
  async getUnitPreview(unitId: number): Promise<{
    unit_id: number;
    category: string;
    current_multiplier: number | null;
    detected_room_type: string;
    suggested_multiplier: number;
  }> {
    const token = localStorage.getItem('sw2_token');
    const { data } = await axios.get(
      `${API_URL}/api/admin/credits/units/${unitId}/preview`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data.data;
  },

  /**
   * Update unit multiplier
   */
  async updateUnitMultiplier(unitId: number, multiplier: number | null): Promise<void> {
    const token = localStorage.getItem('sw2_token');
    await axios.patch(
      `${API_URL}/api/admin/credits/units/${unitId}/multiplier`,
      { multiplier },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
};
