import axios from 'axios';

export interface RegistryItem {
  type: string;
  value: string;
  key: string;
}

export interface AvailableItems {
  documents: RegistryItem[];
  references: RegistryItem[];
  reports: RegistryItem[];
  informReports: RegistryItem[];
  services: RegistryItem[];
  gates: RegistryItem[];
}

/**
 * Получить все доступные элементы из registry
 */
export const getAvailableItems = async (token: string | undefined): Promise<AvailableItems | null> => {
  if (!token) {
    return null;
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_DOMAIN}/api/settings/registry/available-items`;
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };
    
    const response = await axios.get<AvailableItems>(url, config);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching available items:', error);
    return null;
  }
};

