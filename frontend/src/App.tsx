import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import Login from '@/pages/Login'
import MainLayout from '@/layouts/MainLayout'
import StationOverview from '@/pages/StationOverview'
import DispatchTasks from '@/pages/DispatchTasks'
import RideData from '@/pages/RideData'
import FaultManagement from '@/pages/FaultManagement'
import Statistics from '@/pages/Statistics'

interface PrivateRouteProps {
  children: React.ReactNode
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const token = useAuthStore((state) => state.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return null
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/stations" replace />} />
        <Route path="stations" element={<StationOverview />} />
        <Route path="dispatch" element={<DispatchTasks />} />
        <Route path="ride" element={<RideData />} />
        <Route path="fault" element={<FaultManagement />} />
        <Route path="statistics" element={<Statistics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
