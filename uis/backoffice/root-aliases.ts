declare module '@/src/components/KpiGrid' {
  export function KpiGrid(): import('react').ReactElement;
}

declare module '@/src/components/OperationsPanel' {
  export function OperationsPanel(): import('react').ReactElement;
}

declare module '@/src/components/Sidebar' {
  export function Sidebar(): import('react').ReactElement;
}

declare module '@/src/components/WarehouseHealth' {
  export function WarehouseHealth(): import('react').ReactElement;
}

declare module '@/src/components/CentralizedIncidentManager' {
  export function CentralizedIncidentManager(): import('react').ReactElement;
}

declare module '@/src/components/IncidentRegistrationForm' {
  export function IncidentRegistrationForm(props?: {
    onIncidentCreated?: (incident: import('./src/types/incidents').Incident) => void;
  }): import('react').ReactElement;
}

declare module '@/src/components/IncidentListPanel' {
  export function IncidentListPanel(props?: {
    refreshTrigger?: number;
    onStatusChanged?: () => void;
  }): import('react').ReactElement;
}

declare module '@/src/components/IncidentSummaryPanel' {
  export function IncidentSummaryPanel(props?: {
    refreshTrigger?: number;
  }): import('react').ReactElement;
}
