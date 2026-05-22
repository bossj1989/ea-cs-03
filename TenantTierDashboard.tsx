import React, { Suspense, lazy } from 'react';

type TenantTier = 'enterprise' | 'standard' | string;

interface TenantTierDashboardProps {
  tenantTier: TenantTier;
}

const AdvancedDashboard = lazy(() => import('ReportingApp/AdvancedDashboard'));
const StandardDashboard = lazy(() => import('ReportingApp/StandardDashboard'));

export const TenantTierDashboard: React.FC<TenantTierDashboardProps> = ({ tenantTier }) => {
  const DashboardComponent = tenantTier === 'enterprise' ? AdvancedDashboard : StandardDashboard;

  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardComponent />
    </Suspense>
  );
};
