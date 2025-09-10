// main.js (module-safe)
/* import { PublicClientApplication } from "@azure/msal-browser";
import { createClient } from "@supabase/supabase-js";

(() => {
  const cfg = window.APP_CONFIG || {};
  const {
    AZURE_CLIENT_ID,
    AZURE_TENANT_ID = "common",
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  } = cfg;

  const statusEl = document.getElementById("status");
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  if (!AZURE_CLIENT_ID || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setStatus("Missing config (see window.APP_CONFIG)");
    return;
  }

  const msal = new PublicClientApplication({
    auth: {
      clientId: AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const makeNonce = (len = 32) => {
    const b = new Uint8Array(len);
    crypto.getRandomValues(b);
    // base64url
    return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const decodeJwtPayload = (token) => {
    try {
      const parts = String(token).split(".");
      if (parts.length < 2) return null;
      let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4;
      if (pad) b64 += "=".repeat(4 - pad);
      return JSON.parse(atob(b64));
    } catch (e) {
      console.warn("Failed to decode JWT payload", e);
      return null;
    }
  };

  async function initializeMsal() {
    try {
      if (typeof msal.initialize === "function") await msal.initialize();
      if (typeof msal.handleRedirectPromise === "function") {
        const r = await msal.handleRedirectPromise();
        if (r) console.log("MSAL redirect result:", r);
      }
      setStatus("MSAL initialized.");
    } catch (err) {
      console.error("MSAL initialization failed", err);
      setStatus("MSAL init failed: " + (err?.message || err));
      throw err;
    }
  }

  const handleMsalLogin = async () => {
    setStatus("Opening Microsoft login...");
    const outgoingNonce = makeNonce(32);
    sessionStorage.setItem("auth_nonce", outgoingNonce);

    const loginRequest = {
      scopes: ["openid", "profile", "email"],
      extraQueryParameters: { nonce: outgoingNonce },
    };

    try {
      if (typeof msal.initialize === "function") await msal.initialize();

      const authResult = await msal.loginPopup(loginRequest);
      if (!authResult) throw new Error("MSAL returned no auth result");

      const idToken = authResult.idToken;
      const idClaims = authResult.idTokenClaims || {};
      console.log("raw idTokenClaims:", idClaims);

      const decoded = decodeJwtPayload(idToken);
      console.log("decoded id_token payload:", decoded);

      const tokenNonce = idClaims.nonce ?? decoded?.nonce ?? null;
      const storedNonce = sessionStorage.getItem("auth_nonce");
      console.log("debug nonces:", { storedNonce, tokenNonce });

      if (!tokenNonce && !storedNonce) {
        console.error("No nonce available from token or storage — aborting.");
        setStatus("Login error: missing nonce.");
        return;
      }

      const candidateNonces = [];
      if (tokenNonce) candidateNonces.push(tokenNonce);
      if (storedNonce && storedNonce !== tokenNonce) candidateNonces.push(storedNonce);

      setStatus("Exchanging id_token with Supabase (trying nonces)...");

      let exchangeResult = null, lastError = null;
      for (const nonce of candidateNonces) {
        try {
          const payload = { provider: "azure", token: idToken, nonce };
          console.log("Attempting Supabase signInWithIdToken with nonce:", nonce);
          const { data, error } = await supabase.auth.signInWithIdToken(payload);
          console.log("Supabase response for nonce", nonce, { data, error });
          if (error) {
            lastError = error;
            continue; 
          }
          exchangeResult = { data, usedNonce: nonce };
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!exchangeResult) {
        console.error("All nonce attempts failed. Last error:", lastError);
        setStatus("Supabase exchange failed: " + (lastError?.message || JSON.stringify(lastError)));
        console.info("If this persists: check Supabase provider config, redirect URIs, and provider keys.");
        return;
      }

      console.log("Supabase exchange success:", exchangeResult);
      const session = exchangeResult.data?.session;
      if (!session) {
        setStatus("Supabase did not return a session; check provider config.");
        return;
      }

      const supaUserId = session.user?.id;
      if (!supaUserId) {
        setStatus("Missing Supabase user id after sign-in.");
        return;
      }

      // fetch profile; if not found create one
      const { data: profileData, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", supaUserId)
        .single();

      if (pErr) {
        const email = idClaims.email || idClaims.upn || null;
        const fullName = idClaims.name || null;
        const insertRes = await supabase.from("profiles").insert([
          { id: supaUserId, email, full_name: fullName, role: "user", is_active: true },
        ]);
        if (insertRes.error) {
          console.error("Failed to create profile:", insertRes.error);
          setStatus("Signed in but failed to create profile.");
        } else {
          setStatus("Signed in (new profile created).");
        } 
      } else {
        setStatus("Signed in as " + (profileData.email || profileData.id));
      }
    } catch (err) {
      console.error("MSAL login error", err);
      setStatus("Login error: " + (err?.message || err));
    } finally {
      sessionStorage.removeItem("auth_nonce");
    }
  };

  // boot
  (async () => {
    try {
      setStatus("Initializing MSAL...");
      await initializeMsal();
      const btn = document.getElementById("msal-login");
      if (btn) btn.addEventListener("click", handleMsalLogin);
    } catch (e) {
      const btn = document.getElementById("msal-login");
      if (btn) { btn.disabled = true; btn.title = "MSAL initialization failed"; }
    }
  })();
})(); */ 

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabase = createClient('https://urridrblvxecnbhniptz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVycmlkcmJsdnhlY25iaG5pcHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDc1NzUsImV4cCI6MjA3MDcyMzU3NX0.o6wLAB29imsBY8U2-uBl5UN-trZJ96F9FDgSgyM_4LM')
console.log('Supabase Instance: ', supabase)

const { data } = supabase.auth.onAuthStateChange((event, session) => {
  console.log(event, session)
 
  if (event === 'INITIAL_SESSION') {
    // handle initial session
  } else if (event === 'SIGNED_IN') {
    // handle sign in event
  } else if (event === 'SIGNED_OUT') {
    // handle sign out event
  } else if (event === 'PASSWORD_RECOVERY') {
    // handle password recovery event
  } else if (event === 'TOKEN_REFRESHED') {
    // handle token refreshed event
  } else if (event === 'USER_UPDATED') {
    // handle user updated event
  }
})

console.log(data)

const { data2, error } = await supabase  .from('profiles')  .select()
 