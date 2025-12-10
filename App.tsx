import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, UserCircle, Menu } from 'lucide-react';
import { ProfileManager } from './components/ProfileManager';
import { TemplateList } from './components/TemplateList';
import { TemplateEditor } from './components/TemplateEditor';

const NavItem = ({ to, icon: Icon, label }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-100 flex-col p-4">
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
          v1.0.0 • Offline Ready
        </div>
      </aside>

      {/* Mobile Header */}
      <div className={`md:hidden fixed inset-0 z-20 bg-slate-900/50 ${mobileMenuOpen ? 'block' : 'hidden'}`} onClick={() => setMobileMenuOpen(false)}></div>
      <aside className={`md:hidden fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} p-4`}>
         <div className="mb-8 px-4 font-bold text-xl">AutoForm PDF</div>
         <nav className="space-y-2" onClick={() => setMobileMenuOpen(false)}>
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/templates" icon={FileText} label="Templates" />
          <NavItem to="/profiles" icon={UserCircle} label="Profiles" />
         </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="md:hidden bg-white h-14 border-b flex items-center px-4 justify-between shrink-0">
          <h1 className="font-bold text-slate-800">AutoForm PDF</h1>
          <button onClick={() => setMobileMenuOpen(true)} className="p-2"><Menu size={24}/></button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

// Wrapper to handle Template Editor logic which takes over the screen
const TemplatesRoute = () => {
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);

  if (activeTemplateId) {
    return <TemplateEditor templateId={activeTemplateId} onClose={() => setActiveTemplateId(null)} />;
  }

  return <TemplateList onSelectTemplate={setActiveTemplateId} />;
};

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
        <p className="opacity-90 max-w-lg">Manage your profiles and PDF templates securely offline. Create mappings once, fill forms instantly.</p>
        <div className="mt-6 flex gap-3">
          <Link to="/templates" className="bg-white text-blue-600 px-5 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors">Start a Form</Link>
          <Link to="/profiles" className="bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-800 transition-colors">Edit Profiles</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><FileText size={20} className="text-blue-500"/> Recent Templates</h3>
           <p className="text-slate-500 text-sm mb-4">You can manually map fields onto any PDF, even if it has no form fields.</p>
           <Link to="/templates" className="text-blue-600 text-sm font-medium hover:underline">View All Templates &rarr;</Link>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><UserCircle size={20} className="text-green-500"/> Profiles</h3>
           <p className="text-slate-500 text-sm mb-4">Store your data locally. Nothing leaves your browser until you export the PDF.</p>
           <Link to="/profiles" className="text-blue-600 text-sm font-medium hover:underline">Manage Profiles &rarr;</Link>
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