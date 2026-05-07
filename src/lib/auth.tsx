import { createContext, useContext, ReactNode } from 'react';

export type PropertyRole = 'admin' | 'manager' | 'staff' | 'viewer';

export interface UserPermissions {
  can_check_in: boolean;
  can_check_out: boolean;
  can_submit_forms: boolean;
  can_create_booking: boolean;
  can_change_rooms: boolean;
  can_block_dates: boolean;
  can_export_calendar: boolean;
  can_access_pms: boolean;
  can_access_front_desk: boolean;
  can_override_rates: boolean;
  can_access_guest_inbox: boolean;
  can_delete_reservation: boolean;
  can_view_revenue: boolean;
  can_manage_rooms: boolean;
}

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AuthContext.Provider value={{
      user: null,
      session: null,
      userRole: null,
      systemRole: null,
      permissions: null,
      loading: false,
      signOut: async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || {
    user: null,
    session: null,
    userRole: null,
    systemRole: null,
    permissions: null,
    loading: false,
    signOut: async () => {},
  };
};
