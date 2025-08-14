import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Receipt, 
  LogOut, 
  User
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { clsx } from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: location.pathname === '/dashboard'
    },
    {
      name: 'Expenses',
      href: '/expenses',
      icon: Receipt,
      current: location.pathname === '/expenses'
    }
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-soft border-b border-primary-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <img 
                  src="/logo.png" 
                  alt="OpSync Logo" 
                  className="w-8 h-8"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary-text">OpSync</h1>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      item.current
                        ? 'bg-primary-button bg-opacity-20 text-primary-text'
                        : 'text-primary-secondary hover:text-primary-text hover:bg-primary-button hover:bg-opacity-10'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <User className="w-4 h-4 text-primary-secondary" />
                <span className="font-medium text-primary-text">
                  {user?.username}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-primary-secondary hover:text-primary-text hover:bg-primary-button hover:bg-opacity-10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="fixed top-16 left-0 right-0 z-40 md:hidden bg-white border-b border-primary-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex space-x-8 overflow-x-auto py-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    item.current
                      ? 'bg-primary-button bg-opacity-20 text-primary-text'
                      : 'text-primary-secondary hover:text-primary-text hover:bg-primary-button hover:bg-opacity-10'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full pt-24 md:pt-20 pb-20">
        {children}
      </main>

      {/* Security Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-primary-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-center items-center text-xs text-primary-secondary">
            <p>OpSync</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;