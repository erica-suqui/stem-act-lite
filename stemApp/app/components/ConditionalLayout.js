'use client';
import { usePathname } from "next/navigation";
import AdminNav from "./AdminNav";

export default function ConditionalLayout({children}){

    const pathname = usePathname();
    const isEmbed = pathname.startsWith('/embed');
    if (isEmbed) {
        return <>{children}</>;
      }
    
      return (
        <>
          <AdminNav />
          {children}
        </>
      );
}