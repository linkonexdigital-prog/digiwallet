import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Withdrawals from "@/pages/Withdrawals";
import Notifications from "@/pages/Notifications";
import Settings from "@/pages/Settings";

import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminWithdrawals from "@/pages/admin/AdminWithdrawals";
import AdminWallet from "@/pages/admin/AdminWallet";
import AdminApi from "@/pages/admin/AdminApi";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminSecurity from "@/pages/admin/AdminSecurity";
import AdminSettings from "@/pages/admin/AdminSettings";

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="mono text-sm text-muted-foreground animate-pulse">Loading…</div>
  </div>
);

const ProtectedUser = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user || !user.id) return <Navigate to="/login" replace/>;
  return <AppLayout>{children}</AppLayout>;
};

const ProtectedAdmin = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user || !user.id) return <Navigate to="/login" replace/>;
  if (user.role !== "admin") return <Navigate to="/app" replace/>;
  return <AdminLayout>{children}</AdminLayout>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" theme="system"/>
          <Routes>
            <Route path="/" element={<Landing/>}/>
            <Route path="/login" element={<Login/>}/>
            <Route path="/register" element={<Register/>}/>

            <Route path="/app" element={<ProtectedUser><Dashboard/></ProtectedUser>}/>
            <Route path="/app/transactions" element={<ProtectedUser><Transactions/></ProtectedUser>}/>
            <Route path="/app/withdrawals" element={<ProtectedUser><Withdrawals/></ProtectedUser>}/>
            <Route path="/app/notifications" element={<ProtectedUser><Notifications/></ProtectedUser>}/>
            <Route path="/app/settings" element={<ProtectedUser><Settings/></ProtectedUser>}/>

            <Route path="/admin" element={<ProtectedAdmin><AdminDashboard/></ProtectedAdmin>}/>
            <Route path="/admin/users" element={<ProtectedAdmin><AdminUsers/></ProtectedAdmin>}/>
            <Route path="/admin/wallet" element={<ProtectedAdmin><AdminWallet/></ProtectedAdmin>}/>
            <Route path="/admin/withdrawals" element={<ProtectedAdmin><AdminWithdrawals/></ProtectedAdmin>}/>
            <Route path="/admin/api" element={<ProtectedAdmin><AdminApi/></ProtectedAdmin>}/>
            <Route path="/admin/notifications" element={<ProtectedAdmin><AdminNotifications/></ProtectedAdmin>}/>
            <Route path="/admin/security" element={<ProtectedAdmin><AdminSecurity/></ProtectedAdmin>}/>
            <Route path="/admin/settings" element={<ProtectedAdmin><AdminSettings/></ProtectedAdmin>}/>

            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
