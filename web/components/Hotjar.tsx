import Script from "next/script";

/** Hotjar: heatmaps and session recordings of the site (not of embedded cards). Loads after the page is interactive. */
const HOTJAR_ID = 6793200;

export default function Hotjar() {
  return (
    <Script id="hotjar" strategy="afterInteractive">
      {`(function(h,o,t,j,a,r){
        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:${HOTJAR_ID},hjsv:6};
        a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;
        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);
      })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
    </Script>
  );
}
