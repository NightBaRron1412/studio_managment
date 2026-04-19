import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { NewTransaction } from './pages/NewTransaction'
import { TransactionsList } from './pages/TransactionsList'
import { TransactionDetail } from './pages/TransactionDetail'
import { ClientsList } from './pages/ClientsList'
import { ClientProfile } from './pages/ClientProfile'
import { Withdrawals } from './pages/Withdrawals'
import { Rent } from './pages/Rent'
import { Inventory } from './pages/Inventory'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Debtors } from './pages/Debtors'
import { CashClose } from './pages/CashClose'
import { Recycle } from './pages/Recycle'
import { Bookings } from './pages/Bookings'
import { Pickups } from './pages/Pickups'
import { Reminders } from './pages/Reminders'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 1000 * 30 }
  }
})

export function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<TransactionsList />} />
            <Route path="/transactions/new" element={<NewTransaction />} />
            <Route path="/transactions/:id" element={<TransactionDetail />} />
            <Route path="/transactions/:id/edit" element={<NewTransaction />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/:id" element={<ClientProfile />} />
            <Route path="/debtors" element={<Debtors />} />
            <Route path="/cash-close" element={<CashClose />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/pickups" element={<Pickups />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/withdrawals" element={<Withdrawals />} />
            <Route path="/rent" element={<Rent />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/recycle" element={<Recycle />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
