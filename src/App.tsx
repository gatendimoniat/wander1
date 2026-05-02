import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { useEffect } from "react";

const queryClient = new QueryClient();

// Set theme synchronously before render
const savedTheme = localStorage.getItem('exploramap-theme') as 'light' | 'dark' | null;
const initialTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.classList.remove('light', 'dark');
document.documentElement.classList.add(initialTheme);

function App() {
  useEffect(() => {
    const handleThemeChange = () => {
      const currentTheme = localStorage.getItem('exploramap-theme') as 'light' | 'dark' | null;
      if (currentTheme) {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(currentTheme);
      }
    };
    
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallPrompt />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
