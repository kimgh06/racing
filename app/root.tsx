import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

const SITE_URL = process.env.SITE_URL || "https://falcare.com"; // 환경변수로 설정 가능

export const meta: MetaFunction = ({ location }) => {
  const currentUrl = `${SITE_URL}${location.pathname}${location.search}`;
  const title = "Falcare Alpha Test";
  const description = "Remix + R3F 중력 엔진 데모 - 3D 레이싱 게임";
  const imageUrl = `${SITE_URL}/og-image.jpg`; // OG 이미지 경로 (추가 필요)

  return [
    // 기본 메타 태그
    { title },
    { name: "description", content: description },
    { name: "keywords", content: "Falcare, Racing, 3D, 게임, 레이싱, React Three Fiber, Remix, WebGL" },
    { name: "author", content: "Falcare" },
    { name: "robots", content: "index, follow" },
    { name: "language", content: "Korean" },
    { name: "theme-color", content: "#000000" },
    { name: "apple-mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-status-bar-style", content: "black" },
    
    // Open Graph 메타 태그
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: currentUrl },
    { property: "og:image", content: imageUrl },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: title },
    { property: "og:site_name", content: "Falcare" },
    { property: "og:locale", content: "ko_KR" },
    
    // Twitter Card 메타 태그
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:image:alt", content: title },
  ];
};

export const links: LinksFunction = ({ location }) => {
  const currentUrl = `${SITE_URL}${location.pathname}${location.search}`;
  
  return [
    { rel: "canonical", href: currentUrl },
  ];
};

export default function App() {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0, padding: 0, overflow: "hidden" }}>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
