"use client";
import { AppShell } from "./app-shell";
import { ExploreView, PlaceView, SavedView } from "./views/explore";
import { PeopleView, MemberView, RequestsView } from "./views/people";
import { NowView, EventsView } from "./views/now-events";
import { MembershipView, CheckoutView } from "./views/membership";
import { OnboardingView, SettingsView } from "./views/account";
import { AdminView } from "./views/admin";
import { Empty } from "./ui";
export function Platform({ path }: { path: string[] }) {
  const [first, second, third] = path;
  let screen: React.ReactNode;
  if (first === "saved") screen = <SavedView />;
  else if (first === "membership") screen = <MembershipView />;
  else if (first === "checkout" && second) screen = <CheckoutView id={second} />;
  else if (first === "requests") screen = <RequestsView />;
  else if (first === "settings") screen = <SettingsView />;
  else if (first === "onboarding") screen = <OnboardingView />;
  else if (first === "admin") screen = <AdminView />;
  else if (first === "members" && second) screen = <MemberView id={second} />;
  else if (first === "privacy" || first === "terms")
    screen = (
      <div className="policy-page">
        <p className="eyebrow">ALPHA / {first.toUpperCase()}</p>
        <h1>{first === "privacy" ? "Your privacy matters." : "Membership terms."}</h1>
        <p>
          {first === "privacy"
            ? "Profiles are private unless you choose to be discoverable. Contact details are encrypted and shared only after mutual acceptance and your explicit consent. ENS records are public only when you choose to write them."
            : "All Access covers all published cities for 30 days per purchase. Renewal is manual. Event admission, meals, and drinks are separate. Tokyo is the initial city."}
        </p>
        <div className="note">
          Launch configuration is incomplete: the operator must add the legal seller, support
          contact, retention policy, and refund terms before accepting real payments. This page
          describes implemented behavior and is not a completed legal policy.
        </div>
        <p className="muted">
          Local demo accounts, venues, and events are fictional. Demo data resets when the server
          restarts.
        </p>
      </div>
    );
  else if (/^[a-z-]+$/.test(first)) {
    if (!second) screen = <ExploreView city={first} />;
    else if (second === "people") screen = <PeopleView city={first} />;
    else if (second === "now") screen = <NowView city={first} />;
    else if (second === "events") screen = <EventsView city={first} />;
    else if (second === "places" && third) screen = <PlaceView slug={third} />;
    else screen = <Empty title="A little off the map.">This screen does not exist.</Empty>;
  } else screen = <Empty title="A little off the map.">This screen does not exist.</Empty>;
  return <AppShell>{screen}</AppShell>;
}
