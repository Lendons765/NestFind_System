import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import ListingSearchPage from "./pages/ListingSearchPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LoginPage from "./pages/LoginPage";
import VerifyPage from "./pages/VerifyPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OwnerDashboardPage from "./pages/OwnerDashboardPage";
import OwnerInboxPage from "./pages/OwnerInboxPage";
import OwnerListingsPage from "./pages/OwnerListingsPage";
import NewListingPage from "./pages/NewListingPage";
import ListingManagePage from "./pages/ListingManagePage";
import LeasesPage from "./pages/LeasesPage";
import TenantPortalPage from "./pages/TenantPortalPage";


const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<ListingSearchPage />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/forgot" element={<ForgotPasswordPage />} />
            <Route path="/reset" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<OwnerDashboardPage />} />
            <Route path="/inbox" element={<OwnerInboxPage />} />
            <Route path="/leases" element={<LeasesPage />} />
            <Route path="/my-home" element={<TenantPortalPage />} />
            <Route path="/my-listings" element={<OwnerListingsPage />} />
            <Route path="/my-listings/new" element={<NewListingPage />} />
            <Route path="/my-listings/:id/edit" element={<NewListingPage />} />
            <Route path="/my-listings/:id/manage" element={<ListingManagePage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}