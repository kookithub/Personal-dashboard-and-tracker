"use client";
// Shows the login screen until the password is accepted, then the page. Guests (sample data,
// nothing saved) see the page with a bar saying so.
import { useEffect, useRef, useState } from "react";
import { DEMO, REPO_URL, useApp } from "./AppProvider";
import DevicesDialog, { checkSignIns } from "./DevicesDialog";
import { Ico } from "./ui";

export default function Gate({ children }) {
  const { auth, api, notice, openDialog } = useApp();
  // Once logged in: warn about a new device or wrong passwords since this device last looked.
  useEffect(() => {
    if (auth !== "in") return;
    const t = setTimeout(() => checkSignIns(api, notice, () => openDialog((c) => <DevicesDialog close={c} />)), 1500);
    return () => clearTimeout(t);
  }, [auth]); // eslint-disable-line
  if (auth === "loading") return <div className="b-loading">loading…</div>;
  if (auth === "in") return children;
  if (auth === "guest" && DEMO) {
    return (
      <>
        <div className="b-guestbar">
          <span><b>Demo</b> · sample data, nothing you change is saved</span>
          {REPO_URL && <a href={REPO_URL} target="_blank" rel="noopener">Get the code</a>}
        </div>
        {children}
      </>
    );
  }
  if (auth === "guest") {
    return (
      <>
        <div className="b-guestbar">
          <span><b>Guest mode</b> · sample data, nothing you change is saved</span>
          <button type="button" onClick={() => location.reload()}>Log in</button>
        </div>
        {children}
      </>
    );
  }
  return <Login error={auth === "error" ? "Could not reach the server. Check your connection and reload." : ""} />;
}

function Login({ error }) {
  const { login, enterGuest } = useApp();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(error);
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const msg = await login(pw);
      if (msg) setErr(msg);
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="b-login b-enter">
      <div className="b-tile">
        <div className="b-logo"><Ico name="house" /></div>
        <h1>Welcome <em>back</em></h1>
        <p>Enter your password to open your dashboard.</p>
        <form onSubmit={submit}>
          <input ref={ref} className="b-input" type="password" placeholder="Password" autoComplete="current-password"
            name="password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="b-btn primary" type="submit" disabled={busy}>Unlock</button>
        </form>
        <div className="b-login-err">{err}</div>
        <button type="button" className="b-guest" onClick={enterGuest}>Look around as a guest</button>
        <small className="b-guest-note">Sample data only. Nothing is saved, and nothing of the owner's is shown.</small>
      </div>
    </div>
  );
}
