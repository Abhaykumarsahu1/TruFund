import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import CampaignerRegister from "./pages/CampaignerRegister";
import DonorDashboard from "./pages/DonorDashboard";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignerDashboard from "./pages/CampaignerDashboard";
import BoardDashboard from "./pages/BoardDashboard";
import Navbar from "./components/Navbar";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"                      element={<Landing />} />
        <Route path="/register"              element={<CampaignerRegister />} />
        <Route path="/donate"                element={<DonorDashboard />} />
        <Route path="/campaign/:address"     element={<CampaignDetail />} />
        <Route path="/dashboard"             element={<CampaignerDashboard />} />
        <Route path="/board/:address"        element={<BoardDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;