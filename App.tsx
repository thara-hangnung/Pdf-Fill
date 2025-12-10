import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, UserCircle } from 'lucide-react';
import { ProfileManager } from './components/ProfileManager';
import { TemplateList } from './components/TemplateList';
import { TemplateEditor } from './components/TemplateEditor';

const NavItem = ({ to, icon: Icon, label, mobile }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  if (mobile) {
    return (
      <Link 
        to={to} 
        className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
      >
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">{label}</span>
      </Link>
    );
  }

  return (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-100 flex-col p-4 shrink-0">
        <div className="mb-8 px-4 py-2">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-blue-600 w-2 h-6 rounded-sm"></span> AutoForm PDF
          </h1>
        </div>
        <nav className="space-y-2 flex-1">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/templates" icon={FileText} label="Templates" />
          <NavItem to="/profiles" icon={UserCircle} label="Profiles" />
        </nav>
        <div className="text-xs text-slate-500 px-4">
          v1.1.0 • PWA Ready
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header (Only visible on Dashboard/Lists, usually hidden in Editor) */}
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-8">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 pb-safe">
           <NavItem to="/" icon={LayoutDashboard} label="Home" mobile />
           <NavItem to="/templates" icon={FileText} label="Templates" mobile />
           <NavItem to="/profiles" icon={UserCircle} label="Profiles" mobile />
        </div>
      </main>
    </div>
  );
};

// Wrapper to handle Template Editor logic which takes over the screen (Full Screen Modal style)
const TemplatesRoute = () => {
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);

  if (activeTemplateId) {
    return (
      <div className="fixed inset-0 z-[60] bg-white">
        <TemplateEditor templateId={activeTemplateId} onClose={() => setActiveTemplateId(null)} />
      </div>
    );
  }

  return <TemplateList onSelectTemplate={setActiveTemplateId} />;
};

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Welcome Back</h2>
        <p className="opacity-90 max-w-lg text-sm md:text-base">Manage your profiles and PDF templates securely offline.</p>
        <div className="mt-6 flex gap-3">
          <Link to="/templates" className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors">Start Form</Link>
          <Link to="/profiles" className="bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-800 transition-colors">Profiles</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><FileText size={20} className="text-blue-500"/> Recent Templates</h3>
           <Link to="/templates" className="text-blue-600 text-sm font-medium hover:underline block mt-2">View All Templates &rarr;</Link>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><UserCircle size={20} className="text-green-500"/> Profiles</h3>
           <Link to="/profiles" className="text-blue-600 text-sm font-medium hover:underline block mt-2">Manage Profiles &rarr;</Link>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/templates" element={<TemplatesRoute />} />
          <Route path="/profiles" element={<ProfileManager />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;