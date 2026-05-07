import { createContext, useContext, useState, ReactNode } from 'react';

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  default_currency: string;
  default_timezone: string;
  vat_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  name: string;
  legal_name: string | null;
  description: string | null;
  property_type: string;
  email: string;
  phone: string | null;
  website: string | null;
  address: string;
  address_line_2: string | null;
  city: string;
  state: string | null;
  zip_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  default_checkin_time: string | null;
  default_checkout_time: string | null;
  channex_property_id: string | null;
  channex_synced: boolean;
  channex_last_sync: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  company_id: string | null;
  weekend_days: number[] | null;
  off_peak_days: number[] | null;
  vat_rate: number | null;
  default_commission_rate: number | null;
  revenue_recognition_method: 'check_in' | 'check_out' | 'prorata' | null;
}

export type PropertyRole = 'admin' | 'manager' | 'staff' | 'viewer';

interface PropertyContextType {
  properties: Property[];
  activeProperty: Property | null;
  setActiveProperty: (property: Property) => void;
  propertyRole: PropertyRole | null;
  isSystemAdmin: boolean;
  isLoading: boolean;
  canEditProperty: boolean;
  canDeleteProperty: boolean;
  canManageUsers: boolean;
  refreshProperties: () => Promise<void>;
  company: Company | null;
  defaultPropertyId: string;
}

const DEFAULT_PROPERTY_ID = import.meta.env.VITE_DEFAULT_PROPERTY_ID || '';

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export const PropertyProvider = ({ children }: { children: ReactNode }) => {
  const [activeProperty] = useState<Property | null>(null);

  return (
    <PropertyContext.Provider value={{
      properties: [],
      activeProperty,
      setActiveProperty: () => {},
      propertyRole: null,
      isSystemAdmin: false,
      isLoading: false,
      canEditProperty: false,
      canDeleteProperty: false,
      canManageUsers: false,
      refreshProperties: async () => {},
      company: null,
      defaultPropertyId: DEFAULT_PROPERTY_ID,
    }}>
      {children}
    </PropertyContext.Provider>
  );
};

export const useProperty = () => {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
};

export const usePropertySafe = () => {
  return useContext(PropertyContext);
};

export const getDefaultPropertyId = () => DEFAULT_PROPERTY_ID;
