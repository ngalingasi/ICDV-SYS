import React from "react";
import GridShape from "../../components/common/GridShape";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {children}

        {/* Right panel — branding */}
        <div className="items-center hidden w-full h-full lg:w-1/2 bg-brand-950 dark:bg-white/5 lg:grid">
          <div className="relative flex items-center justify-center z-1">
            <GridShape />
            <div className="flex flex-col items-center max-w-sm px-8">
              <Link to="/" className="block mb-6">
                <img
                  src="/logo.png"
                  alt="TPFCS Logo"
                  className="w-48 h-48 object-contain drop-shadow-2xl"
                />
              </Link>
              <h2 className="text-xl font-bold text-white text-center mb-2">
                Tanzania Police Force Corporation Sole
              </h2>
              <p className="text-center text-gray-400 dark:text-white/60 text-sm">
                Project Management System
              </p>
              <p className="mt-4 text-center text-gray-500 dark:text-white/40 text-xs italic">
                "With Service, We Don't Compromise"
              </p>
            </div>
          </div>
        </div>

        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
