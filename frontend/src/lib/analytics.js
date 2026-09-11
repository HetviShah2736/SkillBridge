import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "@/lib/api";

const GA_ID = process.env.REACT_APP_GA_ID;
const SESSION_KEY = "sb_session";

function getSessionId() {
  let s = sessionStorage.getItem(SESSION_KEY);
  if (!s) {
    s = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

let gaLoaded = false;
export function loadGA() {
  if (gaLoaded || !GA_ID || GA_ID.length < 5) return;
  gaLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  // Anonymize IP + defer initial pageview so router-driven views fire it
  window.gtag("config", GA_ID, { send_page_view: false, anonymize_ip: true });
}

export function useAnalytics() {
  const location = useLocation();
  const lastPath = useRef(null);

  useEffect(() => {
    loadGA();
  }, []);

  useEffect(() => {
    const path = location.pathname + location.search;
    if (lastPath.current === path) return;
    lastPath.current = path;

    // Send to GA4
    if (window.gtag && GA_ID) {
      window.gtag("event", "page_view", {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
      });
    }

    // Send to backend
    const params = new URLSearchParams(location.search);
    const referrer = document.referrer && !document.referrer.includes(window.location.host) ? document.referrer : "";
    api.post("/events/pageview", {
      path: location.pathname,
      session_id: getSessionId(),
      referrer,
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      title: document.title,
    }).catch(() => { /* silent */ });
  }, [location.pathname, location.search]);
}
