import Header from "@/components/Header";

/** Site pages get the header. Embedded cards (/embed/<id>) live outside this group: no header. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
